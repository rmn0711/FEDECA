"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bar, Button, Card, Chip, cx, H1, H2, Field, Notice, Select, Stat } from "@/components/ui";
import { useApp } from "@/lib/app-context";
import { ALCOHOL_EXPLANATION, alcoholBlockedByLegDay, alcoholStatus, DRINKS, drinkByKey, entryKcal, entryStd, LIMITS, mixerByKey, MIXERS } from "@/lib/nutrition/alcohol";
import { legDaysOf } from "@/lib/exercise/plan";
import { addDays, num, weekStart } from "@/lib/format";
import { useTable } from "@/lib/hooks";
import type { AlcoholLog } from "@/lib/types";

export default function AlcoholPage() {
  const { active, today, householdId } = useApp();
  const router = useRouter();
  const ws = weekStart(today);
  const logs = useTable<AlcoholLog>("alcohol_logs", active ? { match: { profile_id: active.id }, range: { col: "date", from: ws, to: addDays(ws, 6) } } : null, [active?.id]);
  const [drink, setDrink] = useState("whisky");
  const [mixer, setMixer] = useState("soda");
  const [qty, setQty] = useState(1);

  useEffect(() => { if (active?.mode === "pregnancy") router.replace("/"); }, [active, router]);
  if (!active || active.mode === "pregnancy") return null;

  const status = alcoholStatus(logs.rows, today);
  const block = alcoholBlockedByLegDay(today, legDaysOf(active.training_days));
  const d = drinkByKey(drink)!;
  const mx = mixerByKey(mixer);
  const todays = logs.rows.filter((l) => l.date === today);

  async function add() {
    await logs.insert({ household_id: householdId, profile_id: active!.id, date: today, drink_key: drink, mixer_key: mixer, qty, kcal: entryKcal(d, mx, qty), std_drinks: entryStd(d, qty) });
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1"><H1>Alcohol</H1><p className="text-muted">Máximo {LIMITS.perDay} tragos estándar en un día y {LIMITS.perWeek} por semana, con al menos {LIMITS.minDryDaysPerWeek} días sin alcohol.</p></header>

      {block.blocked && <Notice tone="clay" title="Hoy mejor sin alcohol">{block.reason}</Notice>}
      {status.overDay && <Notice tone="clay" title="Superaste el límite de hoy">{ALCOHOL_EXPLANATION}</Notice>}
      {status.overWeek && <Notice tone="clay" title="Superaste el límite semanal">{ALCOHOL_EXPLANATION}</Notice>}
      {status.tooFewDryDays && !status.overWeek && <Notice tone="sun">Esta semana tienes menos de {LIMITS.minDryDaysPerWeek} días sin alcohol.</Notice>}

      <Card className="space-y-3">
        <div className="grid grid-cols-3 gap-3"><Stat label="Hoy" value={`${num(status.dayStd, 1)} / ${LIMITS.perDay}`} sub="tragos" /><Stat label="Semana" value={`${num(status.weekStd, 1)} / ${LIMITS.perWeek}`} sub="tragos" /><Stat label="Días sin alcohol" value={`${status.dryDays}`} sub={`mínimo ${LIMITS.minDryDaysPerWeek}`} /></div>
        <Bar value={status.weekStd} max={LIMITS.perWeek} tone={status.overWeek ? "clay" : "brand"} label="Tragos de la semana" />
      </Card>

      <Card className="space-y-3">
        <H2>Registrar un trago</H2>
        <Field label="Bebida"><Select value={drink} onChange={(e) => setDrink(e.target.value)}>{DRINKS.map((x) => <option key={x.key} value={x.key}>{x.name} ({x.ml} ml)</option>)}</Select></Field>
        <Field label="Con qué la mezclas"><Select value={mixer} onChange={(e) => setMixer(e.target.value)}>{MIXERS.map((x) => <option key={x.key} value={x.key}>{x.name}{x.sugary ? " (azucarado)" : ""}</option>)}</Select></Field>
        {mx.sugary && <p className="rounded-xl bg-clay-soft px-3 py-2 text-sm font-medium text-clay">Mezclador azucarado: suma {num(mx.kcal)} kcal. Prefiere soda o agua con gas y limón.</p>}
        <Field label="Cantidad"><Select value={qty} onChange={(e) => setQty(Number(e.target.value))}>{[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}</Select></Field>
        <p className="text-sm text-muted tabular">{num(entryKcal(d, mx, qty))} kcal · {num(entryStd(d, qty), 1)} trago(s) estándar. Esas calorías se descuentan de las tomas que faltan hoy, sin quitar proteína.</p>
        <Button onClick={add}>Registrar</Button>
        {todays.length > 0 && <ul className="space-y-1.5 pt-1">{todays.map((l) => <li key={l.id} className="flex items-center justify-between rounded-2xl bg-paper px-4 py-2 text-sm"><span>{l.qty} × {drinkByKey(l.drink_key)?.name} · {num(l.kcal)} kcal</span><button className="text-xs text-muted underline" onClick={() => logs.remove(l.id!)}>Quitar</button></li>)}</ul>}
      </Card>

      <section className="space-y-2">
        <H2>Tabla de bebidas</H2>
        <p className="text-sm text-muted">1 trago estándar = 14 g de alcohol puro.</p>
        <ul className="space-y-1.5">
          {DRINKS.map((x) => (
            <li key={x.key} className="flex items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3 text-sm"><span><span className="font-medium">{x.name}</span> <span className="text-muted">· {x.ml} ml</span></span><span className="flex items-center gap-2 tabular">{num(x.kcal)} kcal · {num(x.std, 1)} trago{x.lowImpact && <Chip tone="brand">Menor impacto</Chip>}</span></li>
          ))}
        </ul>
        <H2>Mezcladores</H2>
        <ul className="space-y-1.5">{MIXERS.map((x) => <li key={x.key} className={cx("flex items-center justify-between rounded-2xl px-4 py-3 text-sm", x.sugary ? "bg-clay-soft text-clay" : "bg-surface")}><span className="font-medium">{x.name}</span><span className="tabular">{num(x.kcal)} kcal{x.sugary ? " · evitar" : ""}</span></li>)}</ul>
        <Notice tone="brand">Opciones de menor impacto: un destilado con soda o agua con gas y limón, o cerveza light.</Notice>
      </section>
    </div>
  );
}
