import "server-only";
import { headers } from "next/headers";
import { getDb } from "@/lib/db";
import { auditLog } from "@/lib/db/schema";

export type AuditEntity =
  | "usuario"
  | "sesion"
  | "categoria"
  | "configuracion"
  | "solicitud"
  | "proyecto"
  | "tarea"
  | "pagina"
  | "canal"
  | "articulo"
  | "plantilla"
  | "aprobacion"
  | "metricas";

/**
 * Registra quién hizo qué y cuándo. Nunca debe tumbar la acción que audita:
 * si falla el registro, solo se informa en el log del servidor.
 */
export async function audit(
  actorId: number | null,
  action: string,
  entity: AuditEntity,
  entityId: string | number | null,
  summary: string,
  meta: Record<string, unknown> = {}
) {
  try {
    let ip: string | null = null;
    try {
      const h = await headers();
      ip = (h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "").split(",")[0].trim() || null;
    } catch {
      // fuera de una petición (scripts): sin IP
    }
    const db = await getDb();
    await db.insert(auditLog).values({
      actorId,
      action,
      entity,
      entityId: entityId === null ? null : String(entityId),
      summary: summary.slice(0, 500),
      meta,
      ip,
    });
  } catch (e) {
    console.error("[mesa-de-ayuda] No se pudo registrar la auditoría:", e);
  }
}
