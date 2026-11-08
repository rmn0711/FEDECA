"use client";
import { useMemo, useState } from "react";
import { Button, Card, Chip, H1, H2, Notice, PainScale, Select } from "@/components/ui";
import { LineChart } from "@/components/Chart";
import { EXERCISES } from "@/data/exercises";
import { useApp } from "@/lib/app-context";
import { DX_LABEL, jogEligible, phaseFor, recommendSpecialist, weeksWithoutPainOver3 } from "@/lib/exercise/knee";
import { addDays, num } from "@/lib/format";
import { useTable } from "@/lib/hooks";
import { bmi, kgLost, kneeLoadReductionKg } from "@/lib/nutrition/calc";
import type { KneePainLog, WorkoutSet } from "@/lib/types";

export default function KneePage() {
  const { active, knee, saveKnee, today, householdId } = useApp();
  const pid = active?.id;
  const pain = useTable<KneePainLog>("knee_pain_logs", pid ? { match: { profile_id: pid }, order: { col: "date", asc: true } } : null, [pid]);
  const sets = useTable<WorkoutSet>("workout_sets", pid ? { match: { profile_id: pid }, order: { col: "date", asc: true } } : null, [pid]);
  const [slug, setSlug] = useState("prensa-piernas-rango-protegido");
  const [ctx, setCtx] = useState<"rest" | "stairs" | "chair">("rest");
  const [val, setVal] = useState<number | null>(null);

  const strength = useMemo(() => {
    const byDate = new Map<string, number>();
    for (const s of sets.rows) if (s.exercise_slug === slug && s.weight_kg) byDate.set(s.date, Math.max(byDate.get(s.date) ?? 0, s.weight_kg));
    return [...byDate].map(([x, y]) => ({ x, y }));
  }, [sets.rows, slug]);
  const painSeries = useMemo(() => {
    const by = new Map<string, number>();
    for (const l of pain.rows) by.set(l.date, Math.max(by.get(l.date) ?? 0, l.pain));
    return [...by].map(([x, y]) => ({ x, y }));
  }, [pain.rows]);

  if (!active || !knee) return null;
  const phase = phaseFor(knee, today);
  const lost = active.start_weight_kg && active.current_weight_kg ? kgLost(active.start_weight_kg, active.current_weight_kg) : 0;
  const w3 = weeksWithoutPainOver3(pain.rows.filter((l) => l.context !== "next_day" || true).map((l) => ({ date: l.date, pain: l.pain })), today);
  const jog = jogEligible({ phase, weeksWithoutPainOver3: w3, bmi: active.current_weight_kg ? bmi(active.current_weight_kg, active.height_cm) : 40, orthoClearance: knee.ortho_clearance });
  const specialist = recommendSpecialist(pain.rows.map((p) => ({ date: p.date, pain: p.pain, swelling: p.swelling })), today);
  const recent = pain.rows.filter((l) => l.date >= addDays(today, -30));

  return (
    <div className="space-y-6">
      <header className="space-y-1"><H1>Dolor y progreso de rodilla</H1><p className="text-muted">{DX_LABEL[knee.diagnosis]} · fase {phase}</p></header>
      {specialist && <Notice tone="clay" title="Consulta con un especialista">El dolor alto o la hinchazón llevan una semana. Es momento de ver a un ortopedista o fisioterapeuta.</Notice>}

      <Card className="space-y-3">
        <H2>Dolor a lo largo del tiempo</H2>
        <LineChart title="Dolor máximo de rodilla por día" series={[{ name: "Dolor (0–10)", color: "#b4502c", points: painSeries, dots: true }]} decimals={0} />
        <p className="text-xs text-muted">0–3 continúas · 4–5 bajas carga o rango · 6 o más (o hinchazón al día siguiente) regresas el ejercicio.</p>
      </Card>

      <Card className="space-y-3">
        <H2>Registro rápido</H2>
        <Select aria-label="Situación" value={ctx} onChange={(e) => setCtx(e.target.value as typeof ctx)}><option value="rest">En reposo</option><option value="stairs">Al subir escaleras</option><option value="chair">Al levantarme de una silla</option></Select>
        <PainScale label="Dolor (0–10)" value={val} onChange={setVal} />
        <Button disabled={val == null} onClick={async () => { await pain.insert({ household_id: householdId, profile_id: active.id, date: today, context: ctx, pain: val!, swelling: false, alarm: null, session_id: null }); setVal(null); }}>Guardar</Button>
        {recent.length > 0 && <p className="text-xs text-muted">{recent.length} registros en los últimos 30 días.</p>}
      </Card>

      <Card className="space-y-3">
        <H2>Fuerza por ejercicio</H2>
        <Select aria-label="Ejercicio" value={slug} onChange={(e) => setSlug(e.target.value)}>{EXERCISES.filter((e) => !e.bodyweight && !e.isometric).map((e) => <option key={e.slug} value={e.slug}>{e.name}</option>)}</Select>
        <LineChart title="Carga máxima por sesión" unit="kg" series={[{ name: "Carga", color: "#2c6a56", points: strength, dots: true }]} />
      </Card>

      <Card tone="brand" className="space-y-1"><p className="text-sm">Cada kilo perdido quita unos 4 kg de carga por paso.</p><p className="font-display text-2xl font-semibold tabular">Tu rodilla carga {num(kneeLoadReductionKg(lost), 1)} kg menos por paso</p></Card>

      <Card className="space-y-3">
        <H2>¿Ya puedo trotar?</H2>
        <p className="text-sm text-muted">El trote solo se considera en la fase 3, con 4 semanas sin dolor mayor a 3, IMC menor a 32 y aval del ortopedista.</p>
        {jog.eligible ? <Notice tone="brand">Cumples los criterios. Empieza con intervalos muy cortos de trote y camina entre ellos.</Notice> : <ul className="list-disc space-y-1 pl-5 text-sm">{jog.reasons.map((r) => <li key={r}>{r}</li>)}</ul>}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5 accent-[#2c6a56]" checked={knee.ortho_clearance} onChange={(e) => saveKnee({ ortho_clearance: e.target.checked })} /> Mi ortopedista o fisioterapeuta dio el aval</label>
        <Chip tone={w3 >= 4 ? "brand" : "surface"}>{w3} semanas sin dolor mayor a 3</Chip>
      </Card>
    </div>
  );
}
