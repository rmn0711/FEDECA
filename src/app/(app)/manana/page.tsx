"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Card, cx, H1, H2, Notice, SegmentedControl } from "@/components/ui";
import { useApp } from "@/lib/app-context";
import { addDays, longDate, num, time12 } from "@/lib/format";
import { useTable } from "@/lib/hooks";
import type { OverrideMap } from "@/lib/menu/planner";
import { prepForDay, type DayPrep, type MarinateItem } from "@/lib/menu/prep";
import type { MenuOverride } from "@/lib/types";

/** Hora sin el punto final de "a. m." / "p. m." para poder cerrar la frase con nuestro propio punto. */
const t12 = (hhmm: string) => time12(hhmm).replace(/\.$/, "");
const people = (m: { perPerson: { name: string; rawG: number }[]; totalRawG: number }) => m.perPerson.map((p) => `${p.name} ${num(p.rawG)} g`).join(" · ");

export default function Tomorrow() {
  const { profiles, today, householdId, prefs } = useApp();
  const [offset, setOffset] = useState<1 | 2>(1);
  const date = addDays(today, offset);
  const ov = useTable<MenuOverride>("menu_overrides", { match: { household_id: householdId }, range: { col: "date", from: date, to: date } }, [date]);
  const overrides: OverrideMap = useMemo(() => Object.fromEntries(ov.rows.map((o) => [`${o.date}:${o.slot}`, o.recipe_slug])), [ov.rows]);
  const prep = prepForDay({ date, profiles: [...profiles].sort((a) => (a.slug === "jose" ? -1 : 1)), overrides, prefs, today });
  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <H1>Para mañana</H1>
        <SegmentedControl<1 | 2> value={offset} onChange={setOffset} options={[{ value: 1, label: "Mañana" }, { value: 2, label: "Pasado mañana" }]} />
        <p className="font-display text-xl font-semibold">{longDate(date)}</p>
        <p className="text-muted">Qué adobar, qué remojar y a qué hora empezar a cocinar. Las cantidades ya suman las porciones de los dos, en peso crudo.</p>
      </header>
      <Checklist key={date} date={date} prep={prep} />
    </div>
  );
}

function Checklist({ date, prep }: { date: string; prep: DayPrep }) {
  const key = `fedeca:prep:${date}`;
  const [done, setDone] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem(key) ?? "{}"); } catch { return {}; }
  });
  const toggle = (k: string) => {
    const next = { ...done, [k]: !done[k] };
    setDone(next);
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* ignorar */ }
  };
  const tonight = prep.marinate.filter((m) => m.when === "tonight");
  const morning = prep.marinate.filter((m) => m.when === "morning");
  const cooking = prep.cook.filter((c) => c.needsCooking || c.marinated.length > 0);
  const simple = prep.cook.filter((c) => !cooking.includes(c));

  const MarinateCard = ({ m }: { m: MarinateItem }) => {
    const id = `${m.slot}:${m.foodKey}`;
    return (
      <li>
        <button onClick={() => toggle(id)} aria-pressed={!!done[id]} className={cx("w-full rounded-3xl p-4 text-left transition-colors", done[id] ? "bg-brand-soft" : "bg-surface")}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className={cx("font-display text-lg font-semibold leading-snug", done[id] && "line-through opacity-60")}>Adobar {m.foodName}</p>
              <p className="text-sm text-muted">para {m.slotLabel.toLowerCase()} · {time12(m.mealTime)}</p>
            </div>
            <span className="shrink-0 rounded-full bg-paper px-3 py-1 text-xs font-medium tabular">{done[id] ? "Listo" : `Total ${num(m.totalRawG)} g`}</span>
          </div>
          <p className="mt-2 text-sm tabular"><span className="font-medium">Peso crudo:</span> {people(m)}</p>
          <p className="mt-1 text-sm"><span className="font-medium">Adobo:</span> {m.marinade}.</p>
          <p className="mt-1 text-sm text-ink/80">Tapado y en la nevera, de {m.minH} a {m.maxH} horas. {m.when === "tonight" ? `Adóbalo esta noche, antes de las ${t12(m.marinateAt)}.` : `Adóbalo mañana a las ${t12(m.marinateAt)}.`} Cocínalo a las {t12(m.cookStart)}.</p>
          {m.note && <p className="mt-1 text-sm text-sun">{m.note}</p>}
        </button>
      </li>
    );
  };

  return (
    <>
      {prep.pregnantNote && <Notice tone="plum" title="Seguridad para Yanina">Adoba siempre dentro de la nevera, nunca a temperatura ambiente. No uses el líquido del adobo crudo para salsas ni para untar al final, y cocina todo hasta que no quede rosado por dentro.</Notice>}

      <section className="space-y-3">
        <H2>Esta noche</H2>
        {tonight.length === 0 && prep.soak.length === 0 && <Card><p className="text-sm text-muted">No hay nada que adobar ni remojar esta noche para ese día.</p></Card>}
        {tonight.length > 0 && <p className="text-sm text-muted">Si la carne está congelada, pásala a la nevera hoy para que se descongele.</p>}
        <ul className="space-y-3">{tonight.map((m) => <MarinateCard key={`${m.slot}:${m.foodKey}`} m={m} />)}</ul>
        {prep.soak.length > 0 && (
          <ul className="space-y-3">
            {prep.soak.map((s) => {
              const id = `soak:${s.foodKey}:${s.slotLabel}`;
              return (
                <li key={id}>
                  <button onClick={() => toggle(id)} aria-pressed={!!done[id]} className={cx("w-full rounded-3xl p-4 text-left", done[id] ? "bg-brand-soft" : "bg-sky-soft")}>
                    <p className={cx("font-display text-lg font-semibold", done[id] && "line-through opacity-60")}>Remojar {s.foodName}</p>
                    <p className="text-sm tabular">{people(s)} · total {num(s.totalRawG)} g secos. En agua fría de {s.hours}; escúrrelos antes de cocinar.</p>
                    <p className="text-sm text-ink/70">Para {s.slotLabel.toLowerCase()}: {s.recipeName}.</p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {morning.length > 0 && (
        <section className="space-y-3">
          <H2>Mañana temprano</H2>
          <p className="text-sm text-muted">Estos se adoban en la mañana: si los dejas desde anoche quedarían demasiado tiempo en el adobo.</p>
          <ul className="space-y-3">{morning.map((m) => <MarinateCard key={`${m.slot}:${m.foodKey}`} m={m} />)}</ul>
        </section>
      )}

      <section className="space-y-3">
        <H2>Mañana, hora por hora</H2>
        <ol className="space-y-3">
          {cooking.map((c) => (
            <li key={c.slot} className="rounded-3xl bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="font-display text-xl font-semibold tabular">{time12(c.cookStart)}</p>
                <p className="text-right text-sm text-muted">{c.slotLabel} · {time12(c.mealTime)}</p>
              </div>
              <Link href={`/receta/${c.recipeSlug}?date=${date}&slot=${c.slot}`} className="mt-1 block font-medium leading-snug underline-offset-4 hover:underline">{c.recipeName}</Link>
              <p className="mt-1 text-xs text-muted tabular">{c.timeMin} min de preparación{c.marinated.length ? ` · con ${c.marinated.join(" y ")} adobado` : ""}</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">{c.keySteps.map((s, i) => <li key={i}>{s}</li>)}</ol>
            </li>
          ))}
        </ol>
        {simple.length > 0 && (
          <Card className="space-y-1">
            <p className="text-sm font-medium">Sin cocción: solo armar</p>
            <ul className="text-sm text-muted">{simple.map((c) => <li key={c.slot}>{c.slotLabel} · {time12(c.mealTime)}: {c.recipeName}</li>)}</ul>
          </Card>
        )}
      </section>
    </>
  );
}
