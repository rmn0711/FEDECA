import "server-only";
import { and, asc, desc, eq, gte, inArray, lt, or, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users, whatsappLog } from "@/lib/db/schema";
import { MetaSendError, sendMetaMessage, type MetaConfig } from "./meta-transport";

/** API oficial de Meta: activa cuando hay token y el id del número. */
export function metaConfig(): MetaConfig | null {
  const token = process.env.WHATSAPP_META_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_META_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId || !/^\d{5,30}$/.test(phoneNumberId)) return null;
  return {
    token,
    phoneNumberId,
    template: process.env.WHATSAPP_META_TEMPLATE || "conecta_aviso",
    templateLang: process.env.WHATSAPP_META_TEMPLATE_LANG || "es",
    apiVersion: process.env.WHATSAPP_META_API_VERSION || "v23.0",
  };
}

export const metaEnabled = () => metaConfig() !== null;

const MAX_ATTEMPTS = 3;

/**
 * Envía por la API de Meta los mensajes pendientes de la bandeja (o solo los indicados).
 * Usa el mismo reparto que el servicio vinculado: se marcan "enviando" para no duplicar.
 */
export async function processMetaOutbox(opts: { ids?: number[]; limit?: number } = {}) {
  const cfg = metaConfig();
  if (!cfg) return 0;
  const db = await getDb();
  const stale = new Date(Date.now() - 5 * 60_000);
  const claimable = and(
    eq(whatsappLog.direction, "out"),
    lt(whatsappLog.attempts, MAX_ATTEMPTS),
    or(eq(whatsappLog.status, "pendiente"), and(eq(whatsappLog.status, "enviando"), lt(whatsappLog.claimedAt, stale)))
  );
  const candidates = await db
    .select({ id: whatsappLog.id })
    .from(whatsappLog)
    .where(opts.ids?.length ? and(claimable, inArray(whatsappLog.id, opts.ids)) : claimable)
    .orderBy(asc(whatsappLog.createdAt))
    .limit(opts.limit ?? 20);
  if (candidates.length === 0) return 0;
  const claimed = await db
    .update(whatsappLog)
    .set({ status: "enviando", claimedAt: new Date(), attempts: sql`${whatsappLog.attempts} + 1` })
    .where(and(inArray(whatsappLog.id, candidates.map((c) => c.id)), inArray(whatsappLog.status, ["pendiente", "enviando"])))
    .returning();

  let sent = 0;
  for (const m of claimed) {
    if (!m.phone || !m.body) {
      await db.update(whatsappLog).set({ status: "fallido", error: "Mensaje sin número o sin texto.", statusAt: new Date() }).where(eq(whatsappLog.id, m.id));
      continue;
    }
    const { phone, body } = m;
    const [person] = m.userId ? await db.select({ name: users.name }).from(users).where(eq(users.id, m.userId)) : [];
    // Ventana de 24 h: la abre un mensaje de la persona hacia el número de la empresa.
    const [lastIn] = await db
      .select({ at: whatsappLog.createdAt })
      .from(whatsappLog)
      .where(and(eq(whatsappLog.direction, "in"), eq(whatsappLog.phone, phone), gte(whatsappLog.createdAt, new Date(Date.now() - 23.5 * 3_600_000))))
      .orderBy(desc(whatsappLog.createdAt))
      .limit(1);
    try {
      const r = await sendMetaMessage(cfg, { to: phone, body, firstName: person?.name.split(" ")[0] ?? "", windowOpen: Boolean(lastIn) });
      await db.update(whatsappLog).set({ status: "enviado", waMessageId: r.id, error: null, statusAt: new Date() }).where(eq(whatsappLog.id, m.id));
      sent++;
    } catch (e) {
      const err = e instanceof MetaSendError ? e : new MetaSendError("Error inesperado al enviar.", null, true);
      const retry = err.retryable && m.attempts < MAX_ATTEMPTS;
      await db
        .update(whatsappLog)
        .set({ status: retry ? "pendiente" : "fallido", error: err.message, statusAt: new Date() })
        .where(eq(whatsappLog.id, m.id));
    }
  }
  return sent;
}

/** Envía en segundo plano sin bloquear a quien encola (los errores quedan en la bandeja). */
export function kickMetaOutbox(ids?: number[]) {
  return processMetaOutbox({ ids }).catch((e) => {
    console.error("[conecta] Error enviando WhatsApp por la API de Meta:", e instanceof Error ? e.message : e);
    return 0;
  });
}

/** Estados que informa Meta por webhook (entregado, leído, fallido). */
export async function applyMetaStatus(s: { id: string; status: string; errorText?: string | null }) {
  const db = await getDb();
  if (s.status === "failed") {
    await db
      .update(whatsappLog)
      .set({ status: "fallido", error: (s.errorText ?? "WhatsApp no pudo entregar el mensaje.").slice(0, 480), statusAt: new Date() })
      .where(eq(whatsappLog.waMessageId, s.id));
  }
}
