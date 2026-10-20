"use server";

import { randomBytes } from "node:crypto";
import { and, eq, gt, gte, isNull, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { loginLinks, users } from "@/lib/db/schema";
import { startSession } from "@/lib/auth";
import { newAccessToken } from "@/lib/auth/access";
import { sendEmail } from "@/lib/email/send";
import { renderTicketEmail } from "@/lib/email/template";
import { appUrl } from "@/lib/constants";
import { audit } from "@/lib/audit";
import { safeNextPath } from "@/lib/secure";
import type { FormState } from "./auth";

import { LINK_TOKEN_RE, sha256 } from "@/lib/auth/login-link";
const LINK_MINUTES = 30;

/** Dominios que pueden entrar con su correo aunque aún no tengan cuenta (por defecto @acfcia.com). */
function publicDomains() {
  return (process.env.PUBLIC_REQUEST_DOMAINS || "acfcia.com")
    .split(",")
    .map((d) => d.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean);
}

async function clientIp() {
  const h = await headers();
  return (h.get("x-forwarded-for") ?? "").split(",")[0].trim().slice(0, 64) || null;
}

/** Paso 1 del enlace general: la persona escribe su correo y le enviamos un botón para entrar. */
export async function requestLoginLinkAction(_: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) return { error: "Escribe un correo válido." };
  const domains = publicDomains();
  const db = await getDb();
  const [user] = await db.select({ id: users.id, active: users.active }).from(users).where(eq(users.email, email));
  if (!user && !domains.includes(email.split("@")[1])) {
    return { error: `Usa tu correo corporativo (${domains.map((d) => `@${d}`).join(", ")}).` };
  }
  const sent = { error: null, ok: `Listo. Te enviamos un enlace a ${email} para entrar. Vence en ${LINK_MINUTES} minutos.` };
  // Cuenta desactivada: misma respuesta, sin enviar nada (no revela el estado de la cuenta).
  if (user && !user.active) return sent;

  // Límite: 3 enlaces cada 15 min por correo y 20 por hora desde la misma conexión.
  const ip = await clientIp();
  const [{ byEmail }] = await db
    .select({ byEmail: sql<number>`count(*)::int` })
    .from(loginLinks)
    .where(and(eq(loginLinks.email, email), gte(loginLinks.createdAt, new Date(Date.now() - 15 * 60_000))));
  if (byEmail >= 3) return sent;
  if (ip) {
    const [{ byIp }] = await db
      .select({ byIp: sql<number>`count(*)::int` })
      .from(loginLinks)
      .where(and(eq(loginLinks.ip, ip), gte(loginLinks.createdAt, new Date(Date.now() - 60 * 60_000))));
    if (byIp >= 20) return { error: "Demasiados intentos desde esta conexión. Espera un momento e inténtalo de nuevo." };
  }

  const token = randomBytes(32).toString("base64url");
  await db.insert(loginLinks).values({
    tokenHash: sha256(token),
    email,
    next: safeNextPath(formData.get("next") || "/solicitudes/nueva"),
    ip,
    expiresAt: new Date(Date.now() + LINK_MINUTES * 60_000),
  });
  const url = appUrl(`/entrar/${token}`);
  const { html, text } = renderTicketEmail({
    preheader: "Tu enlace para entrar a Conecta ACF",
    eyebrow: "Tu enlace para entrar",
    heading: "¡Hola! Ya casi estás dentro 👋",
    intro: `Toca el botón y entras directo, sin contraseña. Desde ahí registras tu solicitud, ves cómo va y respondes.\n\nEl enlace sirve una sola vez y dura ${LINK_MINUTES} minutos. Si no lo pediste tú, puedes ignorar este correo tranquilo.`,
    code: "Acceso",
    title: email,
    pills: [],
    details: [],
    compact: true,
    ctaLabel: "Entrar a Conecta ACF",
    ctaUrl: url,
  });
  await sendEmail({ kind: "login_link", to: [email], subject: "Tu enlace para entrar · Conecta ACF", html, text });
  return sent;
}

/**
 * Paso 2: la persona toca «Entrar» en la página del enlace. Se consume con un botón (POST) y no al abrir
 * la página, porque los filtros de correo (Outlook / Defender) abren los enlaces y lo gastarían.
 */
export async function enterWithLinkAction(_: FormState, formData: FormData): Promise<FormState> {
  const token = String(formData.get("token") ?? "");
  if (!LINK_TOKEN_RE.test(token)) return { error: "Este enlace no es válido. Pide uno nuevo." };
  const db = await getDb();
  // Marca el enlace como usado en la misma operación que lo valida: no se puede usar dos veces.
  const [link] = await db
    .update(loginLinks)
    .set({ usedAt: new Date() })
    .where(and(eq(loginLinks.tokenHash, sha256(token)), isNull(loginLinks.usedAt), gt(loginLinks.expiresAt, new Date())))
    .returning();
  if (!link) return { error: "Este enlace ya se usó o venció. Pide uno nuevo desde el enlace de solicitudes." };

  let [user] = await db.select().from(users).where(eq(users.email, link.email));
  if (user && !user.active) return { error: "Tu cuenta está desactivada. Contacta al administrador." };
  if (!user) {
    const name = String(formData.get("name") ?? "").trim().replace(/\s+/g, " ").slice(0, 120);
    const department = String(formData.get("department") ?? "").trim().slice(0, 120);
    if (name.length < 3) {
      // Devuelve el enlace a disponible para que pueda corregir el nombre.
      await db.update(loginLinks).set({ usedAt: null }).where(eq(loginLinks.tokenHash, link.tokenHash));
      return { error: "Escribe tu nombre completo." };
    }
    [user] = await db
      .insert(users)
      .values({ name, email: link.email, department: department || null, role: "user", passwordHash: "", accessToken: newAccessToken() })
      .returning();
    await audit(user.id, "registro", "usuario", user.id, `Ingreso por primera vez con enlace al correo: ${name} (${link.email})`);
  }
  await audit(user.id, "ingreso", "sesion", null, `${user.name} entró con enlace a su correo (sin contraseña)`);
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
  await startSession(user.id);
  redirect(safeNextPath(link.next));
}
