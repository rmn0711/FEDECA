"use client";
import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, Chip, Eyebrow, H1, H2, Notice, Button, PainScale } from "@/components/ui";
import { useApp } from "@/lib/app-context";
import { ALARM_MESSAGE, ALARM_SIGNS, cardioWeeklyGoal, KNEE_PRINCIPLES, PHASE_INFO, phaseFor, programWeek, recommendSpecialist } from "@/lib/exercise/knee";
import { SESSION_INFO, sessionForDay, weekPlan } from "@/lib/exercise/plan";
import { addDays, num, weekday, WEEKDAY_LONG, weekStart } from "@/lib/format";
import { useTable } from "@/lib/hooks";
import { kgLost, kneeLoadReductionKg } from "@/lib/nutrition/calc";
import type { KneePainLog, WeightLog, WorkoutSession } from "@/lib/types";
import { useState } from "react";

export default function ExercisePage() {
  const { active, knee, today, householdId } = useApp();
  const router = useRouter();
  const pid = active?.id;
  const sessions = useTable<WorkoutSession>("workout_sessions", pid ? { match: { profile_id: pid }, order: { col: "date", asc: false }, limit: 40 } : null, [pid]);
  const pain = useTable<KneePainLog>("knee_pain_logs", pid ? { match: { profile_id: pid }, range: { col: "date", from: addDays(today, -14) } } : null, [pid]);
  const weights = useTable<WeightLog>("weight_logs", pid ? { match: { profile_id: pid }, order: { col: "date", asc: true } } : null, [pid]);
  const [nextDay, setNextDay] = useState<number | null>(null);
  const [swelling, setSwelling] = useState(false);
  const [showAlarm, setShowAlarm] = useState(false);

  useEffect(() => { if (active?.mode === "pregnancy") router.replace("/"); }, [active, router]);
  if (!active || active.mode === "pregnancy" || !knee) return null;

  const phase = phaseFor(knee, today);
  const week = programWeek(knee.start_date, today);
  const info = PHASE_INFO[phase];
  const kind = sessionForDay(active.training_days, weekday(today));
  const session = SESSION_INFO[kind];
  const plan = weekPlan(active.training_days);
  const lost = active.start_weight_kg && active.current_weight_kg ? kgLost(active.start_weight_kg, active.current_weight_kg) : 0;
  const yesterday = addDays(today, -1);
  const pendingNextDay = sessions.rows.find((s) => s.date === yesterday && s.pain_next_day == null);
  const wsStart = weekStart(today);
  const specialist = recommendSpecialist(pain.rows.map((p) => ({ date: p.date, pain: p.pain, swelling: p.swelling })), today);

  async function saveNextDay() {
    if (!pendingNextDay || nextDay == null) return;
    await sessions.update(pendingNextDay.id, { pain_next_day: nextDay, swelling_next_day: swelling });
    await pain.insert({ household_id: householdId, profile_id: active!.id, date: today, context: "next_day", pain: nextDay, swelling, alarm: null, session_id: pendingNextDay.id });
    setNextDay(null);
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1"><H1>Ejercicio y rodilla</H1><p className="text-muted">Fuerza con protección de rodilla. Cero impacto en las fases 1 y 2.</p></header>

      {specialist && <Notice tone="clay" title="Dolor alto por una semana">Tu rodilla lleva una semana con dolor de 6 o más o con hinchazón. Pide cita con un ortopedista o fisioterapeuta antes de seguir cargando.</Notice>}

      {pendingNextDay && (
        <Card tone="sun" className="space-y-3">
          <H2>¿Cómo amaneció tu rodilla?</H2>
          <p className="text-sm">Registra el dolor de hoy por la sesión de ayer. Si hay hinchazón, la app regresa los ejercicios.</p>
          <PainScale label="Dolor hoy (0–10)" value={nextDay} onChange={setNextDay} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={swelling} onChange={(e) => setSwelling(e.target.checked)} className="h-5 w-5 accent-[#2c6a56]" /> Hay hinchazón</label>
          <Button disabled={nextDay == null} onClick={saveNextDay}>Guardar</Button>
        </Card>
      )}

      <Card tone="sky" className="space-y-2">
        <Eyebrow>Fase {phase} · {info.name}</Eyebrow>
        <p className="font-display text-xl font-semibold">Semana {week} del programa</p>
        <p className="text-sm">{info.focus} Esfuerzo percibido (RPE) {info.rpe[0]}–{info.rpe[1]}.</p>
        <p className="text-xs text-ink/70">{info.weeks}</p>
      </Card>

      <Card tone="brand" className="space-y-1">
        <Eyebrow>Cada kilo cuenta</Eyebrow>
        <p className="text-sm">Cada kilo perdido quita unos 4 kg de carga sobre la rodilla al caminar.</p>
        <p className="font-display text-2xl font-semibold tabular">Tu rodilla carga {num(kneeLoadReductionKg(lost), 1)} kg menos por paso</p>
      </Card>

      <Card className="space-y-3">
        <div className="flex items-start justify-between gap-3"><div><Eyebrow>Hoy · {WEEKDAY_LONG[weekday(today)]}</Eyebrow><p className="font-display text-lg font-semibold leading-snug">{session.label}</p><p className="text-sm text-muted">{session.durationMin} min aprox.</p></div></div>
        <Link href="/ejercicio/sesion" className="inline-flex h-12 items-center rounded-full bg-brand px-6 font-medium text-brand-ink">Empezar sesión</Link>
      </Card>

      <section className="space-y-2">
        <H2>Tu semana</H2>
        <ul className="space-y-1.5">
          {[1, 2, 3, 4, 5, 6, 0].map((d) => (
            <li key={d} className={`flex items-center justify-between gap-3 rounded-2xl px-4 py-3 ${weekday(today) === d ? "bg-brand-soft" : "bg-surface"}`}>
              <span className="font-medium">{WEEKDAY_LONG[d]}</span><span className="text-right text-sm text-muted">{SESSION_INFO[plan[d]].label}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted">Meta de cardio de bajo impacto esta semana ({wsStart}): {cardioWeeklyGoal(week)} min (progresa de 150 a 250 min/semana). Pasos: promedio de tu primera semana + 1.000 por semana hasta 8.000–10.000.</p>
      </section>

      <nav className="grid grid-cols-2 gap-3 text-center font-medium">
        <Link href="/ejercicio/rodilla" className="rounded-3xl bg-surface p-4">Dolor y progreso de rodilla</Link>
        <Link href="/ejercicio/biblioteca" className="rounded-3xl bg-surface p-4">Biblioteca de ejercicios</Link>
      </nav>

      <section className="space-y-3">
        <H2>Principios del programa</H2>
        <ul className="list-disc space-y-1 pl-5 text-sm">{KNEE_PRINCIPLES.map((p) => <li key={p}>{p}</li>)}</ul>
        <Button variant="danger" onClick={() => setShowAlarm((v) => !v)}>Señales de alarma</Button>
        {showAlarm && (
          <Notice tone="clay" title="Para y consulta si tu rodilla…">
            <ul className="list-disc pl-5">{ALARM_SIGNS.map((a) => <li key={a.key}>{a.label}</li>)}</ul>
            <p className="mt-2 font-medium">{ALARM_MESSAGE}</p>
          </Notice>
        )}
        <Chip>{weights.rows.length} registros de peso</Chip>
      </section>
    </div>
  );
}
