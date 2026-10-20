import "server-only";
import { after } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { sendEmail } from "@/lib/email/send";
import { renderTicketEmail, type TicketEmailInput } from "@/lib/email/template";
import { sendPush } from "@/lib/push";

export type UserNotification = {
  userIds: number[];
  /** Título corto de la notificación en el celular */
  title: string;
  body: string;
  /** Ruta dentro de la plataforma (ej. /equipo/revisiones/3) */
  url: string;
  /** Si se pasa, también se envía por correo */
  email?: Omit<TicketEmailInput, "ctaUrl"> & { subject: string; kind: string };
};

/** Avisa a personas por notificación push y, opcionalmente, por correo. No bloquea la respuesta. */
export function notifyUsers(n: UserNotification) {
  const task = async () => {
    const ids = Array.from(new Set(n.userIds)).filter(Boolean);
    if (ids.length === 0) return;
    await sendPush(ids, { title: n.title, body: n.body, url: n.url });
    if (n.email) {
      const db = await getDb();
      const people = await db.select({ email: users.email, active: users.active }).from(users).where(inArray(users.id, ids));
      const to = people.filter((p) => p.active).map((p) => p.email);
      if (to.length === 0) return;
      const { subject, kind, ...rest } = n.email;
      const { appUrl } = await import("@/lib/constants");
      const { html, text } = renderTicketEmail({ ...rest, ctaUrl: appUrl(n.url) });
      await sendEmail({ kind, to, subject, html, text });
    }
  };
  const run = () => task().catch((e) => console.error("[mesa-de-ayuda] Error enviando notificación:", e));
  try {
    after(run);
  } catch {
    void run();
  }
}

export async function adminIds() {
  const db = await getDb();
  const rows = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin"));
  return rows.map((r) => r.id);
}
