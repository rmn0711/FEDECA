"use server";

import { safeNextPath } from "@/lib/secure";
import { audit } from "@/lib/audit";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { and, eq, gt, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { passwordResets, users } from "@/lib/db/schema";
import { endSession, requireUser, revokeSessions, startSession } from "@/lib/auth";
import { sendEmail } from "@/lib/email/send";
import { renderTicketEmail } from "@/lib/email/template";
import { appUrl } from "@/lib/constants";
import { validatePassword } from "@/lib/auth/password";
import { LOCKED_MESSAGE, isLockedOut } from "@/lib/auth/lockout";

export type FormState = { error: string | null; ok?: string | null };

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

const safeNext = safeNextPath;

export async function login(_: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Ingresa tu correo y contraseña." };

  const db = await getDb();
  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (user && !user.passwordHash) {
    return { error: "Aún no has creado tu contraseña. Ábrela desde tu enlace de acceso o usa «¿Olvidaste tu contraseña?»." };
  }
  if (user && (await isLockedOut(user.id))) return { error: LOCKED_MESSAGE };
  // Siempre se compara un hash para no revelar si el correo existe por el tiempo de respuesta.
  const ok = await bcrypt.compare(password, user?.passwordHash ?? "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva");
  if (!user || !ok) {
    await audit(user?.id ?? null, "ingreso_fallido", "sesion", null, `Intento de ingreso fallido con ${email}`);
    return { error: "Correo o contraseña incorrectos." };
  }
  if (!user.active) {
    await audit(user.id, "ingreso_bloqueado", "sesion", null, `Intento de ingreso de cuenta desactivada (${email})`);
    return { error: "Tu cuenta está desactivada. Contacta al administrador de la mesa de ayuda." };
  }
  await audit(user.id, "ingreso", "sesion", null, `${user.name} inició sesión`);

  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
  await startSession(user.id);
  redirect(safeNext(formData.get("next")));
}

export async function logout() {
  await endSession();
  redirect("/login");
}

function allowedDomains() {
  return (process.env.ALLOWED_EMAIL_DOMAINS ?? "")
    .split(",")
    .map((d) => d.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean);
}

export async function registrationEnabled() {
  return allowedDomains().length > 0;
}

export async function register(_: FormState, formData: FormData): Promise<FormState> {
  const domains = allowedDomains();
  if (domains.length === 0) return { error: "El registro está deshabilitado. Solicita tu usuario al administrador." };
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const department = String(formData.get("department") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (name.length < 3) return { error: "Escribe tu nombre completo." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Correo no válido." };
  if (!domains.includes(email.split("@")[1])) {
    return { error: `Solo se permiten correos corporativos (${domains.map((d) => `@${d}`).join(", ")}).` };
  }
  const pwError = validatePassword(password);
  if (pwError) return { error: pwError };

  const db = await getDb();
  const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (exists) return { error: "Ya existe una cuenta con ese correo. Inicia sesión o recupera tu contraseña." };
  const [user] = await db
    .insert(users)
    .values({ name, email, department: department || null, passwordHash: await bcrypt.hash(password, 10), role: "user" })
    .returning();
  await audit(user.id, "registro", "usuario", user.id, `Auto-registro de ${name} (${email})`);
  await startSession(user.id);
  redirect("/dashboard");
}

export async function requestPasswordReset(_: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const genericOk = { error: null, ok: "Si el correo está registrado, recibirás un enlace para restablecer la contraseña." };
  if (!email) return { error: "Ingresa tu correo." };
  const db = await getDb();
  const [user] = await db.select().from(users).where(and(eq(users.email, email), eq(users.active, true)));
  if (!user) return genericOk;
  // Máximo 3 correos de recuperación por hora para cada cuenta (evita usar la plataforma para spam).
  const recent = await db
    .select({ token: passwordResets.tokenHash })
    .from(passwordResets)
    .where(and(eq(passwordResets.userId, user.id), gt(passwordResets.expiresAt, new Date())));
  if (recent.length >= 3) return genericOk;

  const token = randomBytes(32).toString("base64url");
  await db.insert(passwordResets).values({
    tokenHash: sha256(token),
    userId: user.id,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });
  const url = appUrl(`/recuperar/confirmar?token=${token}`);
  const { html, text } = renderTicketEmail({
    preheader: "Crea una nueva contraseña para Conecta ACF",
    eyebrow: "Cambio de contraseña",
    heading: `${user.name.split(" ")[0]}, creemos una contraseña nueva`,
    intro: "Nos pediste cambiar tu contraseña. Toca el botón y elige una nueva; el enlace dura 1 hora.\n\nSi no fuiste tú, ignora este correo: tu contraseña actual sigue igual.",
    code: "Cuenta",
    title: user.email,
    pills: [],
    details: [],
    compact: true,
    ctaLabel: "Crear nueva contraseña",
    ctaUrl: url,
  });
  await sendEmail({ kind: "password", to: [user.email], subject: "Restablecer contraseña · Conecta ACF", html, text });
  return genericOk;
}

export async function confirmPasswordReset(_: FormState, formData: FormData): Promise<FormState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password !== confirm) return { error: "Las contraseñas no coinciden." };
  const pwError = validatePassword(password);
  if (pwError) return { error: pwError };

  const db = await getDb();
  const [reset] = await db
    .select()
    .from(passwordResets)
    .where(and(eq(passwordResets.tokenHash, sha256(token)), isNull(passwordResets.usedAt), gt(passwordResets.expiresAt, new Date())));
  if (!reset) return { error: "El enlace no es válido o ya venció. Solicita uno nuevo." };

  await db.update(users).set({ passwordHash: await bcrypt.hash(password, 10) }).where(eq(users.id, reset.userId));
  await db.update(passwordResets).set({ usedAt: new Date() }).where(eq(passwordResets.tokenHash, reset.tokenHash));
  await audit(reset.userId, "restablecer_clave", "usuario", reset.userId, "Contraseña restablecida por enlace de correo");
  await revokeSessions(reset.userId);
  await startSession(reset.userId);
  redirect("/dashboard");
}

export async function changePassword(_: FormState, formData: FormData): Promise<FormState> {
  const me = await requireUser();
  const current = String(formData.get("current") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const db = await getDb();
  const [user] = await db.select().from(users).where(eq(users.id, me.id));
  if (!user || !(await bcrypt.compare(current, user.passwordHash))) return { error: "La contraseña actual no es correcta." };
  if (password !== confirm) return { error: "Las contraseñas no coinciden." };
  const pwError = validatePassword(password);
  if (pwError) return { error: pwError };
  await db.update(users).set({ passwordHash: await bcrypt.hash(password, 10) }).where(eq(users.id, me.id));
  await audit(me.id, "cambiar_clave", "usuario", me.id, `${me.name} cambió su contraseña`);
  // Cierra las sesiones de otros dispositivos y mantiene abierta esta.
  await revokeSessions(me.id);
  await startSession(me.id);
  return { error: null, ok: "Contraseña actualizada." };
}

export async function updateProfile(_: FormState, formData: FormData): Promise<FormState> {
  const me = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 3) return { error: "Escribe tu nombre completo." };
  const db = await getDb();
  await db
    .update(users)
    .set({
      name,
      department: String(formData.get("department") ?? "").trim() || null,
      phone: String(formData.get("phone") ?? "").trim() || null,
    })
    .where(eq(users.id, me.id));
  revalidatePath("/", "layout");
  return { error: null, ok: "Perfil actualizado." };
}
