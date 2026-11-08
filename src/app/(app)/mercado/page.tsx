"use client";
import { useMemo, useState } from "react";
import { Card, cx, H1, H2, Notice, SegmentedControl } from "@/components/ui";
import { useApp } from "@/lib/app-context";
import { dayTargets } from "@/lib/nutrition/targets";
import { addDays, shortDate, weekStart } from "@/lib/format";
import { useTable } from "@/lib/hooks";
import { planWeek, type OverrideMap } from "@/lib/menu/planner";
import { buildShoppingList, mealPrepTips, type PersonWeek } from "@/lib/menu/shopping";
import { AISLE_ORDER } from "@/lib/menu/types";
import type { MenuOverride } from "@/lib/types";

export default function MarketPage() {
  const { profiles, today, householdId } = useApp();
  const [which, setWhich] = useState<0 | 1>(0);
  const ws = addDays(weekStart(today), which * 7);
  const week = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  const ov = useTable<MenuOverride>("menu_overrides", { match: { household_id: householdId }, range: { col: "date", from: ws, to: addDays(ws, 6) } }, [ws]);
  const overrides: OverrideMap = useMemo(() => Object.fromEntries(ov.rows.map((o) => [`${o.date}:${o.slot}`, o.recipe_slug])), [ov.rows]);
  const plan = useMemo(() => planWeek(ws, overrides), [ws, overrides]);
  const people: PersonWeek[] = useMemo(() => profiles.map((p) => ({ plan, pregnant: p.mode === "pregnancy", targets: Object.fromEntries(week.map((d) => [d, dayTargets(p, d, today)])) })), [profiles, plan, week, today]);
  const list = useMemo(() => buildShoppingList(people), [people]);
  const tips = useMemo(() => mealPrepTips(people, week), [people, week]);

  return (
    <div className="space-y-6">
      <header className="space-y-3"><H1>Lista de mercado</H1><p className="text-muted">Suma las porciones de los dos para la semana del {shortDate(ws)} al {shortDate(addDays(ws, 6))}. Cantidades en peso crudo.</p>
        <SegmentedControl<0 | 1> value={which} onChange={setWhich} options={[{ value: 0, label: "Esta semana" }, { value: 1, label: "Próxima semana" }]} />
      </header>
      <ShoppingChecklist key={ws} storageKey={`fedeca:market:${ws}`} list={list} />
      <Card tone="sun" className="space-y-3">
        <H2>Meal prep del domingo</H2>
        <ul className="space-y-3">{tips.map((t) => <li key={t.title}><p className="font-medium">{t.title}</p><p className="text-sm text-ink/80">{t.detail}</p></li>)}</ul>
      </Card>
      <Notice tone="plum">La lista de ella ya usa las sustituciones del embarazo (por ejemplo, queso campesino pasteurizado en lugar de costeño).</Notice>
    </div>
  );
}

function ShoppingChecklist({ storageKey, list }: { storageKey: string; list: ReturnType<typeof buildShoppingList> }) {
  const [done, setDone] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) ?? "{}"); } catch { return {}; }
  });
  const toggle = (k: string) => {
    const next = { ...done, [k]: !done[k] };
    setDone(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* ignorar */ }
  };
  return (
    <>
      {AISLE_ORDER.map((aisle) => list[aisle].length > 0 && (
        <section key={aisle} className="space-y-2">
          <H2>{aisle}</H2>
          <ul className="space-y-1.5">
            {list[aisle].map((it) => (
              <li key={it.food}>
                <button onClick={() => toggle(it.food)} aria-pressed={!!done[it.food]} className={cx("flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left", done[it.food] ? "bg-brand-soft text-muted line-through" : "bg-surface")}>
                  <span className="capitalize">{it.name}</span><span className="tabular text-sm font-medium">{it.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
