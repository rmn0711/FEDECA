"use server";

import { isPushEndpoint } from "@/lib/secure";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { pushSubscriptions } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth";
import { sendPush } from "@/lib/push";

export async function savePushSubscriptionAction(sub: { endpoint: string; keys: { p256dh: string; auth: string } }, userAgent: string) {
  const me = await requireUser();
  if (!isPushEndpoint(sub.endpoint) || !sub.keys?.p256dh || !sub.keys?.auth) return { ok: false as const, error: "Suscripción no válida." };
  const db = await getDb();
  await db
    .insert(pushSubscriptions)
    .values({ endpoint: sub.endpoint, userId: me.id, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent: userAgent.slice(0, 300) })
    .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { userId: me.id, p256dh: sub.keys.p256dh, auth: sub.keys.auth } });
  return { ok: true as const };
}

export async function removePushSubscriptionAction(endpoint: string) {
  const me = await requireUser();
  const db = await getDb();
  await db.delete(pushSubscriptions).where(and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.userId, me.id)));
  return { ok: true as const };
}

export async function testPushAction() {
  const me = await requireUser();
  await sendPush([me.id], { title: "Conecta ACF", body: "¡Las notificaciones están activas en este dispositivo! 🔔", url: "/dashboard", tag: "test" });
  return { ok: true as const };
}
