"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Chip, cx, H1, Notice } from "@/components/ui";
import { FoodArt } from "@/components/FoodArt";
import { ProfileSwitch } from "@/components/ProfileSwitch";
import { useApp } from "@/lib/app-context";
import { computeDay } from "@/lib/day";
import { addDays, longDate, num, shortDate, time12, weekday, WEEKDAY_SHORT, weekStart } from "@/lib/format";
import { useTable } from "@/lib/hooks";
import { plateSummary, snackTitle } from "@/lib/menu/core";
import type { OverrideMap } from "@/lib/menu/planner";
import type { MenuOverride } from "@/lib/types";

export default function MenuPage() {
  const { active, today, householdId } = useApp();
  const [offset, setOffset] = useState(0);
  const [sel, setSel] = useState(today);
  const ws = addDays(weekStart(today), offset * 7);
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  const ov = useTable<MenuOverride>("menu_overrides", { match: { household_id: householdId }, range: { col: "date", from: ws, to: addDays(ws, 6) } }, [ws]);
  const overrides: OverrideMap = useMemo(() => Object.fromEntries(ov.rows.map((o) => [`${o.date}:${o.slot}`, o.recipe_slug])), [ov.rows]);
  const date = days.includes(sel) ? sel : days[0];
  const day = active ? computeDay({ profile: active, date, today, overrides, logs: [] }) : null;
  if (!active || !day) return null;
  return (
    <div className="space-y-5">
      <header className="space-y-3"><ProfileSwitch /><H1>Menú de la semana</H1><p className="text-muted">Un solo menú para los dos, con porciones distintas. Mostrando las porciones de {active.name}.</p></header>

      <div className="flex items-center justify-between">
        <button aria-label="Semana anterior" onClick={() => setOffset((o) => o - 1)} className="grid h-10 w-10 place-items-center rounded-full bg-surface"><ChevronLeft size={18} /></button>
        <p className="font-display text-lg font-semibold">{shortDate(days[0])} – {shortDate(days[6])}</p>
        <button aria-label="Semana siguiente" onClick={() => setOffset((o) => o + 1)} className="grid h-10 w-10 place-items-center rounded-full bg-surface"><ChevronRight size={18} /></button>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => (
          <button key={d} onClick={() => setSel(d)} aria-pressed={d === date} className={cx("rounded-2xl py-2 text-center", d === date ? "bg-brand text-brand-ink" : "bg-surface")}>
            <p className="text-[11px] opacity-80">{WEEKDAY_SHORT[weekday(d)]}</p>
            <p className="font-display tabular text-lg font-semibold">{Number(d.slice(8))}</p>
          </button>
        ))}
      </div>

      <p className="font-display text-xl font-semibold capitalize">{longDate(date)}</p>
      <p className="text-sm text-muted tabular">{num(day.targets.kcal)} kcal · {num(day.targets.proteinG)} g de proteína</p>

      <ul className="space-y-3">
        {day.slots.map((s) => (
          <li key={s.slot}>
            <Link href={`/receta/${s.recipe.slug}?date=${date}&slot=${s.slot}`} className="flex gap-3 rounded-3xl bg-surface p-3 transition-colors hover:bg-surface-2">
              <FoodArt art={s.recipe.art} className="h-20 w-24 shrink-0 rounded-2xl" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted">{s.label} · {time12(s.baseTime)}</p>
                <p className="font-display text-base font-semibold leading-snug">{s.proteinOnly && s.recipe.kind === "snack" ? snackTitle(s.portion.lines) : s.recipe.name}</p>
                <p className="mt-1 line-clamp-2 text-xs text-muted">{s.proteinOnly ? "Solo proteína" : plateSummary(s.portion.lines)}</p>
                <div className="mt-1 flex flex-wrap gap-1.5"><Chip tone="brand">{num(Math.round(s.portion.macros.p))} g proteína</Chip><Chip>{num(Math.round(s.portion.macros.kcal))} kcal</Chip></div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      {active.mode === "pregnancy" && <Notice tone="plum">Los ingredientes no aptos para el embarazo ya están sustituidos en las porciones que ves aquí.</Notice>}
      <div className="grid grid-cols-2 gap-3 text-center font-medium">
        <Link href="/mercado" className="rounded-3xl bg-brand-soft p-4 text-brand">Lista de mercado</Link>
        <Link href="/meriendas" className="rounded-3xl bg-surface p-4">Biblioteca de meriendas</Link>
      </div>
    </div>
  );
}
