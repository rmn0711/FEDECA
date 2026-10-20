"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";

/**
 * Kit de gráficos con la paleta categórica validada (mismos tonos del cotizador):
 * serie 1 azul, serie 2 naranja; trazos de 2 px, cuadrícula fina y recesiva,
 * leyenda siempre que hay 2+ series y el texto nunca en el color de la serie.
 */
export const SERIES = ["#2a78d6", "#eb6834"] as const;

export type TrendPoint = { label: string } & Record<string, number | string>;

function ChartTooltip({ active, payload, label, format }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string; format?: (v: number) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-semibold capitalize">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 text-muted-foreground">
          <span className="size-2 rounded-full" style={{ background: p.color }} />
          {p.name}: <span className="font-semibold text-foreground tabular-nums">{format ? format(p.value) : p.value.toLocaleString("es-CO")}</span>
        </p>
      ))}
    </div>
  );
}

/** Tendencia de una o dos series con la misma unidad (nunca doble eje). */
export function TrendChart({
  data,
  series,
  height = 240,
  format,
}: {
  data: TrendPoint[];
  series: Array<{ key: string; name: string }>;
  height?: number;
  format?: (v: number) => string;
}) {
  return (
    <div className="space-y-2">
      {series.length > 1 && (
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground" aria-hidden>
          {series.map((s, i) => (
            <span key={s.key} className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded-full" style={{ background: SERIES[i] }} />
              {s.name}
            </span>
          ))}
        </div>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ left: 0, right: 16, top: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={{ stroke: "var(--border)" }} />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            width={44}
            tickFormatter={(v: number) => (format ? format(v) : v >= 1000 ? `${Math.round(v / 100) / 10}K` : String(v))}
          />
          <Tooltip content={<ChartTooltip format={format} />} cursor={{ stroke: "var(--border)" }} />
          {series.map((s, i) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stroke={SERIES[i]}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              dot={{ r: 4, fill: SERIES[i], stroke: "var(--card)", strokeWidth: 2 }}
              activeDot={{ r: 6, stroke: "var(--card)", strokeWidth: 2 }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Barras horizontales de una sola serie (magnitud → un solo tono). Barras finas
 * con extremo redondeado, valor al final de la barra y detalle al pasar el mouse.
 */
export function BarList({
  items,
  format,
  className,
  emptyText = "Sin datos en el periodo.",
}: {
  items: Array<{ label: string; value: number; hint?: string }>;
  format?: (v: number) => string;
  className?: string;
  emptyText?: string;
}) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className={cn("space-y-2.5", className)}>
      {items.map((i) => (
        <li key={i.label} className="group" title={`${i.label}: ${format ? format(i.value) : i.value.toLocaleString("es-CO")}${i.hint ? ` · ${i.hint}` : ""}`}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">{i.label}</span>
            <span className="shrink-0 font-semibold tabular-nums">
              {format ? format(i.value) : i.value.toLocaleString("es-CO")}
              {i.hint && <span className="ml-1.5 text-xs font-normal text-muted-foreground">{i.hint}</span>}
            </span>
          </div>
          <div className="h-2.5 rounded-r-[4px] bg-muted/60">
            <div
              className="h-full rounded-r-[4px] transition-opacity group-hover:opacity-80"
              style={{ width: `${Math.max(1.5, (i.value / max) * 100)}%`, background: SERIES[0] }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
