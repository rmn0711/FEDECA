import "server-only";
import { after } from "next/server";
import { eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb } from "@/lib/db";
import { categories, settings, tickets, users } from "@/lib/db/schema";
import { getCategory, formatFieldValue } from "@/lib/categories";
import { STATUS_META, URGENCY_META, appUrl, ticketCode, type Status, type Urgency } from "@/lib/constants";
import { sendEmail } from "@/lib/email/send";
import { sendPush } from "@/lib/push";
import { whatsappUsers, type WaPerson } from "@/lib/whatsapp/send";
import { waMessage } from "@/lib/whatsapp/templates";
import { inArray } from "drizzle-orm";
import { renderTicketEmail, type EmailPill } from "@/lib/email/template";
import { formatDateTime } from "@/lib/format";

export type NotificationEvent =
  | { kind: "created" }
  | { kind: "comment"; authorId: number; body: string; viaEmail?: boolean }
  | { kind: "note"; authorId: number; body: string }
  | { kind: "status"; authorId: number; from: Status; to: Status; comment?: string | null }
  | { kind: "assign"; authorId: number }
  | { kind: "rating"; rating: number; comment?: string | null };

const URGENCY_PILL: Record<Urgency, Omit<EmailPill, "label">> = {
  alta: { color: "#b3261e", bg: "#fbe5e3" },
  media: { color: "#b84f22", bg: "#fdebe2" },
  baja: { color: "#4a4a4d", bg: "#efeff0" },
};

const STATUS_PILL: Record<Status, Omit<EmailPill, "label">> = {
  abierto: { color: "#1c5cab", bg: "#e3eefb" },
  en_progreso: { color: "#b84f22", bg: "#fdebe2" },
  en_espera: { color: "#4a4a4d", bg: "#efeff0" },
  resuelto: { color: "#0f8a5f", bg: "#dff5ec" },
  cerrado: { color: "#4a4a4d", bg: "#efeff0" },
};

/**
 * Ejecuta el envío después de responder al usuario (no lo hace esperar).
 * Fuera de una petición (scripts, pruebas) se ejecuta en línea.
 */
export function queueNotification(ticketId: number, event: NotificationEvent) {
  const task = () =>
    notify(ticketId, event).catch((e) => console.error("[conecta] Error en notificación:", e));
  try {
    after(task);
  } catch {
    void task();
  }
}

/** Correos de la mesa de ayuda (configurables). Por defecto, todos los administradores. */
export async function getNotifyEmails(): Promise<string[]> {
  const db = await getDb();
  const [row] = await db.select().from(settings).where(eq(settings.key, "notify_emails"));
  if (row?.value.trim()) return splitEmails(row.value);
  const admins = await db.select({ email: users.email }).from(users).where(eq(users.role, "admin"));
  return admins.map((a) => a.email);
}

export function splitEmails(value: string | null | undefined) {
  return (value ?? "")
    .split(/[,;\s]+/)
    .map((e) => e.trim())
    .filter(Boolean);
}

async function loadContext(ticketId: number) {
  const db = await getDb();
  const requester = alias(users, "requester");
  const assignee = alias(users, "assignee");
  const responsible = alias(users, "responsible");
  const [row] = await db
    .select({
      ticket: tickets,
      category: categories,
      requester: { name: requester.name, email: requester.email, department: requester.department },
      assignee: { id: assignee.id, name: assignee.name, email: assignee.email },
      responsible: { id: responsible.id, name: responsible.name, email: responsible.email },
    })
    .from(tickets)
    .innerJoin(categories, eq(categories.slug, tickets.categorySlug))
    .innerJoin(requester, eq(requester.id, tickets.requesterId))
    .leftJoin(assignee, eq(assignee.id, tickets.assigneeId))
    .leftJoin(responsible, eq(responsible.id, categories.responsibleId))
    .where(eq(tickets.id, ticketId));
  return row;
}

async function userName(id: number) {
  const db = await getDb();
  const [u] = await db.select({ name: users.name }).from(users).where(eq(users.id, id));
  return u?.name ?? "Usuario";
}

/** Push a los dispositivos de las personas involucradas (no al autor del evento). */
async function pushFor(ticketId: number, event: NotificationEvent) {
  const ctx = await loadContext(ticketId);
  if (!ctx) return;
  const t = ctx.ticket;
  const code = ticketCode(t.id);
  const url = `/solicitudes/${t.id}`;
  const ownerId = ctx.assignee?.id ?? ctx.responsible?.id ?? null;
  const db = await getDb();
  const admins = (await db.select({ id: users.id }).from(users).where(inArray(users.role, ["admin"]))).map((a) => a.id);
  const authorId = "authorId" in event ? event.authorId : null;
  let ids: number[] = [];
  let title = "";
  let body = t.title;
  switch (event.kind) {
    case "created":
      ids = [ownerId, ...admins].filter((v): v is number => Boolean(v) && v !== t.requesterId);
      title = `Nueva solicitud ${code} · ${URGENCY_META[t.urgency].label}`;
      body = `${ctx.requester.name}: ${t.title}`;
      break;
    case "comment":
      ids = event.authorId === t.requesterId ? [ownerId].filter((v): v is number => Boolean(v)) : [t.requesterId];
      title = `Respuesta en ${code}`;
      body = event.body.slice(0, 140);
      break;
    case "status":
      ids = [t.requesterId];
      title = `${code}: ${STATUS_META[event.to].label}`;
      break;
    case "assign":
      ids = ctx.assignee ? [ctx.assignee.id] : [];
      title = `Te asignaron ${code}`;
      break;
    case "rating":
      ids = [ownerId].filter((v): v is number => Boolean(v));
      title = `Calificación ${"★".repeat(event.rating)} en ${code}`;
      break;
    default:
      return;
  }
  await sendPush(ids.filter((id) => id !== authorId), { title, body, url });
}

/** Enlace personal: a los solicitantes los lleva directo a su solicitud pidiendo solo la contraseña. */
export function personalLink(u: Pick<WaPerson, "role" | "accessToken">, path: string) {
  return u.role === "user" && u.accessToken ? appUrl(`/acceso/${u.accessToken}?next=${encodeURIComponent(path)}`) : appUrl(path);
}

/** Alertas por WhatsApp (bandeja que envía el número del líder). */
async function whatsappFor(ticketId: number, event: NotificationEvent) {
  const ctx = await loadContext(ticketId);
  if (!ctx) return;
  const t = ctx.ticket;
  const code = ticketCode(t.id);
  const path = `/solicitudes/${t.id}`;
  const ownerId = ctx.assignee?.id ?? ctx.responsible?.id ?? null;
  const prio = URGENCY_META[t.urgency].label;
  const quote = (s: string) => `«${s.length > 400 ? `${s.slice(0, 400)}…` : s}»`;
  const meta = { ticketId: t.id };
  switch (event.kind) {
    case "created": {
      const db = await getDb();
      const admins = (await db.select({ id: users.id }).from(users).where(inArray(users.role, ["admin"]))).map((a) => a.id);
      await whatsappUsers(
        [ownerId, ...admins].filter((v): v is number => Boolean(v) && v !== t.requesterId),
        "solicitudes",
        "nueva_solicitud",
        (u) =>
          waMessage([
            `🔔 *Nueva solicitud ${code}* · Prioridad ${prio}`,
            `*${ctx.category.name}* · de ${ctx.requester.name}`,
            `_${t.title}_`,
            `⏱️ Primera respuesta antes de: ${formatDateTime(t.responseDueAt)}`,
            `👉 ${personalLink(u, path)}`,
          ]),
        meta
      );
      return;
    }
    case "comment": {
      const author = await userName(event.authorId);
      if (event.authorId === t.requesterId) {
        await whatsappUsers([ownerId].filter((v): v is number => Boolean(v)), "solicitudes", "respuesta_solicitante", (u) =>
          waMessage([`💬 *${author} respondió en ${code}*`, `_${t.title}_`, quote(event.body), `👉 ${personalLink(u, path)}`]), meta);
      } else {
        await whatsappUsers([t.requesterId], "mis_solicitudes", "respuesta_solicitud", (u) =>
          waMessage([`💬 *Respuesta en tu solicitud ${code}*`, `_${t.title}_`, `*${author}:* ${quote(event.body)}`, `👉 ${personalLink(u, path)}`]), meta);
      }
      return;
    }
    case "status": {
      const resolved = event.to === "resuelto";
      await whatsappUsers([t.requesterId], "mis_solicitudes", "estado_solicitud", (u) =>
        waMessage([
          `${resolved ? "✅" : "📌"} Tu solicitud *${code}* ahora está *${STATUS_META[event.to].label}*`,
          `_${t.title}_`,
          event.comment ? quote(event.comment) : null,
          resolved ? "¿Quedó bien? Confírmalo y califica la atención:" : null,
          `👉 ${personalLink(u, path)}`,
        ]), meta);
      return;
    }
    case "assign": {
      if (!ctx.assignee) return;
      await whatsappUsers([ctx.assignee.id], "solicitudes", "asignada", (u) =>
        waMessage([
          `📥 *Te asignaron la solicitud ${code}* · Prioridad ${prio}`,
          `*${ctx.category.name}* · de ${ctx.requester.name}`,
          `_${t.title}_`,
          `⏱️ Solución antes de: ${formatDateTime(t.dueAt)}`,
          `👉 ${personalLink(u, path)}`,
        ]), meta);
      return;
    }
    default:
      return;
  }
}

async function notify(ticketId: number, event: NotificationEvent) {
  await pushFor(ticketId, event).catch((e) => console.error("[conecta] Error en push de solicitud:", e));
  await whatsappFor(ticketId, event).catch((e) => console.error("[conecta] Error en WhatsApp de solicitud:", e));
  const ctx = await loadContext(ticketId);
  if (!ctx) return;
  const { ticket, category, requester } = ctx;
  const def = getCategory(ticket.categorySlug);
  const code = ticketCode(ticket.id);
  const url = appUrl(`/solicitudes/${ticket.id}`);
  const helpdesk = await getNotifyEmails();
  const owner = ctx.assignee?.email ?? ctx.responsible?.email ?? null;
  const ownerName = ctx.assignee?.name ?? ctx.responsible?.name ?? "Sin asignar";
  const extraCc = [...splitEmails(category.ccEmails), ...splitEmails(ticket.ccEmails)];
  const subjectBase = `[${code}] ${ticket.title}`;

  const pills: EmailPill[] = [
    { label: category.name, color: "#ffffff", bg: "#19191b" },
    { label: `Prioridad ${URGENCY_META[ticket.urgency].label}`, ...URGENCY_PILL[ticket.urgency] },
    { label: STATUS_META[ticket.status].label, ...STATUS_PILL[ticket.status] },
  ];
  const baseDetails: Array<[string, string]> = [
    ["Solicitante", `${requester.name}${requester.department ? ` · ${requester.department}` : ""}`],
    ["Responsable", ownerName],
    ["Fecha de solicitud", formatDateTime(ticket.createdAt)],
    ["Primera respuesta antes de", formatDateTime(ticket.responseDueAt)],
    ["Solución antes de", formatDateTime(ticket.dueAt)],
  ];

  const common = { code, title: ticket.title, pills, ctaUrl: url, allowReply: true };
  const first = (name: string) => name.split(" ")[0];
  const reqFirst = first(requester.name);
  const urgency = URGENCY_META[ticket.urgency];
  // Avance visible para el solicitante: recibida → en curso / en espera → resuelta.
  const progressOf = (s: Status) =>
    s === "abierto" ? ({ step: 0 } as const) : s === "en_progreso" ? ({ step: 1 } as const) : s === "en_espera" ? ({ step: 1, waiting: true } as const) : ({ step: 2 } as const);
  const signoffFor = async (authorId: number) => {
    const name = await userName(authorId);
    return { name, role: `Equipo de ${category.name} · ACF` };
  };

  switch (event.kind) {
    case "created": {
      const fieldDetails: Array<[string, string]> = (def?.fields ?? []).map((f) => [
        f.label,
        formatFieldValue(f, ticket.fields[f.key]),
      ]);
      const { html, text } = renderTicketEmail({
        ...common,
        preheader: `${requester.name} necesita apoyo en ${category.name}. Primera respuesta antes de ${formatDateTime(ticket.responseDueAt)}.`,
        eyebrow: `Nueva solicitud · Prioridad ${urgency.label.toLowerCase()}`,
        heading: `${reqFirst} necesita una mano con ${category.name}`,
        intro:
          ctx.assignee || ctx.responsible
            ? `La solicitud ya quedó registrada y ${first(ownerName)} la tiene en su radar. La idea es dar una primera respuesta antes del ${formatDateTime(ticket.responseDueAt)} y resolverla antes del ${formatDateTime(ticket.dueAt)}`
            : `La solicitud ya quedó registrada. La idea es dar una primera respuesta antes del ${formatDateTime(ticket.responseDueAt)} y resolverla antes del ${formatDateTime(ticket.dueAt)}`,
        progress: { step: 0 },
        details: [...baseDetails, ...fieldDetails],
        message: { author: requester.name, body: ticket.description, label: "Lo que necesita" },
        ctaLabel: "Abrir la solicitud",
      });
      // Al dueño de la mesa de ayuda, con copia al responsable y a quien la registró.
      await sendEmail({
        ticketId,
        kind: "created",
        to: helpdesk,
        cc: [ctx.responsible?.email, ctx.assignee?.email, requester.email, ...extraCc].filter(Boolean) as string[],
        subject: `Nueva solicitud ${subjectBase} · Prioridad ${urgency.label}`,
        html,
        text,
      });
      return;
    }
    case "comment": {
      const author = await userName(event.authorId);
      const fromRequester = event.authorId === ticket.requesterId;
      const { html, text } = renderTicketEmail({
        ...common,
        preheader: `${first(author)}: ${event.body.slice(0, 120)}`,
        eyebrow: fromRequester ? "Nuevo mensaje del solicitante" : "Tienes una respuesta",
        heading: fromRequester ? `${first(author)} te escribió sobre su solicitud` : `${reqFirst}, ${first(author)} te respondió`,
        intro: fromRequester
          ? `${first(author)} agregó información a su solicitud. Respóndele cuando puedas, desde Conecta o respondiendo este correo.`
          : "Esto es lo que te escribió sobre tu solicitud. Si te queda alguna duda o quieres agregar algo, solo responde este correo.",
        progress: fromRequester ? null : progressOf(ticket.status),
        details: baseDetails,
        message: { author, body: event.body, label: event.viaEmail ? "por correo" : undefined },
        ctaLabel: "Ver la conversación",
        signoff: fromRequester ? null : await signoffFor(event.authorId),
      });
      await sendEmail({
        ticketId,
        kind: "comment",
        to: fromRequester ? [owner ?? helpdesk[0]].filter(Boolean) as string[] : [requester.email],
        cc: [requester.email, ctx.responsible?.email, ctx.assignee?.email, ...helpdesk, ...extraCc].filter(Boolean) as string[],
        subject: `RE: ${subjectBase}`,
        html,
        text,
      });
      return;
    }
    case "note": {
      const author = await userName(event.authorId);
      const { html, text } = renderTicketEmail({
        ...common,
        allowReply: false,
        preheader: `Nota interna de ${author}`,
        eyebrow: "Nota interna · solo el equipo",
        heading: `${first(author)} dejó una nota interna`,
        intro: "Solo la ve el equipo. El solicitante no la recibe ni la ve en la plataforma.",
        details: baseDetails,
        message: { author, body: event.body, label: "nota interna" },
        ctaLabel: "Ver la solicitud",
      });
      await sendEmail({
        ticketId,
        kind: "note",
        to: [owner].filter(Boolean) as string[],
        cc: [ctx.responsible?.email, ...helpdesk].filter(Boolean) as string[],
        subject: `[Nota interna] ${subjectBase}`,
        html,
        text,
      });
      return;
    }
    case "status": {
      const author = await userName(event.authorId);
      const to = event.to;
      const reopened = to === "abierto" && event.from !== "abierto";
      const copy: Record<Status, { eyebrow: string; heading: string; intro: string; cta: string }> = {
        abierto: {
          eyebrow: reopened ? "Solicitud reabierta" : "Solicitud recibida",
          heading: reopened ? `${reqFirst}, reabrimos tu solicitud` : `${reqFirst}, recibimos tu solicitud`,
          intro: reopened ? "Volvió a la fila para que la revisemos de nuevo. Te avisamos apenas tengamos novedades." : "Ya está en la fila y pronto la tomaremos.",
          cta: "Ver mi solicitud",
        },
        en_progreso: {
          eyebrow: "Manos a la obra",
          heading: `${reqFirst}, ${first(author)} ya está trabajando en tu solicitud`,
          intro: `Tu solicitud está en curso. La meta es tenerla lista antes del ${formatDateTime(ticket.dueAt)}; si necesitamos algo de tu parte, te escribimos por aquí.`,
          cta: "Ver mi solicitud",
        },
        en_espera: {
          eyebrow: "Necesitamos algo de tu parte",
          heading: `${reqFirst}, tu solicitud está en espera`,
          intro: `${first(author)} la puso en espera mientras recibimos información o una aprobación. Respóndenos (aquí mismo o en Conecta) y la retomamos de inmediato.`,
          cta: "Responder ahora",
        },
        resuelto: {
          eyebrow: "¡Listo!",
          heading: `${reqFirst}, tu solicitud quedó resuelta 🎉`,
          intro: "Revisa la solución y cuéntanos qué tal te fue: calificar la atención toma 10 segundos y nos ayuda a mejorar. Si algo no quedó bien, responde este correo y la reabrimos.",
          cta: "Revisar y calificar",
        },
        cerrado: {
          eyebrow: "Solicitud cerrada",
          heading: `${reqFirst}, cerramos tu solicitud`,
          intro: "Gracias por escribirnos. Si necesitas algo más, puedes abrir una nueva solicitud cuando quieras.",
          cta: "Ver mi solicitud",
        },
      };
      const c = copy[to];
      const { html, text } = renderTicketEmail({
        ...common,
        preheader: `${STATUS_META[event.from].label} → ${STATUS_META[to].label}. ${c.intro.slice(0, 90)}`,
        eyebrow: c.eyebrow,
        heading: c.heading,
        intro: c.intro,
        progress: progressOf(to),
        details: baseDetails,
        message: event.comment ? { author, body: event.comment } : null,
        ctaLabel: c.cta,
        signoff: await signoffFor(event.authorId),
      });
      await sendEmail({
        ticketId,
        kind: "status",
        to: [requester.email],
        cc: [ctx.responsible?.email, ctx.assignee?.email, ...helpdesk, ...extraCc].filter(Boolean) as string[],
        subject: `${to === "resuelto" ? "Resuelta" : STATUS_META[to].label}: ${subjectBase}`,
        html,
        text,
      });
      return;
    }
    case "assign": {
      if (!ctx.assignee) return;
      const author = await userName(event.authorId);
      const { html, text } = renderTicketEmail({
        ...common,
        preheader: `${first(author)} te asignó ${code}: ${ticket.title}`,
        eyebrow: "Te asignaron una solicitud",
        heading: `${first(ctx.assignee.name)}, ${first(author)} cuenta contigo para esta`,
        intro: `Es una solicitud de ${category.name} con prioridad ${urgency.label.toLowerCase()}. Primera respuesta antes del ${formatDateTime(ticket.responseDueAt)} y solución antes del ${formatDateTime(ticket.dueAt)}`,
        details: baseDetails,
        message: { author: requester.name, body: ticket.description, label: "Lo que necesita" },
        ctaLabel: "Atender la solicitud",
      });
      await sendEmail({
        ticketId,
        kind: "assign",
        to: [ctx.assignee.email],
        cc: [requester.email, ...helpdesk],
        subject: `Asignada: ${subjectBase}`,
        html,
        text,
      });
      return;
    }
    case "rating": {
      const good = event.rating >= 4;
      const { html, text } = renderTicketEmail({
        ...common,
        allowReply: false,
        preheader: `${requester.name} calificó la atención con ${event.rating}/5`,
        eyebrow: good ? "¡Buen trabajo!" : "Calificación recibida",
        heading: `${reqFirst} calificó la atención: ${"★".repeat(event.rating)}${"☆".repeat(5 - event.rating)}`,
        intro: good
          ? `${event.rating} de 5. ¡Gracias por la buena atención! La solicitud quedó cerrada.`
          : `${event.rating} de 5. Vale la pena revisar qué pasó para mejorar la próxima vez. La solicitud quedó cerrada.`,
        details: baseDetails,
        message: event.comment ? { author: requester.name, body: event.comment, label: "comentario" } : null,
        ctaLabel: "Ver la solicitud",
      });
      await sendEmail({
        ticketId,
        kind: "rating",
        to: [owner ?? helpdesk[0]].filter(Boolean) as string[],
        cc: helpdesk,
        subject: `Calificación ${event.rating}/5: ${subjectBase}`,
        html,
        text,
      });
      return;
    }
  }
}
