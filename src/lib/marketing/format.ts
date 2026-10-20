export function cop(v: number | null) {
  if (v === null || !Number.isFinite(v)) return "—";
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1).replace(".", ",")} M`;
  if (Math.abs(v) >= 1_000) return `$${Math.round(v / 1_000)} mil`;
  return `$${Math.round(v)}`;
}

export function pctStr(v: number | null, digits = 1) {
  return v === null || !Number.isFinite(v) ? "—" : `${(v * 100).toFixed(digits).replace(".", ",")}%`;
}

export function num(v: number) {
  return v.toLocaleString("es-CO");
}

/** Variación frente al periodo anterior: "+12% vs. periodo anterior". */
export function delta(current: number | null, previous: number | null) {
  if (current === null || previous === null || previous === 0) return null;
  const d = (current - previous) / previous;
  return `${d >= 0 ? "+" : ""}${Math.round(d * 100)}% vs. periodo anterior`;
}
