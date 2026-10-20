import "server-only";
import { audit } from "@/lib/audit";
import { and, asc, desc, eq, gt, inArray, lt, ne, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb } from "@/lib/db";
import { conversationMembers, conversations, messageFiles, messageReactions, messages, users } from "@/lib/db/schema";
import { MAX_FILE_BYTES, MAX_FILES, type Role } from "@/lib/constants";
import { sendPush } from "@/lib/push";

type Actor = { id: number; role: Role };

export class ChatError extends Error {}

export const CHAT_PAGE = 50;

const isStaffRole = (role: Role) => role === "admin" || role === "agent";

/** "Marketing Digital" → "marketing-digital" (estilo Slack). */
export function channelSlug(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/^#/, "")
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

/** Todo miembro del equipo pertenece a los canales públicos. */
export async function ensurePublicMembership(userId: number) {
  const db = await getDb();
  const publics = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(eq(conversations.kind, "channel"), eq(conversations.isPrivate, false)));
  if (publics.length === 0) return;
  await db
    .insert(conversationMembers)
    .values(publics.map((c) => ({ conversationId: c.id, userId })))
    .onConflictDoNothing();
}

async function loadConversation(user: Actor, conversationId: number) {
  if (!isStaffRole(user.role)) throw new ChatError("El chat es solo para el equipo.");
  const db = await getDb();
  const [conv] = await db.select().from(conversations).where(eq(conversations.id, conversationId));
  if (!conv) throw new ChatError("La conversación no existe.");
  const [member] = await db
    .select()
    .from(conversationMembers)
    .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, user.id)));
  if (!member) {
    if (conv.kind === "channel" && !conv.isPrivate) {
      await db.insert(conversationMembers).values({ conversationId, userId: user.id }).onConflictDoNothing();
    } else {
      throw new ChatError("No perteneces a esta conversación.");
    }
  }
  return conv;
}

export async function listConversations(user: Actor) {
  const db = await getDb();
  await ensurePublicMembership(user.id);
  const other = alias(users, "other");
  const rows = await db
    .select({
      id: conversations.id,
      kind: conversations.kind,
      name: conversations.name,
      description: conversations.description,
      isPrivate: conversations.isPrivate,
      lastMessageAt: conversations.lastMessageAt,
      unread: sql<number>`(select count(*)::int from hd_messages m where m.conversation_id = ${conversations.id}
        and m.created_at > ${conversationMembers.lastReadAt} and m.deleted_at is null
        and (m.author_id is null or m.author_id <> ${user.id}))`,
      otherId: other.id,
      otherName: other.name,
      otherActive: other.active,
      members: sql<number>`(select count(*)::int from hd_conversation_members cm where cm.conversation_id = ${conversations.id})`,
    })
    .from(conversationMembers)
    .innerJoin(conversations, eq(conversations.id, conversationMembers.conversationId))
    .leftJoin(
      other,
      and(
        eq(conversations.kind, "dm"),
        ne(other.id, user.id),
        sql`${other.id} in (select cm2.user_id from hd_conversation_members cm2 where cm2.conversation_id = ${conversations.id})`
      )
    )
    .where(eq(conversationMembers.userId, user.id))
    .orderBy(desc(conversations.lastMessageAt));

  return {
    channels: rows.filter((r) => r.kind === "channel").sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "")),
    dms: rows.filter((r) => r.kind === "dm"),
  };
}

export type ConversationItem = Awaited<ReturnType<typeof listConversations>>["channels"][number];

export async function unreadTotal(user: Actor) {
  if (!isStaffRole(user.role)) return 0;
  const db = await getDb();
  const [row] = await db
    .select({
      n: sql<number>`coalesce(sum((select count(*) from hd_messages m where m.conversation_id = ${conversationMembers.conversationId}
        and m.created_at > ${conversationMembers.lastReadAt} and m.deleted_at is null
        and (m.author_id is null or m.author_id <> ${user.id}))), 0)::int`,
    })
    .from(conversationMembers)
    .where(eq(conversationMembers.userId, user.id));
  return row?.n ?? 0;
}

export async function getConversationInfo(user: Actor, conversationId: number) {
  const conv = await loadConversation(user, conversationId);
  const db = await getDb();
  const members = await db
    .select({ id: users.id, name: users.name, email: users.email, role: users.role, department: users.department })
    .from(conversationMembers)
    .innerJoin(users, eq(users.id, conversationMembers.userId))
    .where(eq(conversationMembers.conversationId, conversationId))
    .orderBy(asc(users.name));
  const otherMember = conv.kind === "dm" ? members.find((m) => m.id !== user.id) ?? null : null;
  return { conversation: conv, members, other: otherMember };
}

export type ChatMessage = {
  id: number;
  authorId: number | null;
  authorName: string | null;
  body: string;
  createdAt: Date;
  editedAt: Date | null;
  deletedAt: Date | null;
  updatedAt: Date;
  reactions: Array<{ emoji: string; userIds: number[]; names: string[] }>;
  files: Array<{ id: string; filename: string; mime: string; size: number }>;
};

async function hydrate(rows: Array<Omit<ChatMessage, "reactions" | "files">>): Promise<ChatMessage[]> {
  if (rows.length === 0) return [];
  const db = await getDb();
  const ids = rows.map((r) => r.id);
  const [reacts, files] = await Promise.all([
    db
      .select({ messageId: messageReactions.messageId, emoji: messageReactions.emoji, userId: users.id, name: users.name })
      .from(messageReactions)
      .innerJoin(users, eq(users.id, messageReactions.userId))
      .where(inArray(messageReactions.messageId, ids)),
    db
      .select({ id: messageFiles.id, messageId: messageFiles.messageId, filename: messageFiles.filename, mime: messageFiles.mime, size: messageFiles.size })
      .from(messageFiles)
      .where(inArray(messageFiles.messageId, ids)),
  ]);
  return rows.map((r) => {
    const mine = reacts.filter((x) => x.messageId === r.id);
    const grouped = new Map<string, { emoji: string; userIds: number[]; names: string[] }>();
    for (const x of mine) {
      const g = grouped.get(x.emoji) ?? { emoji: x.emoji, userIds: [], names: [] };
      g.userIds.push(x.userId);
      g.names.push(x.name);
      grouped.set(x.emoji, g);
    }
    return {
      ...r,
      body: r.deletedAt ? "" : r.body,
      reactions: r.deletedAt ? [] : Array.from(grouped.values()),
      files: r.deletedAt ? [] : files.filter((f) => f.messageId === r.id).map((f) => ({ id: f.id, filename: f.filename, mime: f.mime, size: f.size })),
    };
  });
}

const author = alias(users, "author");
const messageColumns = {
  id: messages.id,
  authorId: messages.authorId,
  authorName: author.name,
  body: messages.body,
  createdAt: messages.createdAt,
  editedAt: messages.editedAt,
  deletedAt: messages.deletedAt,
  updatedAt: messages.updatedAt,
};

export async function getMessages(user: Actor, conversationId: number, beforeId?: number) {
  await loadConversation(user, conversationId);
  const db = await getDb();
  const rows = await db
    .select(messageColumns)
    .from(messages)
    .leftJoin(author, eq(author.id, messages.authorId))
    .where(and(eq(messages.conversationId, conversationId), beforeId ? lt(messages.id, beforeId) : undefined))
    .orderBy(desc(messages.id))
    .limit(CHAT_PAGE);
  return { messages: await hydrate(rows.reverse()), hasMore: rows.length === CHAT_PAGE };
}

/** Mensajes nuevos o modificados (editados, borrados, reacciones) desde la última consulta. */
export async function getChanges(user: Actor, conversationId: number, since: Date, afterId: number) {
  await loadConversation(user, conversationId);
  const db = await getDb();
  const rows = await db
    .select(messageColumns)
    .from(messages)
    .leftJoin(author, eq(author.id, messages.authorId))
    .where(and(eq(messages.conversationId, conversationId), or(gt(messages.id, afterId), gt(messages.updatedAt, since))))
    .orderBy(asc(messages.id))
    .limit(200);
  return hydrate(rows);
}

export async function markRead(user: Actor, conversationId: number) {
  const db = await getDb();
  await db
    .update(conversationMembers)
    .set({ lastReadAt: new Date() })
    .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, user.id)));
}

export async function sendMessage(user: Actor, conversationId: number, body: string, files: File[] = []) {
  await loadConversation(user, conversationId);
  const text = body.trim();
  const real = files.filter((f) => f && f.size > 0);
  if (!text && real.length === 0) throw new ChatError("Escribe un mensaje.");
  if (text.length > 8000) throw new ChatError("El mensaje es demasiado largo.");
  if (real.length > MAX_FILES) throw new ChatError(`Máximo ${MAX_FILES} archivos por mensaje.`);
  for (const f of real) if (f.size > MAX_FILE_BYTES) throw new ChatError(`"${f.name}" supera 10 MB.`);
  const db = await getDb();
  const now = new Date();
  const [msg] = await db.insert(messages).values({ conversationId, authorId: user.id, body: text, createdAt: now, updatedAt: now }).returning();
  for (const f of real) {
    await db.insert(messageFiles).values({
      messageId: msg.id,
      filename: f.name.slice(0, 200) || "archivo",
      mime: f.type || "application/octet-stream",
      size: f.size,
      data: Buffer.from(await f.arrayBuffer()),
    });
  }
  await db.update(conversations).set({ lastMessageAt: now }).where(eq(conversations.id, conversationId));
  await markRead(user, conversationId);
  await pushForMessage(user.id, conversationId, text || "📎 Archivo adjunto").catch((e) => console.error("[mesa-de-ayuda] Error en push de chat:", e));
  return msg;
}

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

/** Push: en mensajes directos al otro; en canales solo a quien mencionan con @Nombre. */
async function pushForMessage(authorId: number, conversationId: number, text: string) {
  const db = await getDb();
  const [conv] = await db.select().from(conversations).where(eq(conversations.id, conversationId));
  const members = await db
    .select({ id: users.id, name: users.name })
    .from(conversationMembers)
    .innerJoin(users, eq(users.id, conversationMembers.userId))
    .where(eq(conversationMembers.conversationId, conversationId));
  const author = members.find((m) => m.id === authorId)?.name ?? "Alguien";
  const url = `/chat/${conversationId}`;
  if (conv?.kind === "dm") {
    const others = members.filter((m) => m.id !== authorId).map((m) => m.id);
    await sendPush(others, { title: author, body: text.slice(0, 160), url, tag: url });
    return;
  }
  const body = fold(text);
  const mentioned = members.filter((m) => m.id !== authorId && (body.includes(`@${fold(m.name.split(" ")[0])}`) || body.includes("@todos") || body.includes("@channel")));
  if (mentioned.length) {
    await sendPush(
      mentioned.map((m) => m.id),
      { title: `${author} te mencionó en #${conv?.name}`, body: text.slice(0, 160), url, tag: url }
    );
  }
}

async function ownMessage(user: Actor, messageId: number) {
  const db = await getDb();
  const [msg] = await db.select().from(messages).where(eq(messages.id, messageId));
  if (!msg) throw new ChatError("El mensaje no existe.");
  await loadConversation(user, msg.conversationId);
  return msg;
}

export async function editMessage(user: Actor, messageId: number, body: string) {
  const msg = await ownMessage(user, messageId);
  if (msg.authorId !== user.id) throw new ChatError("Solo puedes editar tus mensajes.");
  if (msg.deletedAt) throw new ChatError("El mensaje fue eliminado.");
  const text = body.trim();
  if (!text) throw new ChatError("El mensaje no puede quedar vacío.");
  const db = await getDb();
  const now = new Date();
  await db.update(messages).set({ body: text.slice(0, 8000), editedAt: now, updatedAt: now }).where(eq(messages.id, messageId));
}

export async function deleteMessage(user: Actor, messageId: number) {
  const msg = await ownMessage(user, messageId);
  if (msg.authorId !== user.id && user.role !== "admin") throw new ChatError("Solo puedes eliminar tus mensajes.");
  const db = await getDb();
  const now = new Date();
  await db.update(messages).set({ deletedAt: now, body: "", updatedAt: now }).where(eq(messages.id, messageId));
  await db.delete(messageFiles).where(eq(messageFiles.messageId, messageId));
}

export async function toggleReaction(user: Actor, messageId: number, emoji: string) {
  const msg = await ownMessage(user, messageId);
  if (msg.deletedAt) return;
  const e = emoji.slice(0, 16);
  const db = await getDb();
  const where = and(eq(messageReactions.messageId, messageId), eq(messageReactions.userId, user.id), eq(messageReactions.emoji, e));
  const [existing] = await db.select().from(messageReactions).where(where);
  if (existing) await db.delete(messageReactions).where(where);
  else await db.insert(messageReactions).values({ messageId, userId: user.id, emoji: e });
  await db.update(messages).set({ updatedAt: new Date() }).where(eq(messages.id, messageId));
}

export async function openDirect(user: Actor, otherId: number) {
  if (!isStaffRole(user.role)) throw new ChatError("El chat es solo para el equipo.");
  if (otherId === user.id) throw new ChatError("Elige a otra persona.");
  const db = await getDb();
  const [other] = await db.select().from(users).where(eq(users.id, otherId));
  if (!other || !other.active || !isStaffRole(other.role)) throw new ChatError("Esa persona no está en el equipo.");
  const key = [user.id, otherId].sort((a, b) => a - b).join(":");
  const [existing] = await db.select().from(conversations).where(eq(conversations.dmKey, key));
  if (existing) return existing.id;
  const [conv] = await db.insert(conversations).values({ kind: "dm", dmKey: key, createdBy: user.id }).returning();
  await db.insert(conversationMembers).values([
    { conversationId: conv.id, userId: user.id },
    { conversationId: conv.id, userId: otherId },
  ]);
  return conv.id;
}

export async function createChannel(
  user: Actor,
  input: { name: string; description?: string; isPrivate: boolean; memberIds: number[] }
) {
  if (!isStaffRole(user.role)) throw new ChatError("El chat es solo para el equipo.");
  const name = channelSlug(input.name);
  if (name.length < 2) throw new ChatError("Escribe un nombre para el canal.");
  const db = await getDb();
  const [dup] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(eq(conversations.kind, "channel"), eq(conversations.name, name)));
  if (dup) throw new ChatError(`Ya existe el canal #${name}.`);
  const [conv] = await db
    .insert(conversations)
    .values({ kind: "channel", name, description: input.description?.trim() || null, isPrivate: input.isPrivate, createdBy: user.id })
    .returning();
  let memberIds = [user.id, ...input.memberIds];
  if (!input.isPrivate) {
    const staff = await db.select({ id: users.id }).from(users).where(and(eq(users.active, true), inArray(users.role, ["admin", "agent"])));
    memberIds = staff.map((s) => s.id);
  }
  const valid = await db
    .select({ id: users.id })
    .from(users)
    .where(and(inArray(users.id, Array.from(new Set(memberIds))), inArray(users.role, ["admin", "agent"])));
  await db
    .insert(conversationMembers)
    .values(valid.map((v) => ({ conversationId: conv.id, userId: v.id })))
    .onConflictDoNothing();
  await audit(user.id, "crear", "canal", conv.id, `Canal ${input.isPrivate ? "privado" : "público"} creado: #${name}`);
  return conv.id;
}

export async function updateChannel(user: Actor, conversationId: number, input: { description?: string; addIds?: number[]; removeIds?: number[] }) {
  const conv = await loadConversation(user, conversationId);
  if (conv.kind !== "channel") throw new ChatError("Solo los canales tienen configuración.");
  const canManage = user.role === "admin" || conv.createdBy === user.id;
  const db = await getDb();
  if (input.description !== undefined) {
    await db.update(conversations).set({ description: input.description.trim() || null }).where(eq(conversations.id, conversationId));
  }
  if (input.addIds?.length) {
    const valid = await db
      .select({ id: users.id })
      .from(users)
      .where(and(inArray(users.id, input.addIds), eq(users.active, true), inArray(users.role, ["admin", "agent"])));
    if (valid.length) {
      await db
        .insert(conversationMembers)
        .values(valid.map((v) => ({ conversationId, userId: v.id })))
        .onConflictDoNothing();
    }
  }
  if (input.removeIds?.length) {
    if (!canManage) throw new ChatError("Solo quien creó el canal o el líder puede quitar miembros.");
    if (!conv.isPrivate) throw new ChatError("En los canales públicos está todo el equipo.");
    await db
      .delete(conversationMembers)
      .where(and(eq(conversationMembers.conversationId, conversationId), inArray(conversationMembers.userId, input.removeIds)));
    await audit(user.id, "quitar_miembros", "canal", conversationId, `Miembros retirados de #${conv.name}`, { userIds: input.removeIds });
  }
}

export async function leaveChannel(user: Actor, conversationId: number) {
  const conv = await loadConversation(user, conversationId);
  if (conv.kind !== "channel" || !conv.isPrivate) throw new ChatError("Solo puedes salir de canales privados.");
  const db = await getDb();
  await db
    .delete(conversationMembers)
    .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, user.id)));
}

export async function getChatFile(user: Actor, fileId: string) {
  const db = await getDb();
  const [row] = await db
    .select({ file: messageFiles, conversationId: messages.conversationId, deletedAt: messages.deletedAt })
    .from(messageFiles)
    .innerJoin(messages, eq(messages.id, messageFiles.messageId))
    .where(eq(messageFiles.id, fileId));
  if (!row || row.deletedAt) return null;
  try {
    await loadConversation(user, row.conversationId);
  } catch {
    return null;
  }
  return row.file;
}

export async function getTeamForChat(user: Actor) {
  const db = await getDb();
  return db
    .select({ id: users.id, name: users.name, department: users.department })
    .from(users)
    .where(and(eq(users.active, true), inArray(users.role, ["admin", "agent"]), ne(users.id, user.id)))
    .orderBy(asc(users.name));
}
