"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Button, Card, Chip, cx, H1, H2, Notice, PainScale, Select } from "@/components/ui";
import { ExerciseInfo } from "@/components/ExerciseInfo";
import { EXERCISE_BY_SLUG } from "@/data/exercises";
import { useApp } from "@/lib/app-context";
import { ALARM_MESSAGE, ALARM_SIGNS, buildSession, nextProgression, painAction, PAIN_MESSAGES, PHASE_INFO, phaseFor, type PlannedExercise, type SessionSets } from "@/lib/exercise/knee";
import { SESSION_INFO, sessionForDay } from "@/lib/exercise/plan";
import { addDays, parseNum, weekday } from "@/lib/format";
import { useTable } from "@/lib/hooks";
import type { Exercise, KneePainLog, SessionKind, WorkoutSession, WorkoutSet } from "@/lib/types";

const KINDS = Object.keys(SESSION_INFO) as SessionKind[];

export default function SessionPage() {
  const { active, knee, today, householdId, db } = useApp();
  const pid = active?.id;
  const setsQ = useTable<WorkoutSet>("workout_sets", pid ? { match: { profile_id: pid }, range: { col: "date", from: addDays(today, -120) }, order: { col: "date", asc: false } } : null, [pid]);
  const sessionsQ = useTable<WorkoutSession>("workout_sessions", pid ? { match: { profile_id: pid }, range: { col: "date", from: today, to: today } } : null, [pid]);
  const [kind, setKind] = useState<SessionKind | null>(null);
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [painBefore, setPainBefore] = useState<number | null>(null);
  const [painAfter, setPainAfter] = useState<number | null>(null);
  const [swaps, setSwaps] = useState<Record<string, string>>({});
  const [maxPain, setMaxPain] = useState(0);
  const [alarm, setAlarm] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);

  const phase = knee ? phaseFor(knee, today) : 1;
  const k: SessionKind = kind ?? (active ? sessionForDay(active.training_days, weekday(today)) : "mobility");
  const planned = useMemo(() => (knee ? buildSession(k, knee, phase) : []), [k, knee, phase]);

  if (!active || !knee || active.mode === "pregnancy") return <p className="text-muted">Esta sección es solo para el perfil de ejercicio.</p>;
  const profile = active;

  // Historial por ejercicio (más reciente primero)
  function historyFor(slug: string): SessionSets[] {
    const bySession = new Map<string, SessionSets>();
    for (const s of setsQ.rows) {
      if (s.exercise_slug !== slug || (session && s.session_id === session.id)) continue;
      const e = bySession.get(s.session_id) ?? { date: s.date, sets: [] };
      e.sets.push({ weight_kg: s.weight_kg, reps: s.reps, rpe: s.rpe, knee_pain: s.knee_pain });
      bySession.set(s.session_id, e);
    }
    return [...bySession.values()].sort((a, b) => b.date.localeCompare(a.date));
  }

  async function start() {
    if (painBefore == null) return;
    const s = await db.insert<WorkoutSession>("workout_sessions", { household_id: householdId, profile_id: profile.id, date: today, kind: k, phase, started_at: new Date().toISOString(), ended_at: null, pain_before: painBefore, pain_after: null, pain_next_day: null, swelling_next_day: null, notes: null });
    await db.insert<KneePainLog>("knee_pain_logs", { household_id: householdId, profile_id: profile.id, date: today, context: "before", pain: painBefore, swelling: false, alarm: null, session_id: s.id });
    setSession(s);
    sessionsQ.reload();
  }

  async function reportAlarm(key: string) {
    setAlarm(key);
    await db.insert<KneePainLog>("knee_pain_logs", { household_id: householdId, profile_id: profile.id, date: today, context: "during", pain: 10, swelling: key === "swelling", alarm: key, session_id: session?.id ?? null });
    if (session) await db.update<WorkoutSession>("workout_sessions", session.id, { ended_at: new Date().toISOString(), notes: `Alarma: ${key}` });
  }

  async function finish() {
    if (!session) return;
    const during = Math.max(maxPain, painAfter ?? 0);
    await db.update<WorkoutSession>("workout_sessions", session.id, { ended_at: new Date().toISOString(), pain_after: painAfter });
    await db.insert<KneePainLog>("knee_pain_logs", { household_id: householdId, profile_id: profile.id, date: today, context: "during", pain: during, swelling: false, alarm: null, session_id: session.id });
    await db.upsert("daily_checks", { household_id: householdId, profile_id: profile.id, date: today, trained: true }, ["profile_id", "date"]);
    setFinished(true);
  }

  if (alarm) {
    return (
      <div className="space-y-5">
        <Notice tone="clay" title="Sesión detenida"><p>{ALARM_SIGNS.find((a) => a.key === alarm)?.label}.</p><p className="mt-2 font-medium">{ALARM_MESSAGE}</p></Notice>
        <Link href="/ejercicio" className="text-brand underline">Volver</Link>
      </div>
    );
  }
  if (finished) {
    const act = painAction(Math.max(maxPain, painAfter ?? 0));
    return (
      <div className="space-y-5">
        <H1>Sesión guardada</H1>
        <Notice tone={act === "continue" ? "brand" : act === "reduce" ? "sun" : "clay"}>{PAIN_MESSAGES[act]} Mañana registra cómo amaneció tu rodilla (dolor e hinchazón).</Notice>
        <Link href="/ejercicio" className="inline-flex h-12 items-center rounded-full bg-brand px-6 font-medium text-brand-ink">Listo</Link>
      </div>
    );
  }

  const already = sessionsQ.rows.find((s) => s.ended_at);
  const info = SESSION_INFO[k];

  if (!session) {
    return (
      <div className="space-y-6">
        <header className="space-y-1"><H1>{info.label}</H1><p className="text-muted">{info.durationMin} min aprox. · Fase {phase} (RPE {PHASE_INFO[phase].rpe[0]}–{PHASE_INFO[phase].rpe[1]})</p></header>
        {already && <Notice tone="sky">Ya registraste una sesión hoy. Puedes iniciar otra si quieres.</Notice>}
        <Select aria-label="Tipo de sesión" value={k} onChange={(e) => setKind(e.target.value as SessionKind)}>{KINDS.map((x) => <option key={x} value={x}>{SESSION_INFO[x].label}</option>)}</Select>
        <Card className="space-y-4">
          <H2>Antes de empezar</H2>
          <PainScale label="¿Cuánto te duele la rodilla ahora? (0–10)" value={painBefore} onChange={setPainBefore} />
          {painBefore != null && painBefore >= 6 && <Notice tone="clay">Con dolor de 6 o más hoy, haz solo movilidad suave y consulta si persiste.</Notice>}
          <Button disabled={painBefore == null} onClick={start}>Empezar sesión</Button>
        </Card>
        <p className="text-sm text-muted">{planned.length} ejercicios: calentamiento, bloque de rodilla, fortalecimiento, core y estiramientos de 5–8 minutos.</p>
      </div>
    );
  }

  const sections = Array.from(new Set(planned.map((p) => p.section)));
  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-3"><div><H1>{info.label}</H1><p className="text-sm text-muted">Dolor antes: {session.pain_before} · máximo en series: {maxPain}</p></div></header>
      <details className="rounded-3xl bg-clay-soft p-4">
        <summary className="cursor-pointer font-medium">Mi rodilla se bloquea, falla, se hincha o no apoya</summary>
        <div className="mt-3 flex flex-wrap gap-2">{ALARM_SIGNS.map((a) => <Button key={a.key} size="sm" variant="danger" onClick={() => reportAlarm(a.key)}>{a.label}</Button>)}</div>
      </details>
      {sections.map((sec) => (
        <section key={sec} className="space-y-3">
          <H2>{sec}</H2>
          {planned.filter((p) => p.section === sec).map((p) => {
            const slug = swaps[p.exercise.slug] ?? p.exercise.slug;
            return <ExerciseRunner key={p.exercise.slug} planned={p} ex={EXERCISE_BY_SLUG[slug]} original={p.exercise} history={historyFor(slug)} session={session} onPain={(n) => setMaxPain((m) => Math.max(m, n))} onRegress={(reg) => setSwaps((s) => ({ ...s, [p.exercise.slug]: reg }))} onSaved={setsQ.reload} />;
          })}
        </section>
      ))}
      <Card className="space-y-4">
        <H2>Al terminar</H2>
        <PainScale label="Dolor de rodilla al terminar (0–10)" value={painAfter} onChange={setPainAfter} />
        <Button disabled={painAfter == null} onClick={finish}>Guardar sesión</Button>
      </Card>
    </div>
  );
}

function Mini({ value, onChange, label, w = "w-full" }: { value: string; onChange: (v: string) => void; label: string; w?: string }) {
  return <input aria-label={label} inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} className={cx("h-10 rounded-xl bg-paper px-2 text-center tabular", w)} />;
}

function ExerciseRunner({ planned, ex, original, history, session, onPain, onRegress, onSaved }: { planned: PlannedExercise; ex: Exercise; original: Exercise; history: SessionSets[]; session: WorkoutSession; onPain: (n: number) => void; onRegress: (slug: string) => void; onSaved: () => void }) {
  const { db, householdId, active, knee, today } = useApp();
  const prog = useMemo(() => nextProgression(ex, history), [ex, history]);
  const last = history[0]?.sets[0];
  const unitLabel = ex.unit === "reps" ? "Reps" : ex.unit === "seconds" ? "Seg" : "Min";
  const [rows, setRows] = useState(() => Array.from({ length: planned.sets }, () => ({ w: prog.nextWeightKg != null ? String(prog.nextWeightKg).replace(".", ",") : last?.weight_kg ? String(last.weight_kg).replace(".", ",") : "", r: "", rpe: "", pain: "", saved: false })));
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const swapped = ex.slug !== original.slug;

  async function save(i: number) {
    const row = rows[i];
    const pain = parseNum(row.pain);
    await db.insert<WorkoutSet>("workout_sets", { household_id: householdId, profile_id: active!.id, session_id: session.id, date: today, exercise_slug: ex.slug, set_no: i + 1, weight_kg: parseNum(row.w), reps: parseNum(row.r), rpe: parseNum(row.rpe), knee_pain: pain });
    setRows((rs) => rs.map((x, j) => (j === i ? { ...x, saved: true } : x)));
    if (pain != null) {
      onPain(pain);
      const act = painAction(pain);
      setMsg(act === "continue" ? null : act === "reduce" ? PAIN_MESSAGES.reduce : PAIN_MESSAGES.regress);
      if (act === "regress" && ex.regressionSlug) onRegress(ex.regressionSlug);
    }
    onSaved();
  }

  return (
    <div className="rounded-3xl bg-surface p-4">
      <button className="flex w-full items-start justify-between gap-3 text-left" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <div><p className="font-display text-lg font-semibold leading-snug">{ex.name}</p><p className="text-sm text-muted tabular">{planned.sets} × {planned.repsLabel}{ex.unit === "seconds" ? "" : ""} · descanso {ex.restSec} s</p></div>
        <Chip tone={rows.every((r) => r.saved) ? "brand" : "surface"}>{rows.filter((r) => r.saved).length}/{rows.length}</Chip>
      </button>
      {swapped && <p className="mt-2 text-sm text-clay">Regresión por dolor: ahora haces {ex.name} en lugar de {original.name}.</p>}
      {planned.note && <p className="mt-2 text-sm text-sun">{planned.note}</p>}
      {open && knee && <div className="mt-4"><ExerciseInfo ex={ex} dx={knee.diagnosis} phase={phaseForUi(session.phase)} /></div>}
      {!ex.isometric && history.length > 0 && <p className="mt-2 text-xs text-muted">{prog.message}</p>}
      <div className="mt-3 space-y-2">
        <div className="grid grid-cols-[1.5rem_1fr_1fr_1fr_1fr_2.5rem] items-center gap-1.5 text-center text-[11px] text-muted"><span>#</span><span>Kg</span><span>{unitLabel}</span><span>RPE</span><span>Dolor</span><span /></div>
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-[1.5rem_1fr_1fr_1fr_1fr_2.5rem] items-center gap-1.5">
            <span className="text-center text-sm text-muted tabular">{i + 1}</span>
            <Mini label={`Peso serie ${i + 1}`} value={r.w} onChange={(v) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, w: v } : x)))} />
            <Mini label={`Repeticiones serie ${i + 1}`} value={r.r} onChange={(v) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, r: v } : x)))} />
            <Mini label={`RPE serie ${i + 1}`} value={r.rpe} onChange={(v) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, rpe: v } : x)))} />
            <Mini label={`Dolor de rodilla serie ${i + 1}`} value={r.pain} onChange={(v) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, pain: v } : x)))} />
            <button aria-label={`Guardar serie ${i + 1}`} disabled={r.saved} onClick={() => save(i)} className={cx("h-10 rounded-xl text-sm font-medium", r.saved ? "bg-brand-soft text-brand" : "bg-brand text-brand-ink")}>{r.saved ? "OK" : "+"}</button>
          </div>
        ))}
      </div>
      {msg && <p role="alert" className="mt-2 rounded-xl bg-clay-soft p-3 text-sm">{msg}</p>}
    </div>
  );
}

const phaseForUi = (p: number): 1 | 2 | 3 => (p === 2 ? 2 : p === 3 ? 3 : 1);
