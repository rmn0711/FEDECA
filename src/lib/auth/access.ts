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
    preheader: "Tu acceso directo a la Mesa de Ayuda ACF",
    eyebrow: "Tu acceso",
    heading: `${first}, este es tu enlace a la Mesa de Ayuda`,
    intro: needsPassword
      ? "Ábrelo y crea tu contraseña. Después solo tendrás que escribirla para radicar solicitudes, consultarlas y responder. Guarda el enlace en tus favoritos."
      : "Ábrelo y escribe tu contraseña para radicar solicitudes, consultarlas y responder. Guarda el enlace en tus favoritos.",
    code: "Acceso personal",
    title: user.email,
    pills: [],
    details: [["Importante", "Este enlace es personal: no lo compartas."]],
    ctaLabel: needsPassword ? "Crear mi contraseña" : "Entrar a la Mesa de Ayuda",
    ctaUrl: accessUrl(token),
  });
  await sendEmail({ kind: "access", to: [user.email], subject: "Tu acceso a la Mesa de Ayuda ACF", html, text });
}
