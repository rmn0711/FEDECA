"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Chip, H1, H2, Notice, Stat, TextArea } from "@/components/ui";
import { ProfileSwitch } from "@/components/ProfileSwitch";
import { useApp } from "@/lib/app-context";
import { longDate, num } from "@/lib/format";
import { useTable } from "@/lib/hooks";
import { NUTRIENT_FOCUS, PREGNANCY_DISCLAIMER, PREGNANCY_SYMPTOM_REMINDER, symptomNeedsAttention, gestationalDays } from "@/lib/nutrition/pregnancy";
import { CAFFEINE_ITEMS, CAFFEINE_MAX_MG, caffeineStatus, caffeineTotal, FOOD_SAFETY_RULES } from "@/lib/nutrition/safety";
import { dayTargets } from "@/lib/nutrition/targets";
import type { SymptomNote } from "@/lib/types";

export default function PregnancyPage() {
  const { active, today, householdId } = useApp();
  const router = useRouter();
  const notes = useTable<SymptomNote>("symptom_notes", active ? { match: { profile_id: active.id }, order: { col: "date", asc: false }, limit: 20 } : null, [active?.id]);
  const [cafe, setCafe] = useState<Record<string, number>>({});
  const [text, setText] = useState("");
  const [warn, setWarn] = useState(false);
  useEffect(() => { if (active && active.mode !== "pregnancy") router.replace("/"); }, [active, router]);
  if (!active || active.mode !== "pregnancy") return null;
  const t = dayTargets(active, today, today);
  const days = active.due_date ? gestationalDays(active.due_date, today) : 0;
  const mg = caffeineTotal(Object.entries(cafe).map(([key, qty]) => ({ key, qty })));
  const status = caffeineStatus(mg);

  async function save() {
    if (!text.trim()) return;
    await notes.insert({ household_id: householdId, profile_id: active!.id, date: today, note: text.trim() });
    setWarn(symptomNeedsAttention(text));
    setText("");
  }

  return (
    <div className="space-y-6">
      <header className="space-y-3"><ProfileSwitch /><H1>Embarazo</H1></header>
      <Card tone="plum" className="space-y-3">
        <div className="grid grid-cols-3 gap-3"><Stat label="Semana" value={t.week} sub={`${Math.floor(days / 7)} sem + ${days % 7} d`} /><Stat label="Trimestre" value={t.trimester} /><Stat label="Parto" value={active.due_date ? longDate(active.due_date).split(" ").slice(1).join(" ") : "—"} /></div>
        <p className="text-sm">Calorías de hoy: <span className="font-medium tabular">{num(t.kcal)} kcal</span> (mantenimiento{t.addKcal ? ` + ${t.addKcal}` : " + 0"}). Sin déficit. Proteína: <span className="font-medium tabular">{num(t.proteinG)} g</span> repartidos en las 6 tomas.</p>
      </Card>
      <Notice tone="plum">{PREGNANCY_DISCLAIMER}</Notice>

      <Card className="space-y-3">
        <H2>Seguridad alimentaria</H2>
        <ul className="list-disc space-y-1.5 pl-5 text-sm">{FOOD_SAFETY_RULES.map((r) => <li key={r}>{r}</li>)}</ul>
        <p className="text-sm text-muted">Los platos del menú ya vienen filtrados: lo crudo o no pasteurizado se sustituye y lo limitado (atún en lata, róbalo) respeta su tope semanal.</p>
      </Card>

      <Card className="space-y-3">
        <H2>Calculadora de cafeína</H2>
        <p className="text-sm text-muted">Máximo {CAFFEINE_MAX_MG} mg al día entre café, gaseosas y té.</p>
        <ul className="space-y-1.5">
          {CAFFEINE_ITEMS.map((i) => (
            <li key={i.key} className="flex items-center justify-between gap-2 rounded-2xl bg-paper px-4 py-2 text-sm">
              <span>{i.name} <span className="text-muted">· {i.serving} · {i.mg} mg</span></span>
              <span className="flex items-center gap-2"><button aria-label={`Quitar ${i.name}`} className="h-8 w-8 rounded-full bg-surface-2" onClick={() => setCafe((c) => ({ ...c, [i.key]: Math.max(0, (c[i.key] ?? 0) - 1) }))}>−</button><span className="w-4 text-center tabular">{cafe[i.key] ?? 0}</span><button aria-label={`Agregar ${i.name}`} className="h-8 w-8 rounded-full bg-surface-2" onClick={() => setCafe((c) => ({ ...c, [i.key]: (c[i.key] ?? 0) + 1 }))}>+</button></span>
            </li>
          ))}
        </ul>
        <Notice tone={status === "over" ? "clay" : status === "near" ? "sun" : "brand"} title={`${num(mg)} mg de ${CAFFEINE_MAX_MG} mg`}>{status === "over" ? "Superas el máximo diario. Cambia por descafeinado o agua." : status === "near" ? "Estás cerca del máximo." : "Dentro del límite."}</Notice>
      </Card>

      <Card className="space-y-3">
        <H2>Nutrientes para destacar</H2>
        <ul className="space-y-2">{NUTRIENT_FOCUS.map((n) => <li key={n.key}><p className="font-medium">{n.label} <span className="font-normal text-muted">· {n.why}</span></p><div className="mt-1 flex flex-wrap gap-1.5">{n.foods.map((f) => <Chip key={f} tone="brand">{f}</Chip>)}</div></li>)}</ul>
        <p className="text-xs text-muted">Suplementos solo por indicación médica.</p>
      </Card>

      <Card className="space-y-3">
        <H2>Notas y síntomas</H2>
        <TextArea aria-label="Nota" value={text} onChange={(e) => setText(e.target.value)} placeholder="Cómo te sientes hoy, náuseas, acidez, cualquier síntoma…" />
        <Button variant="soft" disabled={!text.trim()} onClick={save}>Guardar nota</Button>
        {(warn || notes.rows.some((n) => n.date === today && symptomNeedsAttention(n.note))) && <Notice tone="clay" title="Consulta a tu ginecólogo">{PREGNANCY_SYMPTOM_REMINDER}</Notice>}
        <p className="text-xs text-muted">Si notas síntomas raros, recuerda consultar a tu ginecólogo.</p>
        <ul className="space-y-1.5">{notes.rows.map((n) => <li key={n.id} className="rounded-2xl bg-paper px-4 py-2 text-sm"><span className="text-xs text-muted">{longDate(n.date)}</span><br />{n.note}</li>)}</ul>
      </Card>
    </div>
  );
}
