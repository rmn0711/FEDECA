import "server-only";
import webpush from "web-push";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { pushSubscriptions } from "@/lib/db/schema";
import { sendTeams } from "@/lib/teams/send";

let configured: boolean | null = null;

export function pushEnabled() {
  if (configured !== null) return configured;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return (configured = false);
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:mesadeayuda@acfcia.com", pub, priv);
  return (configured = true);
}

/**
 * Envía una notificación push a todos los dispositivos de esas personas.
 * Las suscripciones vencidas (el navegador las revocó) se eliminan.
 */
export async function sendPush(userIds: number[], payload: { title: string; body: string; url: string; tag?: string }) {
  await Promise.all([
    sendBrowserPush(userIds, payload).catch(() => console.error("[conecta] No se pudo procesar el aviso push.")),
    sendTeams(userIds, payload).catch(() => console.error("[conecta] No se pudo procesar el aviso de Teams.")),
  ]);
}

async function sendBrowserPush(userIds: number[], payload: { title: string; body: string; url: string; tag?: string }) {
  if (!pushEnabled() || userIds.length === 0) return;
  const db = await getDb();
  const subs = await db.select().from(pushSubscriptions).where(inArray(pushSubscriptions.userId, userIds));
  const message = JSON.stringify({ ...payload, tag: payload.tag ?? payload.url });
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, message, { TTL: 60 * 60 * 24 });
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, s.endpoint));
        } else {
          console.error("[conecta] Error enviando push:", status ?? e);
        }
      }
    })
  );
}

