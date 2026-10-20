import "server-only";
import { and, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { categories, tickets } from "@/lib/db/schema";
import { OPEN_STATUSES, URGENCY_META, ticketCode } from "@/lib/constants";
import { sendPush } from "@/lib/push";
import { whatsappUsers } from "@/lib/whatsapp/send";
import { waMessage } from "@/lib/whatsapp/templates";
import { personalLink } from "./notifications";

/**
 * Avisa (push + WhatsApp) al responsable cuando una solicitud supera el tiempo de primera
 * respuesta o de solución. Cada aviso se envía una sola vez. Lo corre el cron cada 15 min.
 */
export async function deliverOverdueAlerts() {
  const db = await getDb();
  const now = new Date();
  const rows = await db
    .select({
      id: tickets.id,
      title: tickets.title,
      urgency: tickets.urgency,
      status: tickets.status,
      responseDueAt: tickets.responseDueAt,
      dueAt: tickets.dueAt,
      firstResponseAt: tickets.firstResponseAt,
      responseAlertedAt: tickets.responseAlertedAt,
      dueAlertedAt: tickets.dueAlertedAt,
      ownerId: sql<number | null>`coalesce(${tickets.assigneeId}, ${categories.responsibleId})`,
    })
    .from(tickets)
    .innerJoin(categories, eq(categories.slug, tickets.categorySlug))
    .where(
      and(
        inArray(tickets.status, OPEN_STATUSES),
        sql`((${tickets.firstResponseAt} is null and ${tickets.responseDueAt} < ${now} and ${tickets.responseAlertedAt} is null)
          or (${tickets.dueAt} < ${now} and ${tickets.dueAlertedAt} is null and ${tickets.status} <> 'en_espera'))`
      )
    )
    .limit(100);

  let sent = 0;
  for (const t of rows) {
    const solution = t.dueAt < now && !t.dueAlertedAt && t.status !== "en_espera";
    // Se marca antes de avisar para que dos procesos no dupliquen el aviso.
    const [claimed] = await db
      .update(tickets)
      .set(solution ? { dueAlertedAt: now } : { responseAlertedAt: now })
      .where(and(eq(tickets.id, t.id), solution ? isNull(tickets.dueAlertedAt) : isNull(tickets.responseAlertedAt), lt(solution ? tickets.dueAt : tickets.responseDueAt, now)))
      .returning({ id: tickets.id });
    if (!claimed || !t.ownerId) continue;
    const code = ticketCode(t.id);
    const what = solution ? "superó el tiempo de solución" : "no ha recibido primera respuesta a tiempo";
    const path = `/solicitudes/${t.id}`;
    await sendPush([t.ownerId], { title: `⚠️ ${code} vencida`, body: `${t.title} · ${what}`, url: path, tag: `overdue-${t.id}` });
    await whatsappUsers([t.ownerId], "solicitudes", solution ? "vencida_solucion" : "vencida_respuesta", (u) =>
      waMessage([`⚠️ *La solicitud ${code} ${what}*`, `_${t.title}_ · Prioridad ${URGENCY_META[t.urgency].label}`, `👉 ${personalLink(u, path)}`]), { ticketId: t.id });
    sent++;
  }
  return sent;
}
