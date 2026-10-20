"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { marketingMetrics } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { normalizeRow, upsertMetrics, type MetricRow } from "@/lib/marketing/metrics";

type Result<T = null> = { ok: true; data: T } | { ok: false; error: string };

export async function saveMetricsAction(rows: Array<Partial<MetricRow>>): Promise<Result<{ saved: number }>> {
  const me = await requireRole("admin", "agent");
  const valid = rows.map(normalizeRow).filter((r): r is MetricRow => r !== null);
  if (valid.length === 0) return { ok: false, error: "Completa mes, proyecto y canal en al menos una fila." };
  await upsertMetrics(valid, me.id, "manual");
  await audit(me.id, "actualizar", "metricas", valid[0].month, `Métricas de marketing guardadas: ${valid.length} fila(s) de ${valid[0].month}`);
  revalidatePath("/equipo/marketing");
  return { ok: true, data: { saved: valid.length } };
}

export async function deleteMetricAction(month: string, project: string, channel: string): Promise<Result> {
  const me = await requireRole("admin", "agent");
  const db = await getDb();
  await db
    .delete(marketingMetrics)
    .where(and(eq(marketingMetrics.month, month), eq(marketingMetrics.project, project), eq(marketingMetrics.channel, channel)));
  await audit(me.id, "eliminar", "metricas", month, `Fila eliminada: ${project} · ${channel} (${month})`);
  revalidatePath("/equipo/marketing");
  return { ok: true, data: null };
}

const HEADER_MAP: Record<string, string> = {
  mes: "month", month: "month",
  proyecto: "project", project: "project", campana: "project",
  canal: "channel", channel: "channel", fuente: "channel",
  inversion: "spend", spend: "spend", presupuesto: "spend",
  impresiones: "impressions", impressions: "impressions",
  clics: "clicks", clicks: "clicks",
  leads: "leads",
  calificados: "qualified", "leads calificados": "qualified", qualified: "qualified",
  visitas: "visits", "visitas a sala": "visits", visits: "visits",
  cotizaciones: "quotes", quotes: "quotes",
  separaciones: "sales", ventas: "sales", sales: "sales",
};

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Importa datos pegados desde Excel o un CSV (separado por coma, punto y coma o tabulador). */
export async function importMetricsCsvAction(text: string, defaultMonth: string): Promise<Result<{ saved: number; skipped: number }>> {
  const me = await requireRole("admin", "agent");
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { ok: false, error: "Pega la fila de encabezados y al menos una fila de datos." };
  const sep = lines[0].includes("\t") ? "\t" : lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(sep).map((h) => HEADER_MAP[fold(h)] ?? null);
  if (!headers.includes("project") || !headers.includes("channel")) {
    return { ok: false, error: "El encabezado debe incluir al menos «Proyecto» y «Canal»." };
  }
  const rows: MetricRow[] = [];
  let skipped = 0;
  for (const line of lines.slice(1)) {
    const cells = line.split(sep);
    const obj: Record<string, unknown> = { month: defaultMonth };
    headers.forEach((h, i) => h && (obj[h] = cells[i]?.trim()));
    const r = normalizeRow(obj);
    if (r) rows.push(r);
    else skipped++;
  }
  if (rows.length === 0) return { ok: false, error: "No se encontraron filas válidas." };
  await upsertMetrics(rows, me.id, "csv");
  await audit(me.id, "importar", "metricas", defaultMonth, `Importación CSV de métricas: ${rows.length} fila(s)`);
  revalidatePath("/equipo/marketing");
  return { ok: true, data: { saved: rows.length, skipped } };
}
