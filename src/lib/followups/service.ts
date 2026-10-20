import "server-only";
import { and, asc, desc, eq, isNotNull, isNull, lte, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb } from "@/lib/db";
import { followups, projects, tasks, tickets, users } from "@/lib/db/schema";
import { sendPush } from "@/lib/push";
import { whatsappUsers } from "@/lib/whatsapp/send";
import { waMessage } from "@/lib/whatsapp/templates";
import { sendEmail } from "@/lib/email/send";
import { renderTicketEmail } from "@/lib/email/template";
import { appUrl, ticketCode } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";

const person = alias(users, "person");

export async function listFollowups(ownerId: number) {
  const db = await getDb();
  return db
    .select({
      id: followups.id,
      title: followups.title,
      notes: followups.notes,
      remindAt: followups.remindAt,
      status: followups.status,
      personId: followups.personId,
      personName: person.name,
      ticketId: followups.ticketId,
      ticketTitle: tickets.title,
      taskId: followups.taskId,
      taskTitle: tasks.title,
      taskProjectId: tasks.projectId,
      taskStatus: tasks.status,
      doneAt: followups.doneAt,
      createdAt: followups.createdAt,
    })
    .from(followups)
    .leftJoin(person, eq(person.id, followups.personId))
    .leftJoin(tickets, eq(tickets.id, followups.ticketId))
    .leftJoin(tasks, eq(tasks.id, followups.taskId))
    .where(eq(followups.ownerId, ownerId))
    .orderBy(sql`case when ${followups.status} = 'hecho' then 1 else 0 end`, sql`${followups.remindAt} asc nulls last`, desc(followups.createdAt))
    .limit(300);
}

export type FollowupItem = Awaited<ReturnType<typeof listFollowups>>[number];

/**
 * Entrega los recordatorios que ya llegaron a su hora (push + correo), una sola vez.
 * La invoca el cron cada 15 min y también cada consulta de alertas con la app abierta.
 */
export async function deliverDueReminders(ownerId?: number) {
  const db = await getDb();
  const due = await db
    .select({ f: followups, email: users.email, name: users.name, projectId: tasks.projectId })
    .from(followups)
    .innerJoin(users, eq(users.id, followups.ownerId))
    .leftJoin(tasks, eq(tasks.id, followups.taskId))
    .where(
      and(
        eq(followups.status, "pendiente"),
        isNotNull(followups.remindAt),
        lte(followups.remindAt, new Date()),
        isNull(followups.notifiedAt),
        ownerId ? eq(followups.ownerId, ownerId) : undefined
      )
    )
    .limit(200);
  for (const { f, email, name, projectId } of due) {
    // Se marca primero para no repetir el aviso si dos procesos coinciden.
    const [claimed] = await db
      .update(followups)
      .set({ notifiedAt: new Date() })
      .where(and(eq(followups.id, f.id), isNull(followups.notifiedAt)))
      .returning({ id: followups.id });
    if (!claimed) continue;
    const url = f.ticketId ? `/solicitudes/${f.ticketId}` : f.taskId && projectId ? `/equipo/proyectos/${projectId}?tarea=${f.taskId}` : "/equipo/seguimientos";
    await sendPush([f.ownerId], { title: "⏰ Seguimiento pendiente", body: f.title, url, tag: `followup-${f.id}` });
    await whatsappUsers([f.ownerId], "recordatorios", "recordatorio", () =>
      waMessage([`⏰ *Recordatorio de seguimiento*`, `*${f.title}*`, f.notes ? `_${f.notes.slice(0, 300)}_` : null, `👉 ${appUrl(url)}`], false)
    );
    const { html, text } = renderTicketEmail({
      preheader: f.title,
      eyebrow: "Recordatorio de seguimiento",
      heading: `${name.split(" ")[0]}, te recuerdo este seguimiento ⏰`,
      intro: `Me pediste avisarte${f.remindAt ? ` el ${formatDateTime(f.remindAt)}` : ""}. Cuando lo hagas, márcalo como hecho para que no vuelva a aparecer.`,
      code: f.ticketId ? ticketCode(f.ticketId) : "Seguimiento",
      title: f.title,
      pills: [{ label: "Pendiente", color: "#b84f22", bg: "#fdebe2" }],
      details: [],
      message: f.notes ? { author: name, body: f.notes, label: "tus notas" } : null,
      ctaLabel: "Ver mis seguimientos",
      ctaUrl: appUrl("/equipo/seguimientos"),
    });
    await sendEmail({ kind: "reminder", to: [email], subject: `⏰ Seguimiento: ${f.title}`, html, text });
  }
  return due.length;
}

export async function projectOptions() {
  const db = await getDb();
  return db.select({ id: projects.id, name: projects.name, icon: projects.icon }).from(projects).where(eq(projects.archived, false)).orderBy(asc(projects.sort));
}
