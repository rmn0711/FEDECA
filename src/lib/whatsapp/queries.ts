import "server-only";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users, whatsappLog } from "@/lib/db/schema";

export async function getWhatsappOverview() {
  const db = await getDb();
  const cols = {
    id: whatsappLog.id,
    direction: whatsappLog.direction,
    phone: whatsappLog.phone,
    kind: whatsappLog.kind,
    body: whatsappLog.body,
    status: whatsappLog.status,
    error: whatsappLog.error,
    attempts: whatsappLog.attempts,
    ticketId: whatsappLog.ticketId,
    createdAt: whatsappLog.createdAt,
    statusAt: whatsappLog.statusAt,
    userName: users.name,
  };
  const [queue, recent, [counts], optedIn] = await Promise.all([
    db
      .select(cols)
      .from(whatsappLog)
      .leftJoin(users, eq(users.id, whatsappLog.userId))
      .where(inArray(whatsappLog.status, ["pendiente", "enviando", "fallido"]))
      .orderBy(desc(whatsappLog.createdAt))
      .limit(100),
    db
      .select(cols)
      .from(whatsappLog)
      .leftJoin(users, eq(users.id, whatsappLog.userId))
      .where(inArray(whatsappLog.status, ["enviado", "enviado_manual", "recibido", "descartado"]))
      .orderBy(desc(whatsappLog.createdAt))
      .limit(60),
    db
      .select({
        sentToday: sql<number>`count(*) filter (where ${whatsappLog.status} in ('enviado','enviado_manual') and ${whatsappLog.statusAt} > now() - interval '24 hours')::int`,
        received: sql<number>`count(*) filter (where ${whatsappLog.direction} = 'in' and ${whatsappLog.createdAt} > now() - interval '7 days')::int`,
      })
      .from(whatsappLog),
    db.select({ n: sql<number>`count(*)::int` }).from(users).where(eq(users.whatsappOptIn, true)),
  ]);
  return { queue, recent, sentToday: counts?.sentToday ?? 0, received: counts?.received ?? 0, optedIn: optedIn[0]?.n ?? 0 };
}

export async function pendingWhatsappCount() {
  const db = await getDb();
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(whatsappLog).where(inArray(whatsappLog.status, ["pendiente", "fallido"]));
  return r?.n ?? 0;
}
