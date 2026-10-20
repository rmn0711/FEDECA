import "server-only";
import { and, asc, eq, gte, lte, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { marketingMetrics } from "@/lib/db/schema";

export const METRIC_KEYS = ["spend", "impressions", "clicks", "leads", "qualified", "visits", "quotes", "sales"] as const;
export type MetricKey = (typeof METRIC_KEYS)[number];

export const METRIC_LABELS: Record<MetricKey, string> = {
  spend: "Inversión (COP)",
  impressions: "Impresiones",
  clicks: "Clics",
  leads: "Leads",
  qualified: "Leads calificados",
  visits: "Visitas a sala",
  quotes: "Cotizaciones",
  sales: "Separaciones",
};

export const DEFAULT_CHANNELS = [
  "Meta Ads",
  "Google Ads",
  "TikTok Ads",
  "Orgánico redes",
  "Sitio web / SEO",
  "WhatsApp",
  "Email marketing",
  "Referidos",
  "Sala de ventas",
  "Ferias / eventos",
  "Portales inmobiliarios",
];

export type MetricRow = {
  month: string;
  project: string;
  channel: string;
} & Record<MetricKey, number>;

const clean = (v: unknown) => {
  const n = Number(String(v ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
};

export function normalizeRow(r: Partial<Record<string, unknown>>): MetricRow | null {
  const month = String(r.month ?? "").trim();
  const project = String(r.project ?? "").trim().slice(0, 80);
  const channel = String(r.channel ?? "").trim().slice(0, 60);
  if (!/^\d{4}-\d{2}$/.test(month) || !project || !channel) return null;
  const row = { month, project, channel } as MetricRow;
  for (const k of METRIC_KEYS) row[k] = clean(r[k]);
  return row;
}

/** Inserta o reemplaza los valores de (mes, proyecto, canal). */
export async function upsertMetrics(rows: MetricRow[], userId: number | null, source: "manual" | "csv" | "api") {
  const db = await getDb();
  for (const r of rows) {
    const values = { ...r, source, updatedBy: userId, updatedAt: new Date() };
    await db
      .insert(marketingMetrics)
      .values(values)
      .onConflictDoUpdate({
        target: [marketingMetrics.month, marketingMetrics.project, marketingMetrics.channel],
        set: { ...Object.fromEntries(METRIC_KEYS.map((k) => [k, r[k]])), source, updatedBy: userId, updatedAt: new Date() },
      });
  }
}

export async function getMetrics(from: string, to: string, project?: string) {
  const db = await getDb();
  return db
    .select()
    .from(marketingMetrics)
    .where(and(gte(marketingMetrics.month, from), lte(marketingMetrics.month, to), project ? eq(marketingMetrics.project, project) : undefined))
    .orderBy(asc(marketingMetrics.month), asc(marketingMetrics.project), asc(marketingMetrics.channel));
}

export async function getMetricOptions() {
  const db = await getDb();
  const [projects, channels, months] = await Promise.all([
    db.selectDistinct({ v: marketingMetrics.project }).from(marketingMetrics).orderBy(asc(marketingMetrics.project)),
    db.selectDistinct({ v: marketingMetrics.channel }).from(marketingMetrics).orderBy(asc(marketingMetrics.channel)),
    db.select({ v: sql<string>`max(${marketingMetrics.month})` }).from(marketingMetrics),
  ]);
  return {
    projects: projects.map((p) => p.v),
    channels: Array.from(new Set([...DEFAULT_CHANNELS, ...channels.map((c) => c.v)])),
    lastMonth: months[0]?.v ?? null,
  };
}

/** Totales y razones derivadas (CPL, conversión, costo por separación). */
export function totals(rows: Array<Record<MetricKey, number>>) {
  const t = Object.fromEntries(METRIC_KEYS.map((k) => [k, rows.reduce((a, r) => a + (r[k] ?? 0), 0)])) as Record<MetricKey, number>;
  return {
    ...t,
    cpl: t.leads ? t.spend / t.leads : null,
    costPerSale: t.sales ? t.spend / t.sales : null,
    qualifiedRate: t.leads ? t.qualified / t.leads : null,
    leadToSale: t.leads ? t.sales / t.leads : null,
    ctr: t.impressions ? t.clicks / t.impressions : null,
  };
}
