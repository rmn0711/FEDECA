import "server-only";
import { and, asc, desc, eq, gte, ilike, inArray, isNotNull, ne, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb } from "@/lib/db";
import { attachments, categories, emailLog, settings, ticketEvents, tickets, users } from "@/lib/db/schema";
import { OPEN_STATUSES, STATUSES, URGENCIES, type Role, type Status, type Urgency } from "@/lib/constants";
import { canManageTicket, canViewTicket } from "./access";

type Actor = { id: number; role: Role };

const requester = alias(users, "requester");
const assignee = alias(users, "assignee");
const responsible = alias(users, "responsible");

/** Condición de visibilidad según el rol. */
function visibility(user: Actor): SQL | undefined {
  if (user.role === "admin") return undefined;
  if (user.role === "agent") {
    return or(
      eq(tickets.requesterId, user.id),
      eq(tickets.assigneeId, user.id),
      eq(categories.responsibleId, user.id)
    );
  }
  return eq(tickets.requesterId, user.id);
}

export type TicketFilters = {
  vista?: string;
  estado?: string;
  categoria?: string;
  prioridad?: string;
  responsable?: string;
  q?: string;
  pagina?: string;
};

export const PAGE_SIZE = 20;

export async function listTickets(user: Actor, f: TicketFilters) {
  const db = await getDb();
  const conds: (SQL | undefined)[] = [visibility(user)];

  if (f.vista === "mias") conds.push(eq(tickets.requesterId, user.id));
  if (f.vista === "asignadas") conds.push(eq(tickets.assigneeId, user.id));
  if (f.vista === "sin-asignar") conds.push(sql`${tickets.assigneeId} is null`);
  if (f.vista === "vencidas") {
    conds.push(inArray(tickets.status, OPEN_STATUSES), sql`${tickets.dueAt} < now()`);
  }

  if (f.estado === "abiertas" || !f.estado) conds.push(inArray(tickets.status, OPEN_STATUSES));
  else if (STATUSES.includes(f.estado as Status)) conds.push(eq(tickets.status, f.estado as Status));
  // f.estado === "todas" → sin filtro

  if (f.categoria) conds.push(eq(tickets.categorySlug, f.categoria));
  if (f.prioridad && URGENCIES.includes(f.prioridad as Urgency)) conds.push(eq(tickets.urgency, f.prioridad as Urgency));
  if (f.responsable === "ninguno") conds.push(sql`${tickets.assigneeId} is null`);
  else if (f.responsable && Number(f.responsable)) conds.push(eq(tickets.assigneeId, Number(f.responsable)));

  const q = f.q?.trim();
  if (q) {
    const idMatch = /^(?:hd-)?0*(\d+)$/i.exec(q);
    conds.push(
      or(
        ilike(tickets.title, `%${q}%`),
        ilike(tickets.description, `%${q}%`),
        ilike(requester.name, `%${q}%`),
        idMatch ? eq(tickets.id, Number(idMatch[1])) : undefined
      )
    );
  }

  const where = and(...conds);
  const page = Math.max(1, Number(f.pagina) || 1);

  const base = db
    .select({
      id: tickets.id,
      title: tickets.title,
      categorySlug: tickets.categorySlug,
      categoryName: categories.name,
      urgency: tickets.urgency,
      status: tickets.status,
      createdAt: tickets.createdAt,
      updatedAt: tickets.updatedAt,
      responseDueAt: tickets.responseDueAt,
      dueAt: tickets.dueAt,
      firstResponseAt: tickets.firstResponseAt,
      resolvedAt: tickets.resolvedAt,
      requesterName: requester.name,
      assigneeName: assignee.name,
    })
    .from(tickets)
    .innerJoin(categories, eq(categories.slug, tickets.categorySlug))
    .innerJoin(requester, eq(requester.id, tickets.requesterId))
    .leftJoin(assignee, eq(assignee.id, tickets.assigneeId))
    .where(where);

  const [rows, [{ total }]] = await Promise.all([
    base
      .orderBy(
        sql`case when ${tickets.status} in ('resuelto','cerrado') then 1 else 0 end`,
        sql`case ${tickets.urgency} when 'alta' then 0 when 'media' then 1 else 2 end`,
        asc(tickets.dueAt)
      )
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(tickets)
      .innerJoin(categories, eq(categories.slug, tickets.categorySlug))
      .innerJoin(requester, eq(requester.id, tickets.requesterId))
      .where(where),
  ]);

  return { rows, total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export type TicketListRow = Awaited<ReturnType<typeof listTickets>>["rows"][number];

export async function getTicketDetail(user: Actor, id: number) {
  const db = await getDb();
  const [row] = await db
    .select({
      ticket: tickets,
      category: categories,
      requester: { id: requester.id, name: requester.name, email: requester.email, department: requester.department, phone: requester.phone },
      assignee: { id: assignee.id, name: assignee.name, email: assignee.email },
      responsible: { id: responsible.id, name: responsible.name, email: responsible.email },
    })
    .from(tickets)
    .innerJoin(categories, eq(categories.slug, tickets.categorySlug))
    .innerJoin(requester, eq(requester.id, tickets.requesterId))
    .leftJoin(assignee, eq(assignee.id, tickets.assigneeId))
    .leftJoin(responsible, eq(responsible.id, categories.responsibleId))
    .where(eq(tickets.id, id));
  if (!row) return null;
  const responsibleId = row.category.responsibleId;
  if (!canViewTicket(user, row.ticket, responsibleId)) return null;
  const manage = canManageTicket(user, row.ticket, responsibleId);

  const author = alias(users, "author");
  const events = await db
    .select({
      id: ticketEvents.id,
      type: ticketEvents.type,
      body: ticketEvents.body,
      meta: ticketEvents.meta,
      source: ticketEvents.source,
      createdAt: ticketEvents.createdAt,
      authorId: ticketEvents.authorId,
      authorName: author.name,
      authorRole: author.role,
    })
    .from(ticketEvents)
    .leftJoin(author, eq(author.id, ticketEvents.authorId))
    .where(and(eq(ticketEvents.ticketId, id), manage ? undefined : ne(ticketEvents.type, "note")))
    .orderBy(asc(ticketEvents.createdAt), asc(ticketEvents.id));

  const files = await db
    .select({
      id: attachments.id,
      eventId: attachments.eventId,
      filename: attachments.filename,
      mime: attachments.mime,
      size: attachments.size,
    })
    .from(attachments)
    .where(eq(attachments.ticketId, id))
    .orderBy(asc(attachments.createdAt));

  const visibleEventIds = new Set(events.map((e) => e.id));
  return {
    ...row,
    events,
    attachments: files.filter((f) => f.eventId === null || visibleEventIds.has(f.eventId)),
    canManage: manage,
    isRequester: row.ticket.requesterId === user.id,
  };
}

export type TicketDetail = NonNullable<Awaited<ReturnType<typeof getTicketDetail>>>;

export async function getAttachmentForUser(user: Actor, attachmentId: string) {
  const db = await getDb();
  const [row] = await db
    .select({ file: attachments, ticket: tickets, responsibleId: categories.responsibleId, eventType: ticketEvents.type })
    .from(attachments)
    .innerJoin(tickets, eq(tickets.id, attachments.ticketId))
    .innerJoin(categories, eq(categories.slug, tickets.categorySlug))
    .leftJoin(ticketEvents, eq(ticketEvents.id, attachments.eventId))
    .where(eq(attachments.id, attachmentId));
  if (!row) return null;
  if (!canViewTicket(user, row.ticket, row.responsibleId)) return null;
  if (row.eventType === "note" && !canManageTicket(user, row.ticket, row.responsibleId)) return null;
  return row.file;
}

/** Responsables y administradores activos (para asignar). */
export async function getStaff() {
  const db = await getDb();
  return db
    .select({ id: users.id, name: users.name, email: users.email, role: users.role })
    .from(users)
    .where(and(eq(users.active, true), inArray(users.role, ["admin", "agent"])))
    .orderBy(asc(users.name));
}

export async function getCategoriesWithResponsible() {
  const db = await getDb();
  return db
    .select({
      slug: categories.slug,
      name: categories.name,
      active: categories.active,
      ccEmails: categories.ccEmails,
      sort: categories.sort,
      responsibleId: categories.responsibleId,
      responsibleName: responsible.name,
      responsibleEmail: responsible.email,
    })
    .from(categories)
    .leftJoin(responsible, eq(responsible.id, categories.responsibleId))
    .orderBy(asc(categories.sort));
}

export async function getDashboard(user: Actor) {
  const db = await getDb();
  const vis = visibility(user);
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(5, 0, 0, 0); // medianoche en Colombia

  const from = () =>
    db
      .select({
        status: tickets.status,
        urgency: tickets.urgency,
        categorySlug: tickets.categorySlug,
        createdAt: tickets.createdAt,
        responseDueAt: tickets.responseDueAt,
        dueAt: tickets.dueAt,
        firstResponseAt: tickets.firstResponseAt,
        resolvedAt: tickets.resolvedAt,
        rating: tickets.rating,
        assigneeId: tickets.assigneeId,
      })
      .from(tickets)
      .innerJoin(categories, eq(categories.slug, tickets.categorySlug));

  // Abiertas (todas) + todo lo creado o resuelto en los últimos 90 días: suficiente para los indicadores.
  const since = new Date(Date.now() - 90 * 86_400_000);
  const rows = await from().where(
    and(vis, or(inArray(tickets.status, OPEN_STATUSES), gte(tickets.createdAt, since), gte(tickets.resolvedAt, since)))
  );

  const now = new Date();
  const open = rows.filter((r) => OPEN_STATUSES.includes(r.status));
  const overdue = open.filter((r) => r.dueAt < now);
  const responseOverdue = open.filter((r) => !r.firstResponseAt && r.responseDueAt < now);
  const resolvedMonth = rows.filter((r) => r.resolvedAt && r.resolvedAt >= monthStart);
  const createdMonth = rows.filter((r) => r.createdAt >= monthStart);
  const resolvedOnTime = resolvedMonth.filter((r) => r.resolvedAt! <= r.dueAt);
  const responded = rows.filter((r) => r.firstResponseAt && r.createdAt >= monthStart);
  const respondedOnTime = responded.filter((r) => r.firstResponseAt! <= r.responseDueAt);
  const rated = rows.filter((r) => r.rating && r.resolvedAt && r.resolvedAt >= since);
  const avgResolutionMs = resolvedMonth.length
    ? resolvedMonth.reduce((acc, r) => acc + (r.resolvedAt!.getTime() - r.createdAt.getTime()), 0) / resolvedMonth.length
    : null;

  const byCategory = new Map<string, { open: number; overdue: number; month: number }>();
  for (const r of rows) {
    const c = byCategory.get(r.categorySlug) ?? { open: 0, overdue: 0, month: 0 };
    if (OPEN_STATUSES.includes(r.status)) c.open++;
    if (OPEN_STATUSES.includes(r.status) && r.dueAt < now) c.overdue++;
    if (r.createdAt >= monthStart) c.month++;
    byCategory.set(r.categorySlug, c);
  }
  const byUrgency = Object.fromEntries(URGENCIES.map((u) => [u, open.filter((r) => r.urgency === u).length])) as Record<
    Urgency,
    number
  >;
  const byStatus = Object.fromEntries(OPEN_STATUSES.map((s) => [s, open.filter((r) => r.status === s).length])) as Record<
    Status,
    number
  >;

  const mine = open.filter((r) => r.assigneeId === user.id).length;

  return {
    open: open.length,
    overdue: overdue.length,
    responseOverdue: responseOverdue.length,
    mine,
    createdMonth: createdMonth.length,
    resolvedMonth: resolvedMonth.length,
    resolutionCompliance: resolvedMonth.length ? Math.round((resolvedOnTime.length / resolvedMonth.length) * 100) : null,
    responseCompliance: responded.length ? Math.round((respondedOnTime.length / responded.length) * 100) : null,
    avgResolutionMs,
    satisfaction: rated.length ? rated.reduce((a, r) => a + (r.rating ?? 0), 0) / rated.length : null,
    ratedCount: rated.length,
    byCategory,
    byUrgency,
    byStatus,
  };
}

export async function getRecentEmails(limit = 100) {
  const db = await getDb();
  return db
    .select({
      id: emailLog.id,
      ticketId: emailLog.ticketId,
      kind: emailLog.kind,
      to: emailLog.to,
      cc: emailLog.cc,
      subject: emailLog.subject,
      status: emailLog.status,
      error: emailLog.error,
      createdAt: emailLog.createdAt,
    })
    .from(emailLog)
    .orderBy(desc(emailLog.createdAt))
    .limit(limit);
}

export async function getEmailHtml(id: number) {
  const db = await getDb();
  const [row] = await db.select({ html: emailLog.html }).from(emailLog).where(eq(emailLog.id, id));
  return row?.html ?? null;
}

export async function getSetting(key: string) {
  const db = await getDb();
  const [row] = await db.select().from(settings).where(eq(settings.key, key));
  return row?.value ?? null;
}

export async function getUsersList() {
  const db = await getDb();
  const open = db
    .select({ requesterId: tickets.requesterId, n: sql<number>`count(*)::int`.as("n") })
    .from(tickets)
    .where(isNotNull(tickets.id))
    .groupBy(tickets.requesterId)
    .as("open_counts");
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      department: users.department,
      phone: users.phone,
      active: users.active,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt,
      tickets: sql<number>`coalesce(${open.n}, 0)`,
    })
    .from(users)
    .leftJoin(open, eq(open.requesterId, users.id))
    .orderBy(asc(users.name));
}
