"use client";
import Link from "next/link";
import { useState } from "react";
import { Activity, Baby, ChevronRight, Dumbbell, LineChart, ShoppingBasket, UtensilsCrossed, Wine, Droplets, Plus, Flame } from "lucide-react";
import { Bar, Button, Card, Chip, Eyebrow, H1, H2, Notice, Segments, Stat } from "@/components/ui";
import { FoodArt } from "@/components/FoodArt";
import { ProfileSwitch } from "@/components/ProfileSwitch";
import { useApp } from "@/lib/app-context";
import { addDays, g, num, time12, weekday, WEEKDAY_SHORT, weekStart } from "@/lib/format";
import { plateSummary } from "@/lib/menu/core";
import { proteinShortfallAlert } from "@/lib/nutrition/calc";
import { PREGNANCY_DISCLAIMER, POST_DINNER_PREGNANCY_TIP } from "@/lib/nutrition/pregnancy";
import { PRE_WORKOUT_TIP, POST_WORKOUT_TIP } from "@/lib/nutrition/meals";
import { SESSION_INFO, sessionForDay } from "@/lib/exercise/plan";
import { useTable } from "@/lib/hooks";
import { rapidLossWarning } from "@/lib/nutrition/calc";
import { useToday } from "@/lib/use-day";
import type { WeightLog } from "@/lib/types";

export default function Home() {
  const { active, today, nowTime } = useApp();
  const t = useToday();
  const [busy, setBusy] = useState(false);
  const [swapMsg, setSwapMsg] = useState<string | null>(null);
  const weights = useTable<WeightLog>("weight_logs", active ? { match: { profile_id: active.id }, order: { col: "date", asc: true } } : null, [active?.id]);
  if (!active || !t.day) return null;
  const day = t.day;
  const pregnant = active.mode === "pregnancy";
  const next = day.next;
  const ws = weekStart(today);
  const filled = day.slots.filter((s) => s.status === "eaten").map((s) => s.slot);
  const skipped = day.slots.filter((s) => s.status === "skipped").map((s) => s.slot);
  const sessionKind = !pregnant ? sessionForDay(active.training_days, weekday(today)) : null;
  const session = sessionKind ? SESSION_INFO[sessionKind] : null;
  const water = t.check?.water_ml ?? 0;

  // Alertas
  const alerts: { tone: "clay" | "sun" | "sky"; title: string; text: string }[] = [];
  if (active.uses_glp1) {
    const days = [addDays(today, -2), addDays(today, -1)].map((d) => ({ proteinG: t.stats[d]?.protein ?? 0, targetG: day.targets.proteinG, has: Boolean(t.stats[d]) }));
    if (days.every((d) => d.has) && proteinShortfallAlert(days)) alerts.push({ tone: "clay", title: "Proteína corta dos días seguidos", text: "Con medicamento para bajar de peso, la proteína protege tu músculo. Empieza cada comida por la proteína y prioriza las meriendas." });
  }
  if (!pregnant && rapidLossWarning(weights.rows.map((w) => ({ date: w.date, kg: w.weight_kg })))) alerts.push({ tone: "clay", title: "Estás bajando muy rápido", text: "Llevas más de 1,5 % de tu peso por semana durante 3 semanas. Conviene revisarlo con tu médico." });
  if (day.unallocatedProtein > 0) alerts.push({ tone: "sun", title: "Proteína que no alcanzó a repartirse", text: `Quedaron ${num(day.unallocatedProtein)} g sin repartir (máximo 45 g por toma). Suma una merienda proteica si puedes.` });
  if (day.alcoholKcal > 0) alerts.push({ tone: "sky", title: "Alcohol registrado hoy", text: `Descontamos ${num(day.alcoholKcal)} kcal de las tomas que faltan, sin quitar proteína.` });

  const links = [
    { href: "/menu", label: "Menú de la semana", Icon: UtensilsCrossed },
    { href: "/mercado", label: "Lista de mercado", Icon: ShoppingBasket },
    ...(!pregnant ? [{ href: "/ejercicio", label: "Ejercicio y rodilla", Icon: Dumbbell }] : []),
    { href: "/progreso", label: "Mi progreso", Icon: LineChart },
    ...(!pregnant ? [{ href: "/alcohol", label: "Alcohol", Icon: Wine }] : []),
    ...(pregnant ? [{ href: "/embarazo", label: "Embarazo", Icon: Baby }] : []),
  ];

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <ProfileSwitch />
        <H1>Hola, {active.name}</H1>
      </header>

      {alerts.map((a) => <Notice key={a.title} tone={a.tone} title={a.title}>{a.text}</Notice>)}

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2"><Flame size={20} aria-hidden className="text-clay" /><p className="font-display text-xl font-semibold tabular">{t.streak} {t.streak === 1 ? "día" : "días"}</p></div>
          <Eyebrow>Racha de días cumplidos</Eyebrow>
        </div>
        <ol className="grid grid-cols-7 gap-1 text-center">
          {Array.from({ length: 7 }, (_, i) => {
            const d = addDays(ws, i);
            const n = t.stats[d]?.eaten ?? 0;
            const isToday = d === today;
            return (
              <li key={d} className={`rounded-2xl py-2 ${isToday ? "bg-brand text-brand-ink" : "bg-paper"}`}>
                <p className="text-[11px] opacity-80">{WEEKDAY_SHORT[weekday(d)]}</p>
                <p className="font-display tabular text-lg font-semibold">{n}</p>
                <p className="text-[10px] opacity-70">de 6</p>
              </li>
            );
          })}
        </ol>
      </Card>

      <section aria-label="Progreso del día" className="space-y-2">
        <div className="flex items-baseline justify-between"><H2>Tu día</H2><span className="text-sm text-muted tabular">{day.doneCount} de 6 tomas</span></div>
        <Segments filled={filled} skipped={skipped} />
      </section>

      {next ? (
        <Card tone="brand" className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div><Eyebrow>Tu próxima comida</Eyebrow><p className="font-display text-2xl font-semibold">{next.label} · {time12(next.time)}</p></div>
            <div className="flex flex-col items-end gap-1">{next.isPre && <Chip tone="sky">Pre-entreno</Chip>}{next.isPost && <Chip tone="plum">Post-entreno</Chip>}{next.time !== next.baseTime && <Chip tone="sun">Horario corrido</Chip>}</div>
          </div>
          <div className="flex gap-4">
            <FoodArt art={next.recipe.art} className="h-24 w-32 shrink-0 rounded-2xl" />
            <div className="min-w-0">
              <Link href={`/receta/${next.recipe.slug}?slot=${next.slot}`} className="font-display text-lg font-semibold leading-snug underline-offset-4 hover:underline">{next.recipe.kind === "snack" ? plateSummary(next.portion.lines, 3) : next.recipe.name}</Link>
              <p className="mt-1 text-sm text-ink/80">{next.recipe.kind === "snack" ? "Solo proteína" : plateSummary(next.portion.lines)}</p>
              <p className="mt-1 text-sm font-medium tabular">{g(Math.round(next.portion.macros.p))} de proteína · {num(Math.round(next.portion.macros.kcal))} kcal</p>
            </div>
          </div>
          {next.isPre && <p className="text-sm">{PRE_WORKOUT_TIP}</p>}
          {next.isPost && <p className="text-sm">{POST_WORKOUT_TIP}</p>}
          {active.uses_glp1 && !next.proteinOnly && <p className="text-sm">Porción más pequeña: empieza por la proteína.</p>}
          {pregnant && next.slot === 5 && <p className="text-sm">{POST_DINNER_PREGNANCY_TIP}</p>}
          {pregnant && next.recipe.lines.length > 0 && <p className="text-sm">Porciones pequeñas y frecuentes ayudan con las náuseas y la acidez.</p>}
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={async () => { setBusy(true); await t.eat(next); setBusy(false); setSwapMsg(null); }}>Ya comí</Button>
            <Button variant="soft" disabled={busy} onClick={async () => { setBusy(true); const ok = await t.swap(next); setBusy(false); setSwapMsg(ok ? null : "No encontramos un plato equivalente disponible."); }}>Cambiar plato</Button>
            <Button variant="ghost" disabled={busy} onClick={async () => { setBusy(true); await t.skip(next); setBusy(false); }}>Omitir</Button>
          </div>
          {swapMsg && <p role="status" className="text-sm text-clay">{swapMsg}</p>}
        </Card>
      ) : (
        <Card tone="brand"><H2>Completaste las tomas de hoy</H2><p className="mt-1 text-sm">{nowTime > "22:00" ? "Buen cierre de día. Descansa y mañana seguimos." : "No quedan tomas pendientes en el horario."}</p></Card>
      )}

      {day.slots.some((s) => s.log) && (
        <details className="rounded-3xl bg-surface p-5">
          <summary className="cursor-pointer font-display text-lg font-semibold">Tomas de hoy</summary>
          <ul className="mt-3 space-y-2">
            {day.slots.map((s) => (
              <li key={s.slot} className="flex items-center justify-between gap-3 text-sm">
                <span><span className="font-medium">{s.label}</span> <span className="text-muted">· {time12(s.time)}</span></span>
                {s.log ? <span className="flex items-center gap-2"><Chip tone={s.log.status === "eaten" ? "brand" : "clay"}>{s.log.status === "eaten" ? "Comida" : "Omitida"}</Chip><button className="text-xs text-muted underline" onClick={() => t.undo(s)}>Deshacer</button></span> : <span className="text-muted">{s.dropped ? "No cabe antes de las 11:00 p. m." : "Pendiente"}</span>}
              </li>
            ))}
          </ul>
        </details>
      )}

      {session && (
        <Card tone="sky" className="flex items-center justify-between gap-3">
          <div><Eyebrow>Tu entrenamiento de hoy</Eyebrow><p className="font-display text-lg font-semibold leading-snug">{session.label}</p><p className="text-sm text-ink/80">{session.durationMin} min aprox.</p></div>
          <Link href="/ejercicio/sesion" className="inline-flex h-12 shrink-0 items-center rounded-full bg-sky px-6 font-medium text-white">Empezar</Link>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Card className="space-y-2">
          <Stat label="Proteína de hoy" value={<>{num(Math.round(day.eatenProtein))} <span className="text-base font-normal text-muted">/ {num(day.targets.proteinG)} g</span></>} />
          <Bar value={day.eatenProtein} max={day.targets.proteinG} label="Proteína consumida" />
        </Card>
        <Card className="space-y-2">
          <div className="flex items-start justify-between"><Stat label="Agua" value={<>{num(water / 1000, 2)} <span className="text-base font-normal text-muted">/ {num(day.targets.waterMl / 1000, 2)} L</span></>} /><Droplets size={18} className="text-sky" aria-hidden /></div>
          <Bar value={water} max={day.targets.waterMl} tone="sky" label="Agua consumida" />
          <Button size="sm" variant="soft" onClick={() => t.addWater(250)}><Plus size={14} aria-hidden /> 250 ml</Button>
        </Card>
      </div>
      <Card className="flex items-center justify-between">
        <Stat label="Calorías de hoy" value={<>{num(Math.round(day.eatenKcal))} <span className="text-base font-normal text-muted">/ {num(day.targets.kcal)} kcal</span></>} sub={pregnant ? `Mantenimiento + ${day.targets.addKcal} kcal · semana ${day.targets.week} (trimestre ${day.targets.trimester})` : day.targets.isLegDay ? "Día de pierna: +carbohidrato antes y después" : undefined} />
        <Activity size={20} className="text-muted" aria-hidden />
      </Card>

      <nav aria-label="Accesos" className="grid grid-cols-2 gap-3">
        {links.map(({ href, label, Icon }) => (
          <Link key={href} href={href} className="flex items-center justify-between gap-2 rounded-3xl bg-surface p-4 font-medium transition-colors hover:bg-surface-2">
            <span className="flex items-center gap-3"><Icon size={20} className="text-brand" aria-hidden />{label}</span><ChevronRight size={16} className="text-muted" aria-hidden />
          </Link>
        ))}
      </nav>

      {pregnant && <Notice tone="plum">{PREGNANCY_DISCLAIMER}</Notice>}
    </div>
  );
}
