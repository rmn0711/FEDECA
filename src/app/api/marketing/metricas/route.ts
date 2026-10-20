import { timingSafeEqual } from "node:crypto";
import { normalizeRow, upsertMetrics, type MetricRow } from "@/lib/marketing/metrics";
import { audit } from "@/lib/audit";

/**
 * Carga automática de métricas (desde el CRM, el cotizador o una hoja de cálculo).
 * POST con "Authorization: Bearer MARKETING_API_KEY" y JSON:
 *   [{ "mes": "2026-10", "proyecto": "Torres del Parque", "canal": "Meta Ads",
 *      "inversion": 4500000, "leads": 120, "calificados": 48, "visitas": 20,
 *      "cotizaciones": 12, "separaciones": 3, "impresiones": 0, "clics": 0 }]
 * Reemplaza los valores de cada (mes, proyecto, canal).
 */
export async function POST(request: Request) {
  const key = process.env.MARKETING_API_KEY;
  const given = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!key || given.length !== key.length || !timingSafeEqual(Buffer.from(given), Buffer.from(key))) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "JSON no válido" }, { status: 400 });
  }
  const list = Array.isArray(body) ? body : [body];
  const rows = list
    .map((r) =>
      normalizeRow({
        month: r?.mes ?? r?.month,
        project: r?.proyecto ?? r?.project,
        channel: r?.canal ?? r?.channel,
        spend: r?.inversion ?? r?.spend,
        impressions: r?.impresiones ?? r?.impressions,
        clicks: r?.clics ?? r?.clicks,
        leads: r?.leads,
        qualified: r?.calificados ?? r?.qualified,
        visits: r?.visitas ?? r?.visits,
        quotes: r?.cotizaciones ?? r?.quotes,
        sales: r?.separaciones ?? r?.sales,
      })
    )
    .filter((r): r is MetricRow => r !== null);
  if (rows.length === 0) return Response.json({ error: "No hay filas válidas (mes AAAA-MM, proyecto y canal son obligatorios)." }, { status: 422 });
  await upsertMetrics(rows, null, "api");
  await audit(null, "importar", "metricas", rows[0].month, `Carga automática por API: ${rows.length} fila(s)`);
  return Response.json({ ok: true, saved: rows.length });
}
