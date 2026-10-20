import "server-only";
import { and, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { categories, followups, tasks, tickets, projects } from "@/lib/db/schema";
import { OPEN_STATUSES, URGENCY_META, ticketCode, type Role } from "@/lib/constants";
import { unreadTotal } from "@/lib/chat/service";
import { todayISO } from "@/lib/workspace/constants";
import { relativeTime } from "@/lib/format";

export type AlertCategory = "seguimientos" | "solicitudes" | "mis_solicitudes" | "tareas" | "chat" | "equipo";
export type AlertSeverity = "overdue" | "today" | "review";

export type Alert = {
  id: string;
  category: AlertCategory;
  severity: AlertSeverity;
  title: string;
  detail: string;
  href: string;
};

export type AlertsResult = { alerts: Alert[]; total: number; overdue: number };

type Actor = { id: number; role: Role; name?: string };

const SEVERITY_ORDER: Record<AlertSeverity, number> = { overdue: 0, today: 1, review: 2 };

/** Solicitudes abiertas a cargo de una persona: asignadas a ella o sin asignar en sus categorías. */
export function ownedTicketsWhere(userId: number) {
  return and(
    inArray(tickets.status, OPEN_STATUSES),
    or(eq(tickets.assigneeId, userId), and(isNull(tickets.assigneeId), eq(categories.responsibleId, userId)))
  );
}

export async function getAlerts(user: Actor): Promise<AlertsResult> {
  const db = await getDb();
  const now = new Date();
  const alerts: Alert[] = [];
  const staff = user.role === "admin" || user.role === "agent";

  if (staff) {
    // Mis seguimientos: vencidos, para hoy y por avisar.
    const todayStr = todayISO();
    const endOfToday = new Date(`${todayStr}T23:59:59-05:00`);
    const myFollowups = await db
      .select({ id: followups.id, title: followups.title, remindAt: followups.remindAt })
      .from(followups)
      .where(and(eq(followups.ownerId, user.id), eq(followups.status, "pendiente"), sql`${followups.remindAt} <= ${endOfToday}`));
    for (const f of myFollowups) {
      const at = f.remindAt!;
      const passed = at <= now;
      const late = passed && now.getTime() - at.getTime() > 12 * 3_600_000;
      alerts.push({
        id: `f-${f.id}`,
        category: "seguimientos",
        severity: late ? "overdue" : passed ? "today" : "review",
        title: f.title,
        detail: passed ? `Seguimiento ${late ? "vencido" : "pendiente"} desde ${relativeTime(at)}` : `Hoy ${relativeTime(at)}`,
        href: "/equipo/seguimientos",
      });
    }

    // Solicitudes del helpdesk a mi cargo.
    const owned = await db
      .select({
        id: tickets.id,
        title: tickets.title,
        urgency: tickets.urgency,
        status: tickets.status,
        createdAt: tickets.createdAt,
        dueAt: tickets.dueAt,
        responseDueAt: tickets.responseDueAt,
        firstResponseAt: tickets.firstResponseAt,
        requesterId: tickets.requesterId,
        lastRequesterAt: sql<Date | null>`(select max(e.created_at) from hd_ticket_events e where e.ticket_id = ${tickets.id} and e.type = 'comment' and e.author_id = ${tickets.requesterId})`,
        lastStaffAt: sql<Date | null>`(select max(e.created_at) from hd_ticket_events e where e.ticket_id = ${tickets.id} and e.type in ('comment','status') and e.author_id is not null and e.author_id <> ${tickets.requesterId})`,
      })
      .from(tickets)
      .innerJoin(categories, eq(categories.slug, tickets.categorySlug))
      .where(ownedTicketsWhere(user.id));

    for (const t of owned) {
      const code = ticketCode(t.id);
      const href = `/solicitudes/${t.id}`;
      const prio = `Prioridad ${URGENCY_META[t.urgency].label.toLowerCase()}`;
      const lastReq = t.lastRequesterAt ? new Date(t.lastRequesterAt) : null;
      const lastStaff = t.lastStaffAt ? new Date(t.lastStaffAt) : null;
      if (t.dueAt < now) {
        alerts.push({ id: `t-due-${t.id}`, category: "solicitudes", severity: "overdue", title: `${code} · ${t.title}`, detail: `Solución vencida ${relativeTime(t.dueAt)} · ${prio}`, href });
      } else if (!t.firstResponseAt && t.responseDueAt < now) {
        alerts.push({ id: `t-resp-${t.id}`, category: "solicitudes", severity: "overdue", title: `${code} · ${t.title}`, detail: `Sin primera respuesta (venció ${relativeTime(t.responseDueAt)}) · ${prio}`, href });
      } else if (t.status !== "en_espera" && (t.dueAt.getTime() - now.getTime()) / (t.dueAt.getTime() - t.createdAt.getTime()) < 0.25) {
        alerts.push({ id: `t-soon-${t.id}`, category: "solicitudes", severity: "today", title: `${code} · ${t.title}`, detail: `La solución vence ${relativeTime(t.dueAt)} · ${prio}`, href });
      } else if (lastReq && (!lastStaff || lastReq > lastStaff)) {
        alerts.push({ id: `t-reply-${t.id}`, category: "solicitudes", severity: "review", title: `${code} · ${t.title}`, detail: `El solicitante respondió ${relativeTime(lastReq)}`, href });
      } else if (!t.firstResponseAt) {
        alerts.push({ id: `t-new-${t.id}`, category: "solicitudes", severity: "review", title: `${code} · ${t.title}`, detail: `Nueva solicitud sin responder · responde ${relativeTime(t.responseDueAt)}`, href });
      }
    }

    // Tareas del espacio de equipo.
    const today = todayISO();
    const mine = await db
      .select({ id: tasks.id, title: tasks.title, dueDate: tasks.dueDate, projectId: tasks.projectId, projectName: projects.name })
      .from(tasks)
      .innerJoin(projects, eq(projects.id, tasks.projectId))
      .where(and(eq(tasks.assigneeId, user.id), ne(tasks.status, "hecho"), eq(projects.archived, false), sql`${tasks.dueDate} <= ${today}`));
    for (const t of mine) {
      alerts.push({
        id: `k-${t.id}`,
        category: "tareas",
        severity: t.dueDate! < today ? "overdue" : "today",
        title: t.title,
        detail: `${t.dueDate! < today ? "Tarea vencida" : "Vence hoy"} · ${t.projectName}`,
        href: `/equipo/proyectos/${t.projectId}?tarea=${t.id}`,
      });
    }

    if (user.role === "admin") {
      const review = await db
        .select({ id: tasks.id, title: tasks.title, projectId: tasks.projectId, projectName: projects.name })
        .from(tasks)
        .innerJoin(projects, eq(projects.id, tasks.projectId))
        .where(and(eq(tasks.status, "en_revision"), eq(projects.archived, false)));
      for (const t of review) {
        alerts.push({ id: `r-${t.id}`, category: "tareas", severity: "review", title: t.title, detail: `Lista para tu aprobación · ${t.projectName}`, href: `/equipo/proyectos/${t.projectId}?tarea=${t.id}` });
      }

      // Visión de líder: lo vencido del equipo y lo que no tiene responsable.
      const teamRows = await db
        .select({ id: tickets.id, title: tickets.title, dueAt: tickets.dueAt, assigneeId: tickets.assigneeId })
        .from(tickets)
        .innerJoin(categories, eq(categories.slug, tickets.categorySlug))
        .where(
          and(
            inArray(tickets.status, OPEN_STATUSES),
            or(isNull(tickets.assigneeId), sql`${tickets.dueAt} < now()`),
            sql`not (${ownedTicketsWhere(user.id)})`
          )
        );
      for (const t of teamRows) {
        alerts.push({
          id: `e-${t.id}`,
          category: "equipo",
          severity: t.dueAt < now ? "overdue" : "review",
          title: `${ticketCode(t.id)} · ${t.title}`,
          detail: t.assigneeId ? `Vencida ${relativeTime(t.dueAt)} (otro responsable)` : "Sin responsable asignado",
          href: `/solicitudes/${t.id}`,
        });
      }
    }

    const unread = await unreadTotal(user);
    if (unread > 0) {
      alerts.push({ id: "chat", category: "chat", severity: "review", title: `${unread} mensaje(s) sin leer`, detail: "En canales y mensajes directos del equipo", href: "/chat" });
    }
  }

  // Mis propias solicitudes (también para el equipo cuando son solicitantes).
  const own = await db
    .select({ id: tickets.id, title: tickets.title, status: tickets.status, rating: tickets.rating })
    .from(tickets)
    .where(and(eq(tickets.requesterId, user.id), inArray(tickets.status, ["en_espera", "resuelto"])));
  for (const t of own) {
    if (t.status === "en_espera") {
      alerts.push({ id: `m-wait-${t.id}`, category: "mis_solicitudes", severity: "today", title: `${ticketCode(t.id)} · ${t.title}`, detail: "Esperan tu respuesta para continuar", href: `/solicitudes/${t.id}` });
    } else if (!t.rating) {
      alerts.push({ id: `m-rate-${t.id}`, category: "mis_solicitudes", severity: "review", title: `${ticketCode(t.id)} · ${t.title}`, detail: "Resuelta: confirma y califica la atención", href: `/solicitudes/${t.id}` });
    }
  }

  alerts.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  return { alerts, total: alerts.length, overdue: alerts.filter((a) => a.severity === "overdue").length };
}
