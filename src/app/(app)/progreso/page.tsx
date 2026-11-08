"use client";
import { useMemo, useState } from "react";
import { Bar, Button, Card, Chip, H1, H2, Notice, NumField, Stat, Toggle } from "@/components/ui";
import { LineChart } from "@/components/Chart";
import { ProfileSwitch } from "@/components/ProfileSwitch";
import { useApp } from "@/lib/app-context";
import { addDays, daysBetween, longDate, num, pct, shortDate } from "@/lib/format";
import { useTable } from "@/lib/hooks";
import { bmi, bmiCategory, kgLost, leanMassKg, milestones, movingAverage7, navyBodyFat, pctLost, projectGoalDate, rapidLossWarning, waistHipRatio } from "@/lib/nutrition/calc";
import { expectedGainRange, gainStatus, gestationalWeek, iomForProfile, PREGNANCY_DISCLAIMER } from "@/lib/nutrition/pregnancy";
import { dayTargets } from "@/lib/nutrition/targets";
import { stepGoal, programWeek } from "@/lib/exercise/knee";
import type { DailyCheck, MealLog, Measurement, WeightLog } from "@/lib/types";
import Link from "next/link";

export default function Progress() {
  const { active, today, logWeight, householdId, knee } = useApp();
  const pid = active?.id;
  const weights = useTable<WeightLog>("weight_logs", pid ? { match: { profile_id: pid }, order: { col: "date", asc: true } } : null, [pid]);
  const meas = useTable<Measurement>("measurements", pid ? { match: { profile_id: pid }, order: { col: "date", asc: true } } : null, [pid]);
  const meals = useTable<MealLog>("meal_logs", pid ? { match: { profile_id: pid }, range: { col: "date", from: addDays(today, -14) } } : null, [pid]);
  const checks = useTable<DailyCheck>("daily_checks", pid ? { match: { profile_id: pid }, order: { col: "date", asc: true } } : null, [pid]);
  const [w, setW] = useState<number | null>(null);
  const [m, setM] = useState<Partial<Record<"waist_cm" | "hip_cm" | "neck_cm" | "arm_cm" | "thigh_cm", number | null>>>({});
  const [formKey, setFormKey] = useState(0);

  const pts = useMemo(() => weights.rows.map((r) => ({ date: r.date, kg: Number(r.weight_kg) })), [weights.rows]);
  const ma = useMemo(() => movingAverage7(pts), [pts]);
  if (!active) return null;
  const pregnant = active.mode === "pregnancy";
  const cur = pts.length ? pts[pts.length - 1].kg : active.current_weight_kg;
  const start = active.start_weight_kg ?? pts[0]?.kg ?? null;
  const lastMeas = meas.rows[meas.rows.length - 1];
  const daysSinceMeas = lastMeas ? daysBetween(lastMeas.date, today) : null;
  const lastWeightDate = weights.rows.length ? weights.rows[weights.rows.length - 1].date : null;

  const todayCheck = checks.rows.find((c) => c.date === today);
  const todayMeals = meals.rows.filter((l) => l.date === today);
  const target = dayTargets(active, today, today);
  const proteinToday = todayMeals.filter((l) => l.status === "eaten").reduce((a, l) => a + l.protein_g, 0);

  const proteinByDay = new Map<string, number>();
  for (const l of meals.rows) if (l.status === "eaten") proteinByDay.set(l.date, (proteinByDay.get(l.date) ?? 0) + l.protein_g);
  const proteinSeries = [...proteinByDay].sort().map(([x, p]) => ({ x, y: Math.round((p / target.proteinG) * 100) }));

  async function saveWeight() {
    if (w == null) return;
    await logWeight(w);
    weights.reload();
    setW(null);
    setFormKey((k) => k + 1);
  }
  async function saveMeas() {
    const row = { household_id: householdId, profile_id: active!.id, date: today, waist_cm: m.waist_cm ?? null, hip_cm: m.hip_cm ?? null, neck_cm: m.neck_cm ?? null, arm_cm: m.arm_cm ?? null, thigh_cm: m.thigh_cm ?? null };
    await meas.upsert(row, ["profile_id", "date"]);
    setM({});
    setFormKey((k) => k + 1);
  }
  async function saveCheck(patch: Partial<DailyCheck>) {
    await checks.upsert({ household_id: householdId, profile_id: active!.id, date: today, ...patch }, ["profile_id", "date"]);
  }

  /* ───────── Embarazo ───────── */
  if (pregnant) {
    const pre = active.pre_pregnancy_weight_kg;
    const iom = pre ? iomForProfile(pre, active.height_cm) : null;
    const week = active.due_date ? gestationalWeek(active.due_date, today) : 0;
    const gainNow = pre && cur ? cur - pre : null;
    const gainPts = pre && active.due_date ? weights.rows.map((r) => ({ x: gestationalWeek(active.due_date!, r.date), y: Math.round((Number(r.weight_kg) - pre) * 10) / 10 })) : [];
    const band = iom ? { name: "Rango recomendado (IOM)", color: "#7a4a78", points: Array.from({ length: 41 }, (_, wk) => ({ x: wk, ...(() => { const r = expectedGainRange(iom, wk); return { lo: r.min, hi: r.max }; })() })) } : undefined;
    const st = iom && gainNow != null ? gainStatus(iom, week, gainNow) : null;
    return (
      <div className="space-y-6">
        <header className="space-y-3"><ProfileSwitch /><H1>Mi progreso</H1></header>
        <Card tone="plum" className="space-y-3">
          <H2>Ganancia de peso en el embarazo</H2>
          {iom ? <p className="text-sm">{iom.label}: se recomienda ganar entre {num(iom.totalMin, 1)} y {num(iom.totalMax, 1)} kg en total (rangos del IOM). Es una guía informativa, no una meta de bajar.</p> : <p className="text-sm">Registra tu peso antes del embarazo en Ajustes para ver el rango recomendado.</p>}
          <div className="grid grid-cols-3 gap-3"><Stat label="Semana" value={week} /><Stat label="Peso actual" value={cur ? `${num(cur, 1)} kg` : "—"} /><Stat label="Ganancia" value={gainNow != null ? `${num(gainNow, 1)} kg` : "—"} /></div>
          {iom && <LineChart title="Ganancia de peso por semana de gestación" unit="kg" xIsDate={false} series={[{ name: "Tu ganancia", color: "#2c6a56", points: gainPts, dots: true }]} band={band} />}
          {st && st !== "within" && <Notice tone="plum">{st === "below" ? "Vas por debajo del rango de esta semana." : "Vas por encima del rango de esta semana."} Coméntalo en tu próximo control con tu ginecólogo; no hagas cambios por tu cuenta.</Notice>}
        </Card>
        <Card className="space-y-3">
          <H2>Registrar peso</H2>
          <p className="text-xs text-muted">Pésate en ayunas y a la misma hora, 1–2 veces por semana.</p>
          <NumField key={formKey} label="Peso de hoy" value={w} onChange={setW} unit="kg" />
          <Button disabled={w == null} onClick={saveWeight}>Guardar peso</Button>
          {lastWeightDate && <p className="text-xs text-muted">Último registro: {longDate(lastWeightDate)}</p>}
        </Card>
        <Checklist active={active} todayCheck={todayCheck} todayMeals={todayMeals.filter((l) => l.status === "eaten").length} proteinToday={proteinToday} target={target} saveCheck={saveCheck} showTraining={false} />
        <Notice tone="plum">{PREGNANCY_DISCLAIMER}</Notice>
      </div>
    );
  }

  /* ───────── Pérdida de grasa ───────── */
  const lost = start && cur ? kgLost(start, cur) : 0;
  const lostPct = start && cur ? pctLost(start, cur) : 0;
  const bf = lastMeas?.waist_cm && lastMeas?.neck_cm ? navyBodyFat({ sex: active.sex, heightCm: active.height_cm, waistCm: Number(lastMeas.waist_cm), neckCm: Number(lastMeas.neck_cm), hipCm: lastMeas.hip_cm ? Number(lastMeas.hip_cm) : null }) : null;
  const lean = bf != null && cur ? leanMassKg(cur, bf) : null;
  const whr = lastMeas?.waist_cm && lastMeas?.hip_cm ? waistHipRatio(Number(lastMeas.waist_cm), Number(lastMeas.hip_cm)) : null;
  const proj = active.goal_weight_kg ? projectGoalDate(pts, active.goal_weight_kg) : null;
  const ms = start && cur ? milestones(start, cur) : [];
  const rapid = rapidLossWarning(pts);
  const waistSeries = meas.rows.filter((r) => r.waist_cm).map((r) => ({ x: r.date, y: Number(r.waist_cm) }));
  const bfSeries = meas.rows.filter((r) => r.waist_cm && r.neck_cm).map((r) => ({ x: r.date, y: navyBodyFat({ sex: active.sex, heightCm: active.height_cm, waistCm: Number(r.waist_cm), neckCm: Number(r.neck_cm), hipCm: r.hip_cm ? Number(r.hip_cm) : null }) ?? 0 })).filter((p) => p.y > 0);
  const stepsRows = checks.rows.filter((c) => c.steps);
  const firstWeek = stepsRows.filter((c) => daysBetween(stepsRows[0].date, c.date) < 7);
  const baseline = firstWeek.length ? firstWeek.reduce((a, c) => a + (c.steps ?? 0), 0) / firstWeek.length : null;
  const stepsGoal = baseline ? stepGoal(baseline, Math.floor(daysBetween(stepsRows[0].date, today) / 7)) : null;

  return (
    <div className="space-y-6">
      <header className="space-y-3"><ProfileSwitch /><H1>Mi progreso</H1></header>
      {rapid && <Notice tone="clay" title="Estás bajando muy rápido">Más de 1,5 % de tu peso por semana durante 3 semanas. Conviene revisarlo con tu médico.</Notice>}

      <Card className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Peso" value={cur ? `${num(cur, 1)} kg` : "—"} />
          <Stat label="Perdidos" value={`${num(lost, 1)} kg`} sub={pct(lostPct)} />
          <Stat label="IMC" value={cur ? num(bmi(cur, active.height_cm), 1) : "—"} sub={cur ? bmiCategory(bmi(cur, active.height_cm)) : undefined} />
          <Stat label="% de grasa" value={bf != null ? pct(bf) : "—"} sub="Fórmula de la Marina" />
          <Stat label="Masa magra" value={lean != null ? `${num(lean, 1)} kg` : "—"} />
          <Stat label="Cintura/cadera" value={whr != null ? num(whr, 2) : "—"} />
        </div>
        {proj && <p className="text-sm">A este ritmo ({num(Math.abs(proj.kgPerWeek), 2)} kg por semana) llegas a {num(active.goal_weight_kg, 1)} kg hacia el <span className="font-medium">{shortDate(proj.date)} {proj.date.slice(0, 4)}</span>.</p>}
        <div className="flex flex-wrap gap-2">{ms.map((x) => <Chip key={x.pct} tone={x.reached ? "brand" : "surface"}>−{x.pct} % · {num(x.atKg, 1)} kg{x.reached ? " · logrado" : ""}</Chip>)}</div>
      </Card>

      <Card className="space-y-3">
        <H2>Peso</H2>
        <LineChart title="Peso y promedio móvil de 7 días" unit="kg" goal={active.goal_weight_kg ?? undefined} series={[{ name: "Peso", color: "#b8b19b", points: pts.map((p) => ({ x: p.date, y: p.kg })), dots: true }, { name: "Promedio 7 días", color: "#2c6a56", points: ma.map((p) => ({ x: p.date, y: p.kg })) }]} />
        <p className="text-xs text-muted">El promedio móvil suaviza las fluctuaciones de agua para que no te asustes con un día alto.</p>
        <NumField key={`w${formKey}`} label="Peso de hoy" value={w} onChange={setW} unit="kg" hint="Pésate en ayunas, a la misma hora, 1–2 veces por semana." />
        <Button disabled={w == null} onClick={saveWeight}>Guardar peso</Button>
      </Card>

      <Card className="space-y-3">
        <H2>Medidas cada 2 semanas</H2>
        {daysSinceMeas == null ? <p className="text-sm text-muted">Aún no hay medidas.</p> : <p className={`text-sm ${daysSinceMeas >= 14 ? "font-medium text-clay" : "text-muted"}`}>{daysSinceMeas >= 14 ? "Toca medirte de nuevo." : `Última medida hace ${daysSinceMeas} días.`}</p>}
        <div className="grid grid-cols-2 gap-3">
          {([["waist_cm", "Cintura"], ["hip_cm", "Cadera"], ["neck_cm", "Cuello"], ["arm_cm", "Brazo"], ["thigh_cm", "Muslo"]] as const).map(([k, l]) => <NumField key={`${k}${formKey}`} label={l} value={m[k] ?? null} onChange={(v) => setM((o) => ({ ...o, [k]: v }))} unit="cm" />)}
        </div>
        <Button variant="soft" disabled={!Object.values(m).some((v) => v != null)} onClick={saveMeas}>Guardar medidas</Button>
        <LineChart title="Cintura" unit="cm" series={[{ name: "Cintura", color: "#3b6c91", points: waistSeries, dots: true }]} />
        <LineChart title="Porcentaje de grasa" unit="%" series={[{ name: "% de grasa", color: "#8a6510", points: bfSeries, dots: true }]} />
      </Card>

      <Card className="space-y-3">
        <H2>Cumplimiento de proteína</H2>
        <LineChart title="Proteína diaria como porcentaje de la meta" unit="% de la meta" decimals={0} goal={100} series={[{ name: "Proteína", color: "#2c6a56", points: proteinSeries, dots: true }]} />
      </Card>

      <Checklist active={active} todayCheck={todayCheck} todayMeals={todayMeals.filter((l) => l.status === "eaten").length} proteinToday={proteinToday} target={target} saveCheck={saveCheck} showTraining stepsGoal={stepsGoal} />

      {knee && <Card className="space-y-2"><H2>Fuerza y rodilla</H2><p className="text-sm text-muted">Semana {programWeek(knee.start_date, today)} del programa.</p><Link href="/ejercicio/rodilla" className="text-brand underline">Ver gráficas de fuerza y dolor de rodilla</Link></Card>}
    </div>
  );
}

function Checklist({ active, todayCheck, todayMeals, proteinToday, target, saveCheck, showTraining, stepsGoal }: { active: { name: string }; todayCheck?: DailyCheck; todayMeals: number; proteinToday: number; target: ReturnType<typeof dayTargets>; saveCheck: (p: Partial<DailyCheck>) => Promise<void>; showTraining: boolean; stepsGoal?: number | null }) {
  const [steps, setSteps] = useState<number | null>(todayCheck?.steps ?? null);
  const [sleep, setSleep] = useState<number | null>(todayCheck?.sleep_h ?? null);
  const water = todayCheck?.water_ml ?? 0;
  const rows: [string, boolean, string][] = [
    ["Comidas cumplidas", todayMeals >= 5, `${todayMeals} de 6`],
    ["Proteína alcanzada", proteinToday >= target.proteinG * 0.9, `${num(Math.round(proteinToday))} de ${num(target.proteinG)} g`],
    ["Agua", water >= target.waterMl, `${num(water)} de ${num(target.waterMl)} ml`],
  ];
  return (
    <Card className="space-y-3">
      <H2>Checklist de hoy, {active.name}</H2>
      <ul className="space-y-2">{rows.map(([l, ok, d]) => <li key={l} className="flex items-center justify-between rounded-2xl bg-paper px-4 py-3 text-sm"><span>{l}</span><span className="flex items-center gap-2 tabular">{d}<Chip tone={ok ? "brand" : "surface"}>{ok ? "Listo" : "Falta"}</Chip></span></li>)}</ul>
      <Bar value={water} max={target.waterMl} tone="sky" label="Agua" />
      {showTraining && <Toggle checked={!!todayCheck?.trained} onChange={(v) => saveCheck({ trained: v })} label="Entrené hoy" />}
      <div className="grid grid-cols-2 gap-3">
        <NumField label="Pasos" value={steps} onChange={setSteps} hint={stepsGoal ? `Meta de esta semana: ${num(stepsGoal)}` : showTraining ? "Tu base será el promedio de la primera semana" : undefined} />
        <NumField label="Horas de sueño" value={sleep} onChange={setSleep} unit="h" />
      </div>
      <Button variant="soft" onClick={() => saveCheck({ steps: steps != null ? Math.round(steps) : null, sleep_h: sleep })}>Guardar pasos y sueño</Button>
    </Card>
  );
}
