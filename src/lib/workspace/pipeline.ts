import "server-only";
import { asc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb } from "@/lib/db";
import { categories, tickets, users } from "@/lib/db/schema";
import { ownedTicketsWhere } from "@/lib/alerts";

const requester = alias(users, "requester");

/** Solicitudes del helpdesk por resolver de una persona (asignadas o sin asignar de sus categorías). */
export async function getPipelineTickets(personId: number) {
  const db = await getDb();
  return db
    .select({
      id: tickets.id,
      title: tickets.title,
      categorySlug: tickets.categorySlug,
      categoryName: categories.name,
      urgency: tickets.urgency,
      status: tickets.status,
      createdAt: tickets.createdAt,
      dueAt: tickets.dueAt,
      responseDueAt: tickets.responseDueAt,
      firstResponseAt: tickets.firstResponseAt,
      resolvedAt: tickets.resolvedAt,
      requesterName: requester.name,
      assigneeId: tickets.assigneeId,
      comments: sql<number>`(select count(*)::int from hd_ticket_events e where e.ticket_id = ${tickets.id} and e.type = 'comment')`,
    })
    .from(tickets)
    .innerJoin(categories, eq(categories.slug, tickets.categorySlug))
    .innerJoin(requester, eq(requester.id, tickets.requesterId))
    .where(ownedTicketsWhere(personId))
    .orderBy(sql`case ${tickets.urgency} when 'alta' then 0 when 'media' then 1 else 2 end`, asc(tickets.dueAt));
}

export type PipelineTicket = Awaited<ReturnType<typeof getPipelineTickets>>[number];
