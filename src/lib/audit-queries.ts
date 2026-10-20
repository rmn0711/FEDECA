import "server-only";
import { and, desc, eq, gte, ilike, lte, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { auditLog, users } from "@/lib/db/schema";

export type AuditFilters = { entidad?: string; usuario?: string; q?: string; desde?: string; hasta?: string; pagina?: string };
export const AUDIT_PAGE = 50;

export async function getAuditLog(f: AuditFilters) {
  const db = await getDb();
  const conds = [
    f.entidad ? eq(auditLog.entity, f.entidad) : undefined,
    f.usuario ? eq(auditLog.actorId, Number(f.usuario)) : undefined,
    f.q?.trim() ? ilike(auditLog.summary, `%${f.q.trim()}%`) : undefined,
    f.desde && /^\d{4}-\d{2}-\d{2}$/.test(f.desde) ? gte(auditLog.createdAt, new Date(`${f.desde}T05:00:00Z`)) : undefined,
    f.hasta && /^\d{4}-\d{2}-\d{2}$/.test(f.hasta) ? lte(auditLog.createdAt, new Date(new Date(`${f.hasta}T05:00:00Z`).getTime() + 86_400_000)) : undefined,
  ];
  const where = and(...conds);
  const page = Math.max(1, Number(f.pagina) || 1);
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: auditLog.id,
        action: auditLog.action,
        entity: auditLog.entity,
        entityId: auditLog.entityId,
        summary: auditLog.summary,
        ip: auditLog.ip,
        createdAt: auditLog.createdAt,
        actorName: users.name,
      })
      .from(auditLog)
      .leftJoin(users, eq(users.id, auditLog.actorId))
      .where(where)
      .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
      .limit(AUDIT_PAGE)
      .offset((page - 1) * AUDIT_PAGE),
    db.select({ total: sql<number>`count(*)::int` }).from(auditLog).where(where),
  ]);
  return { rows, total, page, pages: Math.max(1, Math.ceil(total / AUDIT_PAGE)) };
}
