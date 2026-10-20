import "server-only";
import { and, desc, eq, gte, isNotNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users, whatsappLog } from "@/lib/db/schema";
import { appUrl, parseTicketCode, ticketCode } from "@/lib/constants";
import { addComment } from "@/lib/tickets/service";
import { TicketError } from "@/lib/tickets/access";
import { audit } from "@/lib/audit";
import { enqueueWhatsapp, normalizePhone } from "./send";

const OPT_OUT = /^\s*(baja|stop|parar|no m[aá]s|cancelar alertas)\s*[.!]*\s*$/i;

/**
 * Respuesta recibida en el WhatsApp del líder a una alerta. Se asocia a la solicitud por el
 * mensaje citado, por el código HD-xxxxx o por la última alerta enviada a esa persona.
 */
export async function handleInbound(input: { from: string; text: string; quotedId?: string | null; messageId?: string | null }) {
  const phone = normalizePhone(input.from);
  const text = input.text.trim();
  if (!phone || !text) return { handled: false, reason: "vacío" };
  const db = await getDb();
  const [user] = await db.select().from(users).where(eq(users.whatsappPhone, phone));
  if (!user || !user.active) return { handled: false, reason: "remitente no registrado" };

  await db.insert(whatsappLog).values({
    direction: "in",
    userId: user.id,
    phone,
    kind: "respuesta",
    body: text.slice(0, 4000),
    waMessageId: input.messageId?.slice(0, 200) ?? null,
    status: "recibido",
  });

  if (OPT_OUT.test(text)) {
    await db.update(users).set({ whatsappOptIn: false }).where(eq(users.id, user.id));
    await audit(user.id, "baja_whatsapp", "usuario", user.id, `${user.name} se dio de baja de las alertas por WhatsApp`);
    // Se confirma una única vez, sin pie de alertas.
    await enqueueWhatsapp({ userId: user.id, phone, kind: "baja", body: "Listo, ya no recibirás alertas de la Mesa de Ayuda ACF por WhatsApp. Puedes activarlas de nuevo en tu perfil." });
    return { handled: true, action: "baja" };
  }

  let ticketId: number | null = null;
  if (input.quotedId) {
    const [q] = await db.select({ ticketId: whatsappLog.ticketId }).from(whatsappLog).where(eq(whatsappLog.waMessageId, input.quotedId)).limit(1);
    ticketId = q?.ticketId ?? null;
  }
  ticketId ??= parseTicketCode(text);
  if (!ticketId) {
    const [last] = await db
      .select({ ticketId: whatsappLog.ticketId })
      .from(whatsappLog)
      .where(and(eq(whatsappLog.userId, user.id), eq(whatsappLog.direction, "out"), isNotNull(whatsappLog.ticketId), gte(whatsappLog.createdAt, new Date(Date.now() - 3 * 86_400_000))))
      .orderBy(desc(whatsappLog.createdAt))
      .limit(1);
    ticketId = last?.ticketId ?? null;
  }
  if (!ticketId) {
    await enqueueWhatsapp({
      userId: user.id,
      phone,
      kind: "ayuda",
      body: `Hola ${user.name.split(" ")[0]} 👋 Para responder una solicitud, contesta directamente el mensaje de la alerta o incluye su código (ej. HD-00012). Para radicar una nueva entra a ${appUrl("/solicitudes/nueva")}`,
    });
    return { handled: false, reason: "sin solicitud" };
  }

  try {
    await addComment(user, ticketId, { body: text.slice(0, 10_000), source: "whatsapp" });
  } catch (e) {
    if (e instanceof TicketError) {
      await enqueueWhatsapp({ userId: user.id, phone, kind: "ayuda", body: `No pudimos registrar tu mensaje en ${ticketCode(ticketId)}: ${e.message}` });
      return { handled: false, reason: e.message };
    }
    throw e;
  }
  await db.update(whatsappLog).set({ ticketId }).where(and(eq(whatsappLog.userId, user.id), eq(whatsappLog.direction, "in"), eq(whatsappLog.body, text.slice(0, 4000))));
  await enqueueWhatsapp({ userId: user.id, phone, kind: "confirmacion", ticketId, body: `✅ Tu respuesta quedó registrada en la solicitud *${ticketCode(ticketId)}*.` });
  return { handled: true, ticketId };
}
