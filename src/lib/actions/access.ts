"use server";

import bcrypt from "bcryptjs";
import { and, eq, gte, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { auditLog, users } from "@/lib/db/schema";
import { startSession } from "@/lib/auth";
import { validatePassword } from "@/lib/auth/password";
import { REMEMBER_COOKIE, findByAccessToken } from "@/lib/auth/access";
import { audit } from "@/lib/audit";
import type { FormState } from "./auth";

const MAX_FAILS = 8;
const WINDOW_MS = 15 * 60_000;

function safeNext(next: unknown) {
  const n = typeof next === "string" ? next : "";
  return n.startsWith("/") && !n.startsWith("//") ? n : "/dashboard";
}

/** Ingreso con enlace personal: la persona solo escribe su contraseña (o la crea la primera vez). */
export async function accessLoginAction(_: FormState, formData: FormData): Promise<FormState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const user = await findByAccessToken(token);
  if (!user || !user.active) return { error: "Este enlace ya no es válido. Pide uno nuevo al administrador." };

  const db = await getDb();
  // Bloqueo temporal tras varios intentos fallidos (protege el enlace si alguien más lo obtiene).
  const [{ fails }] = await db
    .select({ fails: sql<number>`count(*)::int` })
    .from(auditLog)
    .where(and(eq(auditLog.actorId, user.id), eq(auditLog.action, "ingreso_fallido"), gte(auditLog.createdAt, new Date(Date.now() - WINDOW_MS))));
  if (fails >= MAX_FAILS) return { error: "Demasiados intentos. Espera 15 minutos o usa «¿Olvidaste tu contraseña?»." };

  if (!user.passwordHash) {
    const confirm = String(formData.get("confirm") ?? "");
    if (password !== confirm) return { error: "Las contraseñas no coinciden." };
    const pwError = validatePassword(password);
    if (pwError) return { error: pwError };
    await db.update(users).set({ passwordHash: await bcrypt.hash(password, 10) }).where(eq(users.id, user.id));
    await audit(user.id, "crear_clave", "usuario", user.id, `${user.name} creó su contraseña desde su enlace de acceso`);
  } else if (!(await bcrypt.compare(password, user.passwordHash))) {
    await audit(user.id, "ingreso_fallido", "sesion", null, `Contraseña incorrecta en el enlace de acceso de ${user.email}`);
    return { error: "Contraseña incorrecta." };
  }

  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
  await audit(user.id, "ingreso", "sesion", null, `${user.name} inició sesión con su enlace de acceso`);
  await startSession(user.id);
  // El navegador recuerda a la persona: la próxima vez /login solo pide la contraseña.
  (await cookies()).set(REMEMBER_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect(safeNext(formData.get("next")));
}

export async function forgetDeviceAction() {
  (await cookies()).delete(REMEMBER_COOKIE);
  redirect("/login");
}
