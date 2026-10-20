import "server-only";
import { and, eq, gte, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { auditLog } from "@/lib/db/schema";

const MAX_FAILS = 8;
const WINDOW_MS = 15 * 60_000;

export const LOCKED_MESSAGE = "Demasiados intentos. Espera 15 minutos o usa «¿Olvidaste tu contraseña?».";

/** Bloqueo temporal de una cuenta tras varios intentos fallidos (se cuentan en la auditoría). */
export async function isLockedOut(userId: number) {
  const db = await getDb();
  const [{ fails }] = await db
    .select({ fails: sql<number>`count(*)::int` })
    .from(auditLog)
    .where(and(eq(auditLog.actorId, userId), eq(auditLog.action, "ingreso_fallido"), gte(auditLog.createdAt, new Date(Date.now() - WINDOW_MS))));
  return fails >= MAX_FAILS;
}
