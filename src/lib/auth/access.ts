import "server-only";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { appUrl } from "@/lib/constants";
import { sendEmail } from "@/lib/email/send";
import { renderTicketEmail } from "@/lib/email/template";

export const REMEMBER_COOKIE = "hd_remember";

export const newAccessToken = () => randomBytes(24).toString("base64url");

/** Devuelve el enlace personal de la persona (lo crea si no existe). */
export async function ensureAccessToken(userId: number) {
  const db = await getDb();
  const [u] = await db.select({ token: users.accessToken }).from(users).where(eq(users.id, userId));
  if (u?.token) return u.token;
  const token = newAccessToken();
  await db.update(users).set({ accessToken: token }).where(eq(users.id, userId));
  return token;
}

export function accessUrl(token: string) {
  return appUrl(`/acceso/${token}`);
}

export async function findByAccessToken(token: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const db = await getDb();
  const [u] = await db.select().from(users).where(eq(users.accessToken, token));
  return u ?? null;
}

export async function sendAccessLinkEmail(user: { id: number; name: string; email: string; passwordHash: string }) {
  const token = await ensureAccessToken(user.id);
  const first = user.name.split(" ")[0];
  const needsPassword = !user.passwordHash;
  const { html, text } = renderTicketEmail({
    preheader: "Tu acceso directo a Conecta ACF",
    eyebrow: "Tu acceso personal",
    heading: `${first}, aquí tienes tu llave a Conecta ACF 🔑`,
    intro: needsPassword
      ? "Ábrelo, crea tu contraseña y listo: desde ahí radicas solicitudes, ves cómo van y respondes. Te recomendamos guardarlo en favoritos.\n\nEs personal, así que mejor no lo compartas."
      : "Ábrelo y escribe tu contraseña: desde ahí radicas solicitudes, ves cómo van y respondes. Te recomendamos guardarlo en favoritos.\n\nEs personal, así que mejor no lo compartas.",
    code: "Acceso personal",
    title: user.email,
    pills: [],
    details: [],
    compact: true,
    ctaLabel: needsPassword ? "Crear mi contraseña" : "Entrar a Conecta ACF",
    ctaUrl: accessUrl(token),
  });
  await sendEmail({ kind: "access", to: [user.email], subject: "Tu acceso a Conecta ACF", html, text });
}
