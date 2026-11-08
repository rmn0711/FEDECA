"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Field, H1, H2, Input, Notice, NumField, PainScale, SegmentedControl, Select, Toggle, cx } from "@/components/ui";
import { ProfileSwitch } from "@/components/ProfileSwitch";
import { useApp } from "@/lib/app-context";
import { DX_LABEL } from "@/lib/exercise/knee";
import { todayISO } from "@/lib/format";
import { PREGNANCY_DISCLAIMER, gestationalWeek, trimesterOf } from "@/lib/nutrition/pregnancy";
import { DEFAULT_TRAINING_DAYS } from "@/lib/exercise/plan";
import type { KneeDx, KneeSide, Measurement, TrainingPlace } from "@/lib/types";

const DAYS = [
  { d: 1, l: "Lun" }, { d: 2, l: "Mar" }, { d: 3, l: "Mié" }, { d: 4, l: "Jue" }, { d: 5, l: "Vie" }, { d: 6, l: "Sáb" }, { d: 0, l: "Dom" },
];

export default function Onboarding() {
  const { active } = useApp();
  if (!active) return null;
  return (
    <div className="space-y-6">
      <ProfileSwitch />
      {active.mode === "pregnancy" ? <PregnancyForm key={active.id} /> : <FatLossForm key={active.id} />}
    </div>
  );
}

function FatLossForm() {
  const { active, patchProfile, saveKnee, knee, db, householdId } = useApp();
  const router = useRouter();
  const p = active!;
  const [age, setAge] = useState<number | null>(p.age);
  const [sex, setSex] = useState<"male" | "female">(p.sex);
  const [weight, setWeight] = useState<number | null>(p.current_weight_kg ?? 123);
  const [height, setHeight] = useState<number | null>(p.height_cm ?? 178);
  const [waist, setWaist] = useState<number | null>(p.waist_cm);
  const [hip, setHip] = useState<number | null>(p.hip_cm);
  const [neck, setNeck] = useState<number | null>(p.neck_cm);
  const [time, setTime] = useState(p.training_time ?? "17:30");
  const [days, setDays] = useState<number[]>(p.training_days.length ? p.training_days : DEFAULT_TRAINING_DAYS);
  const [place, setPlace] = useState<TrainingPlace>(p.training_place ?? "gym");
  const [glp1, setGlp1] = useState(p.uses_glp1);
  const [side, setSide] = useState<KneeSide>(knee?.side ?? "right");
  const [dx, setDx] = useState<KneeDx>(knee?.diagnosis ?? "none");
  const [surgery, setSurgery] = useState(knee?.surgery_type ?? "");
  const [surgMonths, setSurgMonths] = useState<number | null>(knee?.surgery_months_ago ?? null);
  const [pRest, setPRest] = useState<number | null>(knee?.pain_rest ?? 0);
  const [pStairs, setPStairs] = useState<number | null>(knee?.pain_stairs ?? 0);
  const [pChair, setPChair] = useState<number | null>(knee?.pain_chair ?? 0);
  const [ack, setAck] = useState(p.medical_ack);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const toggleDay = (d: number) => setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]));

  async function save() {
    setErr(null);
    if (!age || age < 14 || age > 90) return setErr("Escribe una edad válida (14 a 90).");
    if (!weight || weight < 30 || weight > 300) return setErr("Revisa el peso actual.");
    if (!height || height < 120 || height > 230) return setErr("Escribe la estatura en centímetros (por ejemplo 178).");
    if (days.length < 3 || days.length > 5) return setErr("Elige entre 3 y 5 días de fuerza.");
    if (!ack) return setErr("Confirma que leíste el aviso médico.");
    setBusy(true);
    try {
      const start = p.start_weight_kg ?? weight;
      await patchProfile(p.id, {
        age, sex, current_weight_kg: weight, start_weight_kg: start, height_cm: height, waist_cm: waist, hip_cm: hip, neck_cm: neck,
        training_time: time, training_days: days, training_place: place, uses_glp1: glp1, medical_ack: true, onboarding_done: true,
        protein_anchor_weight_kg: weight, goal_weight_kg: p.goal_weight_kg ?? Math.round(start * 0.85 * 10) / 10,
      });
      await saveKnee({ side, diagnosis: dx, surgery_type: dx === "post_surgery" ? surgery || null : null, surgery_months_ago: dx === "post_surgery" ? surgMonths : null, pain_rest: pRest ?? 0, pain_stairs: pStairs ?? 0, pain_chair: pChair ?? 0, start_date: knee?.start_date ?? todayISO() });
      const date = todayISO();
      await db.upsert("weight_logs", { household_id: householdId, profile_id: p.id, date, weight_kg: weight }, ["profile_id", "date"]);
      if (waist || hip || neck) {
        const row: Partial<Measurement> = { household_id: householdId, profile_id: p.id, date, waist_cm: waist, hip_cm: hip, neck_cm: neck, arm_cm: null, thigh_cm: null };
        await db.upsert("measurements", row, ["profile_id", "date"]);
      }
      router.replace("/");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se pudo guardar.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div><H1>Vamos a configurar a {p.name}</H1><p className="mt-1 text-muted">Modo pérdida de grasa y ejercicio. Tarda unos minutos.</p></div>

      <Notice tone="sun" title="Antes de empezar">
        Con una dieta alta en proteína y un plan de ejercicio nuevo, conviene un chequeo médico (función renal, glucosa, lípidos y presión arterial) y una valoración de la rodilla por un ortopedista o fisioterapeuta antes de empezar.
      </Notice>

      <Card className="space-y-4">
        <H2>Tus datos</H2>
        <div className="grid grid-cols-2 gap-3">
          <NumField label="Edad" value={age} onChange={setAge} unit="años" />
          <Field label="Sexo"><Select value={sex} onChange={(e) => setSex(e.target.value as "male" | "female")}><option value="male">Hombre</option><option value="female">Mujer</option></Select></Field>
          <NumField label="Peso actual" value={weight} onChange={setWeight} unit="kg" />
          <NumField label="Estatura" value={height} onChange={setHeight} unit="cm" hint="1,78 m = 178" />
          <NumField label="Cintura" value={waist} onChange={setWaist} unit="cm" hint="A la altura del ombligo" />
          <NumField label="Cadera" value={hip} onChange={setHip} unit="cm" />
          <NumField label="Cuello" value={neck} onChange={setNeck} unit="cm" />
        </div>
      </Card>

      <Card className="space-y-4">
        <H2>Entrenamiento</H2>
        <Field label="Hora habitual de entrenamiento"><Input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
        <div>
          <p className="mb-2 text-sm font-medium">Días de fuerza disponibles (3 a 5)</p>
          <div className="grid grid-cols-7 gap-1">
            {DAYS.map(({ d, l }) => (
              <button key={d} type="button" aria-pressed={days.includes(d)} onClick={() => toggleDay(d)} className={cx("h-11 rounded-xl text-sm font-medium", days.includes(d) ? "bg-brand text-brand-ink" : "bg-paper text-muted")}>{l}</button>
            ))}
          </div>
        </div>
        <Field label="¿Dónde entrenas?"><SegmentedControl<TrainingPlace> value={place} onChange={setPlace} options={[{ value: "gym", label: "Gimnasio" }, { value: "home", label: "En casa" }]} /></Field>
      </Card>

      <Card className="space-y-4">
        <H2>Tu rodilla</H2>
        <Field label="¿Cuál rodilla?"><SegmentedControl<KneeSide> value={side} onChange={setSide} options={[{ value: "right", label: "Derecha" }, { value: "left", label: "Izquierda" }, { value: "both", label: "Ambas" }]} /></Field>
        <Field label="Diagnóstico"><Select value={dx} onChange={(e) => setDx(e.target.value as KneeDx)}>{(Object.keys(DX_LABEL) as KneeDx[]).map((k) => <option key={k} value={k}>{DX_LABEL[k]}</option>)}</Select></Field>
        {dx === "post_surgery" && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="¿Qué cirugía?"><Input value={surgery} onChange={(e) => setSurgery(e.target.value)} placeholder="Ej.: menisco" /></Field>
            <NumField label="Hace cuánto" value={surgMonths} onChange={setSurgMonths} unit="meses" />
          </div>
        )}
        <PainScale label="Dolor en reposo (0–10)" value={pRest} onChange={setPRest} />
        <PainScale label="Dolor al subir escaleras (0–10)" value={pStairs} onChange={setPStairs} />
        <PainScale label="Dolor al levantarte de una silla (0–10)" value={pChair} onChange={setPChair} />
        <p className="text-xs text-muted">Según el diagnóstico, la app activa o bloquea ejercicios y ajusta los rangos de movimiento.</p>
      </Card>

      <Card className="space-y-3">
        <H2>Medicamento</H2>
        <Toggle checked={glp1} onChange={setGlp1} label="¿Usas medicamento para bajar de peso (por ejemplo, GLP-1)?" />
        {glp1 && <p className="text-sm text-muted">Usaremos porciones más pequeñas, proteína al inicio de cada comida y te avisaremos si no alcanzas la meta de proteína 2 días seguidos.</p>}
      </Card>

      <Toggle checked={ack} onChange={setAck} label="Leí el aviso médico y entiendo que esta app no reemplaza a mi médico." />
      {err && <Notice tone="clay">{err}</Notice>}
      <Button size="lg" className="w-full" disabled={busy} onClick={save}>Guardar y empezar</Button>
    </div>
  );
}

function PregnancyForm() {
  const { active, patchProfile, db, householdId } = useApp();
  const router = useRouter();
  const p = active!;
  const [due, setDue] = useState(p.due_date ?? "2027-04-15");
  const [age, setAge] = useState<number | null>(p.age);
  const [height, setHeight] = useState<number | null>(p.height_cm);
  const [pre, setPre] = useState<number | null>(p.pre_pregnancy_weight_kg);
  const [cur, setCur] = useState<number | null>(p.current_weight_kg);
  const [ack, setAck] = useState(p.medical_ack);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const week = due ? gestationalWeek(due, todayISO()) : null;

  async function save() {
    setErr(null);
    if (!due || due < todayISO()) return setErr("Confirma una fecha probable de parto futura.");
    if (!age || age < 14 || age > 60) return setErr("Escribe una edad válida.");
    if (!height || height < 120 || height > 210) return setErr("Escribe la estatura en centímetros (por ejemplo 160).");
    if (!pre || pre < 30 || pre > 200) return setErr("Revisa el peso antes del embarazo.");
    if (!cur || cur < 30 || cur > 220) return setErr("Revisa el peso actual.");
    if (!ack) return setErr("Confirma que leíste el aviso.");
    setBusy(true);
    try {
      await patchProfile(p.id, { due_date: due, age, height_cm: height, pre_pregnancy_weight_kg: pre, current_weight_kg: cur, medical_ack: true, onboarding_done: true });
      await db.upsert("weight_logs", { household_id: householdId, profile_id: p.id, date: todayISO(), weight_kg: cur }, ["profile_id", "date"]);
      router.replace("/");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se pudo guardar.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div><H1>Vamos a configurar a {p.name}</H1><p className="mt-1 text-muted">Modo embarazo: solo alimentación, sin metas de bajar de peso.</p></div>
      <Notice tone="plum">{PREGNANCY_DISCLAIMER}</Notice>
      <Card className="space-y-4">
        <H2>Tu embarazo</H2>
        <Field label="Fecha probable de parto" hint="Está prellenada con abril de 2027: confirma el día exacto con tu ginecólogo."><Input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
        {week !== null && due >= todayISO() && <p className="text-sm text-muted">Hoy estás en la semana {week} (trimestre {trimesterOf(week)}). Se calcula sola cada día.</p>}
        <div className="grid grid-cols-2 gap-3">
          <NumField label="Edad" value={age} onChange={setAge} unit="años" />
          <NumField label="Estatura" value={height} onChange={setHeight} unit="cm" />
          <NumField label="Peso antes del embarazo" value={pre} onChange={setPre} unit="kg" />
          <NumField label="Peso actual" value={cur} onChange={setCur} unit="kg" />
        </div>
      </Card>
      <Toggle checked={ack} onChange={setAck} label="Entiendo que este plan complementa, no reemplaza, las indicaciones de mi ginecólogo." />
      {err && <Notice tone="clay">{err}</Notice>}
      <Button size="lg" className="w-full" disabled={busy} onClick={save}>Guardar y empezar</Button>
    </div>
  );
}
