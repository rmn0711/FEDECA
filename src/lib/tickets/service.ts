import "server-only";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { attachments, categories, ticketEvents, tickets, users } from "@/lib/db/schema";
import { getCategory, type CategoryDef } from "@/lib/categories";
import {
  MAX_FILE_BYTES,
  MAX_FILES,
  STATUS_META,
  STATUSES,
  URGENCIES,
  URGENCY_META,
  addBusinessHours,
  type Role,
  type Status,
  type Urgency,
} from "@/lib/constants";
import { canManageTicket, canViewTicket, TicketError } from "./access";
import { queueNotification, splitEmails } from "./notifications";

type Actor = { id: number; role: Role };

/** Vencimientos de primera respuesta y solución según la prioridad (en horas hábiles). */
export function slaDates(createdAt: Date, urgency: Urgency) {
  return {
    responseDueAt: addBusinessHours(createdAt, URGENCY_META[urgency].responseHours),
    dueAt: addBusinessHours(createdAt, URGENCY_META[urgency].slaHours),
  };
}

export type CreateTicketInput = {
  categorySlug: string;
  title: string;
  description: string;
  urgency: string;
  fields: Record<string, string | string[]>;
  ccEmails?: string;
};

/** Valida los campos específicos de la categoría y devuelve solo los conocidos. */
export function validateCategoryFields(def: CategoryDef, raw: Record<string, string | string[]>) {
  const clean: Record<string, string | string[]> = {};
  for (const field of def.fields) {
    const value = raw[field.key];
    if (field.type === "multiselect") {
      const list = (Array.isArray(value) ? value : value ? [value] : []).filter((v) => field.options?.includes(v));
      if (field.required && list.length === 0) throw new TicketError(`Seleccione al menos una opción en "${field.label}".`);
      if (list.length) clean[field.key] = list;
      continue;
    }
    const text = (Array.isArray(value) ? value[0] : value)?.toString().trim() ?? "";
    if (!text) {
      if (field.required) throw new TicketError(`El campo "${field.label}" es obligatorio.`);
      continue;
    }
    if (text.length > 4000) throw new TicketError(`El campo "${field.label}" es demasiado largo.`);
    if (field.type === "select" && !field.options?.includes(text)) {
      throw new TicketError(`Seleccione una opción válida en "${field.label}".`);
    }
    if (field.type === "number" && !Number.isFinite(Number(text))) {
      throw new TicketError(`"${field.label}" debe ser un número.`);
    }
    if (field.type === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      throw new TicketError(`"${field.label}" no es una fecha válida.`);
    }
    if (field.type === "datetime" && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(text)) {
      throw new TicketError(`"${field.label}" no es una fecha y hora válida.`);
    }
    clean[field.key] = text;
  }
  return clean;
}

function validateFiles(files: File[]) {
  const real = files.filter((f) => f && f.size > 0);
  if (real.length > MAX_FILES) throw new TicketError(`Puede adjuntar máximo ${MAX_FILES} archivos.`);
  for (const f of real) {
    if (f.size > MAX_FILE_BYTES) throw new TicketError(`"${f.name}" supera el tamaño máximo de 10 MB.`);
  }
  return real;
}

function validateCc(value: string | undefined) {
  const list = splitEmails(value);
  for (const e of list) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new TicketError(`"${e}" no es un correo válido.`);
  }
  if (list.length > 10) throw new TicketError("Máximo 10 correos en copia.");
  return list.length ? list.join(", ") : null;
}

async function saveFiles(ticketId: number, eventId: number, userId: number, files: File[]) {
  if (files.length === 0) return;
  const db = await getDb();
  for (const f of files) {
    await db.insert(attachments).values({
      ticketId,
      eventId,
      filename: f.name.slice(0, 200) || "archivo",
      mime: f.type || "application/octet-stream",
      size: f.size,
      data: Buffer.from(await f.arrayBuffer()),
      uploadedBy: userId,
    });
  }
}

export async function createTicket(user: Actor, input: CreateTicketInput, files: File[] = []) {
  const def = getCategory(input.categorySlug);
  if (!def) throw new TicketError("Seleccione una categoría válida.");
  const title = input.title.trim();
  const description = input.description.trim();
  if (title.length < 5) throw new TicketError("El asunto debe tener al menos 5 caracteres.");
  if (title.length > 160) throw new TicketError("El asunto no puede superar 160 caracteres.");
  if (description.length < 10) throw new TicketError("Describa su solicitud con al menos 10 caracteres.");
  if (!URGENCIES.includes(input.urgency as Urgency)) throw new TicketError("Seleccione la prioridad.");
  const urgency = input.urgency as Urgency;
  const fields = validateCategoryFields(def, input.fields);
  const ccEmails = validateCc(input.ccEmails);
  const realFiles = validateFiles(files);

  const db = await getDb();
  const [category] = await db.select().from(categories).where(eq(categories.slug, def.slug));
  if (!category?.active) throw new TicketError("Esta categoría no está disponible en este momento.");

  const now = new Date();
  const [ticket] = await db
    .insert(tickets)
    .values({
      title,
      description,
      categorySlug: def.slug,
      urgency,
      requesterId: user.id,
      assigneeId: category.responsibleId,
      fields,
      ccEmails,
      ...slaDates(now, urgency),
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  const [event] = await db
    .insert(ticketEvents)
    .values({ ticketId: ticket.id, authorId: user.id, type: "created", body: null })
    .returning();
  await saveFiles(ticket.id, event.id, user.id, realFiles);

  queueNotification(ticket.id, { kind: "created" });
  return ticket;
}

async function loadForAction(ticketId: number) {
  const db = await getDb();
  const [row] = await db
    .select({ ticket: tickets, responsibleId: categories.responsibleId })
    .from(tickets)
    .innerJoin(categories, eq(categories.slug, tickets.categorySlug))
    .where(eq(tickets.id, ticketId));
  if (!row) throw new TicketError("La solicitud no existe.");
  return row;
}

export async function addComment(
  user: Actor,
  ticketId: number,
  input: { body: string; internal?: boolean; source?: "web" | "email" },
  files: File[] = []
) {
  const { ticket, responsibleId } = await loadForAction(ticketId);
  if (!canViewTicket(user, ticket, responsibleId)) throw new TicketError("No tiene acceso a esta solicitud.");
  const manage = canManageTicket(user, ticket, responsibleId);
  const internal = Boolean(input.internal);
  if (internal && !manage) throw new TicketError("Solo el equipo responsable puede escribir notas internas.");
  const body = input.body.trim();
  if (!body) throw new TicketError("Escriba un mensaje.");
  if (body.length > 10000) throw new TicketError("El mensaje es demasiado largo.");
  const realFiles = validateFiles(files);

  const db = await getDb();
  const now = new Date();
  const [event] = await db
    .insert(ticketEvents)
    .values({
      ticketId,
      authorId: user.id,
      type: internal ? "note" : "comment",
      body,
      source: input.source ?? "web",
      createdAt: now,
    })
    .returning();
  await saveFiles(ticketId, event.id, user.id, realFiles);

  const patch: Partial<typeof tickets.$inferInsert> = { updatedAt: now };
  let newStatus: Status | null = null;
  const isRequester = user.id === ticket.requesterId;

  if (!internal && !isRequester) {
    if (!ticket.firstResponseAt) patch.firstResponseAt = now;
    if (ticket.status === "abierto") newStatus = "en_progreso";
  }
  if (!internal && isRequester) {
    if (ticket.status === "en_espera") newStatus = "en_progreso";
    // Si el solicitante responde una solicitud resuelta o cerrada, se reabre.
    if (ticket.status === "resuelto" || ticket.status === "cerrado") newStatus = "abierto";
  }
  if (newStatus) {
    patch.status = newStatus;
    if (newStatus === "abierto") {
      patch.resolvedAt = null;
      patch.closedAt = null;
    }
    await db.insert(ticketEvents).values({
      ticketId,
      authorId: null,
      type: "status",
      meta: { from: ticket.status, to: newStatus, auto: true },
      createdAt: new Date(now.getTime() + 1),
    });
  }
  await db.update(tickets).set(patch).where(eq(tickets.id, ticketId));

  queueNotification(
    ticketId,
    internal
      ? { kind: "note", authorId: user.id, body }
      : { kind: "comment", authorId: user.id, body, viaEmail: input.source === "email" }
  );
  return event;
}

export async function changeStatus(user: Actor, ticketId: number, status: string, comment?: string | null) {
  if (!STATUSES.includes(status as Status)) throw new TicketError("Estado no válido.");
  const to = status as Status;
  const { ticket, responsibleId } = await loadForAction(ticketId);
  if (!canViewTicket(user, ticket, responsibleId)) throw new TicketError("No tiene acceso a esta solicitud.");
  const manage = canManageTicket(user, ticket, responsibleId);
  const isRequester = user.id === ticket.requesterId;
  const requesterAllowed =
    isRequester &&
    ((to === "cerrado" && ticket.status !== "cerrado") ||
      (to === "abierto" && (ticket.status === "resuelto" || ticket.status === "cerrado")));
  if (!manage && !requesterAllowed) throw new TicketError("No tiene permiso para cambiar el estado.");
  if (ticket.status === to) return;
  if (to === "resuelto" && !comment?.trim() && manage) {
    throw new TicketError("Describa la solución entregada antes de marcar como resuelta.");
  }
  if (to === "abierto" && isRequester && !manage && !comment?.trim()) {
    throw new TicketError("Indique por qué reabre la solicitud.");
  }

  const db = await getDb();
  const now = new Date();
  const patch: Partial<typeof tickets.$inferInsert> = { status: to, updatedAt: now };
  if (to === "resuelto") patch.resolvedAt = now;
  if (to === "cerrado") {
    patch.closedAt = now;
    if (!ticket.resolvedAt) patch.resolvedAt = now;
  }
  if (to === "abierto" || to === "en_progreso" || to === "en_espera") {
    patch.resolvedAt = null;
    patch.closedAt = null;
  }
  if (manage && !isRequester && !ticket.firstResponseAt && comment?.trim()) patch.firstResponseAt = now;

  await db.update(tickets).set(patch).where(eq(tickets.id, ticketId));
  await db.insert(ticketEvents).values({
    ticketId,
    authorId: user.id,
    type: "status",
    body: comment?.trim() || null,
    meta: { from: ticket.status, to },
  });
  queueNotification(ticketId, { kind: "status", authorId: user.id, from: ticket.status, to, comment: comment?.trim() });
}

export async function assignTicket(user: Actor, ticketId: number, assigneeId: number | null) {
  const { ticket, responsibleId } = await loadForAction(ticketId);
  if (!canManageTicket(user, ticket, responsibleId)) throw new TicketError("No tiene permiso para asignar.");
  if (ticket.assigneeId === assigneeId) return;
  const db = await getDb();
  let assigneeName: string | null = null;
  if (assigneeId !== null) {
    const [a] = await db.select().from(users).where(and(eq(users.id, assigneeId), eq(users.active, true)));
    if (!a || a.role === "user") throw new TicketError("Solo se puede asignar a responsables o administradores activos.");
    assigneeName = a.name;
  }
  await db.update(tickets).set({ assigneeId, updatedAt: new Date() }).where(eq(tickets.id, ticketId));
  await db.insert(ticketEvents).values({
    ticketId,
    authorId: user.id,
    type: "assign",
    meta: { assigneeId, assigneeName },
  });
  if (assigneeId !== null) queueNotification(ticketId, { kind: "assign", authorId: user.id });
}

export async function changeUrgency(user: Actor, ticketId: number, urgency: string) {
  if (!URGENCIES.includes(urgency as Urgency)) throw new TicketError("Prioridad no válida.");
  const { ticket, responsibleId } = await loadForAction(ticketId);
  if (!canManageTicket(user, ticket, responsibleId)) throw new TicketError("No tiene permiso para cambiar la prioridad.");
  if (ticket.urgency === urgency) return;
  const db = await getDb();
  const u = urgency as Urgency;
  await db
    .update(tickets)
    .set({ urgency: u, ...slaDates(ticket.createdAt, u), updatedAt: new Date() })
    .where(eq(tickets.id, ticketId));
  await db.insert(ticketEvents).values({
    ticketId,
    authorId: user.id,
    type: "urgency",
    meta: { from: ticket.urgency, to: u },
  });
}

export async function changeCategory(user: Actor, ticketId: number, slug: string) {
  const def = getCategory(slug);
  if (!def) throw new TicketError("Categoría no válida.");
  const { ticket, responsibleId } = await loadForAction(ticketId);
  if (!canManageTicket(user, ticket, responsibleId)) throw new TicketError("No tiene permiso para recategorizar.");
  if (ticket.categorySlug === slug) return;
  const db = await getDb();
  const [category] = await db.select().from(categories).where(eq(categories.slug, slug));
  await db
    .update(tickets)
    .set({ categorySlug: slug, assigneeId: category?.responsibleId ?? null, updatedAt: new Date() })
    .where(eq(tickets.id, ticketId));
  await db.insert(ticketEvents).values({
    ticketId,
    authorId: user.id,
    type: "category",
    meta: { from: ticket.categorySlug, to: slug },
  });
  if (category?.responsibleId) queueNotification(ticketId, { kind: "assign", authorId: user.id });
}

export async function rateTicket(user: Actor, ticketId: number, rating: number, comment?: string | null) {
  const { ticket } = await loadForAction(ticketId);
  if (ticket.requesterId !== user.id) throw new TicketError("Solo quien registró la solicitud puede calificarla.");
  if (ticket.status !== "resuelto" && ticket.status !== "cerrado") {
    throw new TicketError("Solo se pueden calificar solicitudes resueltas.");
  }
  if (ticket.rating) throw new TicketError("Esta solicitud ya fue calificada.");
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new TicketError("Seleccione de 1 a 5 estrellas.");
  const db = await getDb();
  const now = new Date();
  await db
    .update(tickets)
    .set({
      rating,
      ratingComment: comment?.trim() || null,
      status: "cerrado",
      closedAt: ticket.closedAt ?? now,
      updatedAt: now,
    })
    .where(eq(tickets.id, ticketId));
  await db.insert(ticketEvents).values({
    ticketId,
    authorId: user.id,
    type: "rating",
    body: comment?.trim() || null,
    meta: { rating, from: ticket.status, to: "cerrado" },
  });
  queueNotification(ticketId, { kind: "rating", rating, comment });
}

export function statusLabel(s: Status) {
  return STATUS_META[s].label;
}
