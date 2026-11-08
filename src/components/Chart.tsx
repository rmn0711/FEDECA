"use client";
import { num, shortDate } from "@/lib/format";

export interface Series {
  name: string;
  color: string;
  points: { x: number | string; y: number }[];
  dashed?: boolean;
  dots?: boolean;
}
export interface Band {
  name: string;
  color: string;
  points: { x: number | string; lo: number; hi: number }[];
}

const xVal = (x: number | string) => (typeof x === "number" ? x : Date.parse(x + "T00:00:00Z") / 86400000);

export function LineChart({ series, band, height = 180, decimals = 1, unit = "", xIsDate = true, title, goal }: { series: Series[]; band?: Band; height?: number; decimals?: number; unit?: string; xIsDate?: boolean; title: string; goal?: number }) {
  const all = series.flatMap((s) => s.points);
  if (all.length === 0) return <p className="py-8 text-center text-sm text-muted">Aún no hay datos para esta gráfica.</p>;
  const W = 340;
  const H = height;
  const pad = { l: 40, r: 10, t: 10, b: 24 };
  const xs = [...all.map((p) => xVal(p.x)), ...(band?.points.map((p) => xVal(p.x)) ?? [])];
  const ys = [...all.map((p) => p.y), ...(band?.points.flatMap((p) => [p.lo, p.hi]) ?? []), ...(goal != null ? [goal] : [])];
  let x0 = Math.min(...xs);
  let x1 = Math.max(...xs);
  if (x1 === x0) { x0 -= 1; x1 += 1; }
  let y0 = Math.min(...ys);
  let y1 = Math.max(...ys);
  const padY = (y1 - y0) * 0.12 || 1;
  y0 -= padY; y1 += padY;
  const sx = (x: number | string) => pad.l + ((xVal(x) - x0) / (x1 - x0)) * (W - pad.l - pad.r);
  const sy = (y: number) => H - pad.b - ((y - y0) / (y1 - y0)) * (H - pad.t - pad.b);
  const ticks = 4;
  const yTicks = Array.from({ length: ticks + 1 }, (_, i) => y0 + ((y1 - y0) * i) / ticks);
  const fmtX = (v: number) => (xIsDate ? shortDate(new Date(v * 86400000).toISOString().slice(0, 10)) : num(v));
  const xTicks = [x0, (x0 + x1) / 2, x1];
  const path = (pts: { x: number | string; y: number }[]) => pts.map((p, i) => `${i ? "L" : "M"}${sx(p.x).toFixed(1)} ${sy(p.y).toFixed(1)}`).join(" ");
  const bandPath = band && band.points.length > 1 ? band.points.map((p, i) => `${i ? "L" : "M"}${sx(p.x).toFixed(1)} ${sy(p.hi).toFixed(1)}`).join(" ") + " " + [...band.points].reverse().map((p) => `L${sx(p.x).toFixed(1)} ${sy(p.lo).toFixed(1)}`).join(" ") + " Z" : null;
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title} className="w-full">
        <title>{title}</title>
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={pad.l} x2={W - pad.r} y1={sy(t)} y2={sy(t)} stroke="#e6e2d6" strokeWidth="1" />
            <text x={pad.l - 6} y={sy(t) + 3} textAnchor="end" fontSize="9" fill="#647068" className="tabular">{num(t, decimals)}</text>
          </g>
        ))}
        {xTicks.map((t, i) => (
          <text key={i} x={sx(t)} y={H - 6} textAnchor={i === 0 ? "start" : i === 2 ? "end" : "middle"} fontSize="9" fill="#647068">{fmtX(t)}</text>
        ))}
        {bandPath && <path d={bandPath} fill={band!.color} opacity="0.22" />}
        {goal != null && <line x1={pad.l} x2={W - pad.r} y1={sy(goal)} y2={sy(goal)} stroke="#2c6a56" strokeDasharray="4 3" strokeWidth="1.2" />}
        {series.map((s) => (
          <g key={s.name}>
            {s.points.length > 1 && <path d={path(s.points)} fill="none" stroke={s.color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" strokeDasharray={s.dashed ? "5 4" : undefined} />}
            {(s.dots || s.points.length === 1) && s.points.map((p, i) => <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r="3" fill={s.color} />)}
          </g>
        ))}
      </svg>
      <figcaption className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {series.map((s) => (
          <span key={s.name} className="inline-flex items-center gap-1.5"><span className="inline-block h-2 w-4 rounded-full" style={{ background: s.color }} />{s.name}</span>
        ))}
        {band && <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2 w-4 rounded-full opacity-40" style={{ background: band.color }} />{band.name}</span>}
        {unit && <span>({unit})</span>}
      </figcaption>
    </figure>
  );
}
