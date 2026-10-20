"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import {
  ChatError,
  createChannel,
  deleteMessage,
  editMessage,
  getChanges,
  getMessages,
  leaveChannel,
  listConversations,
  markRead,
  openDirect,
  sendMessage,
  toggleReaction,
  unreadTotal,
  updateChannel,
  type ChatMessage,
} from "@/lib/chat/service";

type Result<T = null> = { ok: true; data: T } | { ok: false; error: string };

async function run<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof ChatError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: "Ocurrió un error inesperado." };
  }
}

const staff = () => requireRole("admin", "agent");

export async function sendMessageAction(formData: FormData): Promise<Result<{ id: number }>> {
  const me = await staff();
  const conversationId = Number(formData.get("conversationId"));
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  return run(async () => {
    const msg = await sendMessage(me, conversationId, String(formData.get("body") ?? ""), files);
    return { id: msg.id };
  });
}

/** Consulta periódica del chat: mensajes nuevos/modificados y lista de conversaciones con no leídos. */
export async function pollChatAction(
  conversationId: number | null,
  since: string,
  afterId: number,
  visible: boolean,
  includeList = false
): Promise<Result<{ changes: ChatMessage[]; serverTime: string; conversations: Awaited<ReturnType<typeof listConversations>> | null }>> {
  const me = await staff();
  return run(async () => {
    const serverTime = new Date();
    const changes = conversationId ? await getChanges(me, conversationId, new Date(since), afterId) : [];
    if (conversationId && visible) await markRead(me, conversationId);
    return { changes, serverTime: serverTime.toISOString(), conversations: includeList ? await listConversations(me) : null };
  });
}

export async function loadOlderAction(conversationId: number, beforeId: number) {
  const me = await staff();
  return run(() => getMessages(me, conversationId, beforeId));
}

export async function editMessageAction(messageId: number, body: string) {
  const me = await staff();
  return run(() => editMessage(me, messageId, body));
}

export async function deleteMessageAction(messageId: number) {
  const me = await staff();
  return run(() => deleteMessage(me, messageId));
}

export async function toggleReactionAction(messageId: number, emoji: string) {
  const me = await staff();
  return run(() => toggleReaction(me, messageId, emoji));
}

export async function openDirectAction(otherId: number) {
  const me = await staff();
  return run(() => openDirect(me, otherId));
}

export async function createChannelAction(input: { name: string; description?: string; isPrivate: boolean; memberIds: number[] }) {
  const me = await staff();
  const r = await run(() => createChannel(me, input));
  if (r.ok) revalidatePath("/chat", "layout");
  return r;
}

export async function updateChannelAction(conversationId: number, input: { description?: string; addIds?: number[]; removeIds?: number[] }) {
  const me = await staff();
  const r = await run(() => updateChannel(me, conversationId, input));
  if (r.ok) revalidatePath(`/chat/${conversationId}`);
  return r;
}

export async function leaveChannelAction(conversationId: number) {
  const me = await staff();
  const r = await run(() => leaveChannel(me, conversationId));
  if (r.ok) revalidatePath("/chat", "layout");
  return r;
}

export async function unreadCountAction(): Promise<number> {
  const me = await requireRole("admin", "agent");
  return unreadTotal(me);
}
