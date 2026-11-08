"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, Card, Chip, Field, H1, H2, Input, Notice, NumField, Toggle, cx } from "@/components/ui";
import { ProfileSwitch } from "@/components/ProfileSwitch";
import { useApp } from "@/lib/app-context";
import { defaultMealTimes } from "@/lib/nutrition/meals";
import { SLOTS } from "@/lib/types";
import { enablePush, pushEnabled } from "@/lib/push/client";
import { isSupabaseConfigured, supabaseBrowser } from "@/lib/supabase/client";
import { fatLossTargets, MIN_KCAL_FAT_LOSS } from "@/lib/nutrition/calc";
import { num } from "@/lib/format";

const DAYS = [{ d: 1, l: "Lun" }, { d: 2, l: "Mar" }, { d: 3, l: "Mié" }, { d: 4, l: "Jue" }, { d: 5, l: "Vie" }, { d: 6, l: "Sáb" }, { d: 0, l: "Dom" }];

export default function Settings() {
  const { active, patchProfile, householdId, inviteCode, signOut, profiles } = useApp();
  const [times, setTimes] = useState<string[]>(active?.meal_times ?? defaultMealTimes());
  const [days, setDays] = useState<number[]>(active?.training_days ?? []);
  const [pre, setPre] = useState<number | null>(active?.pre_pregnancy_weight_kg ?? null);
  const [due, setDue] = useState(active?.due_date ?? "");
  const [goal, setGoal] = useState<number | null>(active?.goal_weight_kg ?? null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pushOn, setPushOn] = useState(false);
  const [code, setCode] = useState("");

  useEffect(() => { pushEnabled().then(setPushOn).catch(() => {}); }, []);
  if (!active) return null;
  const pregnant = active.mode === "pregnancy";
  const preview = !pregnant && active.age && active.current_weight_kg ? fatLossTargets({ weightKg: active.current_weight_kg, heightCm: active.height_cm, age: active.age, sex: active.sex, trainingDays: active.training_days.length }) : null;

  async function save() {
    const sorted = [...times];
    for (let i = 1; i < sorted.length; i++) if (sorted[i] <= sorted[i - 1]) return setMsg("Las horas deben ir en orden, una después de otra.");
    if (sorted[5] > "23:00") return setMsg("La última toma no puede pasar de las 11:00 p. m.");
    if (!pregnant && (days.length < 3 || days.length > 5)) return setMsg("Elige entre 3 y 5 días de fuerza.");
    await patchProfile(active!.id, { meal_times: sorted, ...(pregnant ? { pre_pregnancy_weight_kg: pre, due_date: due || active!.due_date } : { training_days: days, goal_weight_kg: goal }) });
    setMsg("Guardado.");
  }

  async function togglePush() {
    const r = await enablePush(householdId, null);
    setPushOn(r === "ok");
    setMsg(r === "ok" ? "Notificaciones activadas en este dispositivo." : r === "denied" ? "Bloqueaste las notificaciones en el navegador." : r === "no-key" ? "Falta NEXT_PUBLIC_VAPID_PUBLIC_KEY en el despliegue." : r === "no-supabase" ? "Las notificaciones requieren Supabase configurado." : r === "unsupported" ? "Este navegador no admite notificaciones. En iPhone, instala primero la app en la pantalla de inicio." : "No se pudo activar.");
  }

  async function join() {
    if (!isSupabaseConfigured) return;
    const { error } = await supabaseBrowser().rpc("join_household", { code });
    setMsg(error ? error.message : "Listo: entraste al hogar. Recarga la app.");
  }

  return (
    <div className="space-y-6">
      <header className="space-y-3"><ProfileSwitch /><H1>Ajustes</H1></header>
      {msg && <Notice tone="sky"><span role="status">{msg}</span></Notice>}

      <Card className="space-y-3">
        <H2>Horario de comidas de {active.name}</H2>
        <p className="text-sm text-muted">Cada 3 horas. Si registras una toma tarde, las siguientes se corren solas sin pasar de las 11:00 p. m.</p>
        <div className="grid grid-cols-2 gap-3">
          {SLOTS.map((s, i) => <Field key={s.id} label={s.label}><Input type="time" value={times[i]} onChange={(e) => setTimes((t) => t.map((x, j) => (j === i ? e.target.value : x)))} /></Field>)}
        </div>
        <Button variant="ghost" size="sm" onClick={() => setTimes(defaultMealTimes())}>Restablecer horario</Button>
      </Card>

      <Link href="/gustos" className="block rounded-3xl bg-surface p-4 font-medium">Gustos de comida: lo que me gusta y lo que no</Link>

      {!pregnant && (
        <Card className="space-y-3">
          <H2>Entrenamiento y meta</H2>
          <div className="grid grid-cols-7 gap-1">{DAYS.map(({ d, l }) => <button key={d} type="button" aria-pressed={days.includes(d)} onClick={() => setDays((c) => (c.includes(d) ? c.filter((x) => x !== d) : [...c, d]))} className={cx("h-11 rounded-xl text-sm font-medium", days.includes(d) ? "bg-brand text-brand-ink" : "bg-paper text-muted")}>{l}</button>)}</div>
          <NumField label="Peso meta" value={goal} onChange={setGoal} unit="kg" />
          <Toggle checked={active.uses_glp1} onChange={(v) => patchProfile(active.id, { uses_glp1: v })} label="Uso medicamento para bajar de peso (GLP-1)" />
          {preview && <p className="text-sm text-muted tabular">Meta actual: {num(preview.kcal)} kcal (déficit de {preview.deficit}, nunca por debajo de {num(MIN_KCAL_FAT_LOSS)}) y {num(preview.proteinG)} g de proteína sobre {num(preview.adjustedWeightKg, 1)} kg de peso ajustado. Se recalcula cada vez que bajas 3 kg.</p>}
        </Card>
      )}
      {pregnant && (
        <Card className="space-y-3">
          <H2>Embarazo</H2>
          <Field label="Fecha probable de parto"><Input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
          <NumField label="Peso antes del embarazo" value={pre} onChange={setPre} unit="kg" />
        </Card>
      )}
      <Button onClick={save}>Guardar cambios</Button>

      <Card className="space-y-3">
        <H2>Notificaciones</H2>
        <p className="text-sm text-muted">Un aviso 10 minutos antes de cada toma con el plato y el gramaje. En iPhone funciona después de instalar la app en la pantalla de inicio.</p>
        <div className="flex items-center gap-3"><Button variant="soft" onClick={togglePush}>{pushOn ? "Reactivar en este dispositivo" : "Activar notificaciones"}</Button>{pushOn && <Chip tone="brand">Activas</Chip>}</div>
      </Card>

      {isSupabaseConfigured && (
        <Card className="space-y-3">
          <H2>Hogar</H2>
          <p className="text-sm">Código de invitación para que la otra persona entre con su propia cuenta: <span className="font-display text-lg font-semibold tabular">{inviteCode ?? "—"}</span></p>
          <Field label="¿Tienes un código de otro hogar?"><Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Código de 8 caracteres" /></Field>
          <Button variant="soft" disabled={!code} onClick={join}>Unirme</Button>
          <Button variant="ghost" onClick={signOut}>Cerrar sesión</Button>
        </Card>
      )}
      <p className="text-center text-xs text-muted">{profiles.length} perfiles · {isSupabaseConfigured ? "sincronizado con Supabase" : "modo demostración (datos locales)"}</p>
    </div>
  );
}
