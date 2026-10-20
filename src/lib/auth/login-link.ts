import "server-only";
import { createHash } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { loginLinks, users } from "@/lib/db/schema";

export const LINK_TOKEN_RE = /^[A-Za-z0-9_-]{40,64}$/;
export const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

/** Enlace vigente (sin usar ni vencer) y la persona a la que pertenece, si ya tiene cuenta. */
export async function findLoginLink(token: string) {
  if (!LINK_TOKEN_RE.test(token)) return null;
  const db = await getDb();
  const [link] = await db
    .select()
    .from(loginLinks)
    .where(and(eq(loginLinks.tokenHash, sha256(token)), isNull(loginLinks.usedAt), gt(loginLinks.expiresAt, new Date())));
  if (!link) return null;
  const [user] = await db.select({ id: users.id, name: users.name, active: users.active }).from(users).where(eq(users.email, link.email));
  return { email: link.email, user: user ?? null };
}
