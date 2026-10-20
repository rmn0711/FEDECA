import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users, type User } from "@/lib/db/schema";
import type { Role } from "@/lib/constants";
import { SESSION_COOKIE, SESSION_DAYS, readSession, signSession } from "./session";

export type SessionUser = Omit<User, "passwordHash" | "accessToken" | "sessionVersion">;

export async function startSession(userId: number) {
  const db = await getDb();
  const [u] = await db.select({ sv: users.sessionVersion }).from(users).where(eq(users.id, userId));
  const token = await signSession(userId, u?.sv ?? 0);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Usuario de la sesión actual (o null). Se memoriza por petición. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const session = await readSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const db = await getDb();
  const [user] = await db.select().from(users).where(eq(users.id, session.uid)).limit(1);
  // Cuenta desactivada o contraseña cambiada después de iniciar esta sesión.
  if (!user || !user.active || user.sessionVersion !== session.sv) return null;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, accessToken, sessionVersion, ...rest } = user;
  return rest;
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect("/sin-acceso");
  return user;
}

export function isStaff(user: Pick<SessionUser, "role">) {
  return user.role === "admin" || user.role === "agent";
}

/** Cierra todas las sesiones abiertas de una persona (al cambiar o restablecer su contraseña). */
export async function revokeSessions(userId: number) {
  const db = await getDb();
  await db.update(users).set({ sessionVersion: sql`${users.sessionVersion} + 1` }).where(eq(users.id, userId));
}
