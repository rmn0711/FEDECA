import { and, asc, eq, inArray, lt, or, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { whatsappLog } from "@/lib/db/schema";
import { setBridgeState } from "@/lib/whatsapp/send";
import { bridgeAuthorized, unauthorized } from "@/lib/whatsapp/bridge-auth";
import { deliverDueReminders } from "@/lib/followups/service";
import { deliverOverdueAlerts } from "@/lib/tickets/overdue";

// El servicio consulta cada 20 s: se aprovecha para entregar recordatorios y alertas de vencimiento
// a tiempo aunque el plan de Vercel solo permita un cron diario (máximo una vez por minuto).
let lastSweep = 0;

/**
 * El servicio pide los mensajes pendientes. Se marcan "enviando"; si en 5 minutos no
 * reporta el resultado, vuelven a estar disponibles (máximo 3 intentos).
 */
export async function GET(request: Request) {
  if (!bridgeAuthorized(request)) return unauthorized();
  const limit = Math.min(10, Math.max(1, Number(new URL(request.url).searchParams.get("limit")) || 5));
  await setBridgeState({ state: "conectado" });
  if (Date.now() - lastSweep > 60_000) {
    lastSweep = Date.now();
    await deliverDueReminders().catch(() => 0);
    await deliverOverdueAlerts().catch(() => 0);
  }
  const db = await getDb();
  const stale = new Date(Date.now() - 5 * 60_000);
  const candidates = await db
    .select({ id: whatsappLog.id })
    .from(whatsappLog)
    .where(
      and(
        eq(whatsappLog.direction, "out"),
        lt(whatsappLog.attempts, 3),
        or(eq(whatsappLog.status, "pendiente"), and(eq(whatsappLog.status, "enviando"), lt(whatsappLog.claimedAt, stale)))
      )
    )
    .orderBy(asc(whatsappLog.createdAt))
    .limit(limit);
  if (candidates.length === 0) return Response.json({ messages: [] });
  const claimed = await db
    .update(whatsappLog)
    .set({ status: "enviando", claimedAt: new Date(), attempts: sql`${whatsappLog.attempts} + 1` })
    .where(and(inArray(whatsappLog.id, candidates.map((c) => c.id)), inArray(whatsappLog.status, ["pendiente", "enviando"])))
    .returning({ id: whatsappLog.id, phone: whatsappLog.phone, body: whatsappLog.body });
  return Response.json({ messages: claimed });
}
