"use client";
import Link from "next/link";
import { useMemo } from "react";
import { Card, Chip, cx, H1, H2, Notice, SegmentedControl, Toggle } from "@/components/ui";
import { FOODS } from "@/data/foods";
import { useApp } from "@/lib/app-context";
import { computeDay } from "@/lib/day";
import { addDays, num, weekday, WEEKDAY_SHORT, weekStart } from "@/lib/format";
import { useTable } from "@/lib/hooks";
import type { OverrideMap } from "@/lib/menu/planner";
import { DAY_RULES, PLAN_CARBS, PLAN_FLOOR_KCAL, PLAN_FRUITS, PLAN_PROTEINS, usesPlan, type DayType, type Weigh } from "@/lib/plan/ciclo3";
import type { MenuOverride } from "@/lib/types";

const TONE: Record<DayType, "brand" | "sun" | "sky"> = { 1: "sun", 2: "brand", 3: "sky" };
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

export default function PlanPage() {
  const { profiles, today, householdId, prefs, patchProfile, setActive, active } = useApp();
  const jose = profiles.find((p) => p.mode === "fat_loss");
  const ws = weekStart(today);
  const week = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  const ov = useTable<MenuOverride>("menu_overrides", { match: { household_id: householdId }, range: { col: "date", from: ws, to: week[6] } }, [ws]);
  const overrides: OverrideMap = useMemo(() => Object.fromEntries(ov.rows.map((o) => [`${o.date}:${o.slot}`, o.recipe_slug])), [ov.rows]);
  if (!jose) return null;
  const on = usesPlan(jose);
  const days = on ? week.map((date) => ({ date, d: computeDay({ profile: jose, date, today, overrides, logs: [], prefs }) })) : [];

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <H1>Plan del nutricionista</H1>
        <p className="text-muted">Ciclo de 3 días que se repite igual todas las semanas. El Día 1 (carga de carbohidratos) cae en tus días de pierna.</p>
        {active?.id !== jose.id && <Notice tone="sky">Este plan es solo para {jose.name}. <button className="underline" onClick={() => setActive(jose.id)}>Cambiar a {jose.name}</button></Notice>}
      </header>

      <Card className="space-y-3">
        <Toggle checked={on} onChange={(v) => patchProfile(jose.id, { diet_plan: v ? "ciclo3" : "app" })} label={`Usar este plan para ${jose.name}`} />
        <p className="text-sm text-muted">{on ? "Tus 6 comidas salen de este plan. Yanina sigue con su menú de embarazo; cuando la proteína del almuerzo o la cena de la casa está permitida, se usa la misma para cocinar una sola vez." : "Ahora usas el menú calculado por la app."}</p>
      </Card>

      {on && (
        <>
          <Card className="space-y-3">
            <H2>¿Cómo pesas la proteína?</H2>
            <SegmentedControl<Weigh> value={jose.plan_weigh ?? "cocido"} onChange={(v) => patchProfile(jose.id, { plan_weigh: v })} options={[{ value: "cocido", label: "Ya cocida" }, { value: "crudo", label: "En crudo" }]} />
            <p className="text-sm text-muted">Los 120 y 180 g del plan pueden ser en crudo o ya cocidos; pregúntale a tu amigo cómo los pesaba. Los 100 g de carbohidrato son siempre del alimento ya cocido (por ejemplo, 100 g de yuca cocida).</p>
          </Card>

          <section className="space-y-2">
            <H2>Tu semana</H2>
            <ul className="space-y-2">
              {days.map(({ date, d }) => {
                const t = d.targets.planDayType!;
                return (
                  <li key={date}>
                    <Link href="/menu" className={cx("flex items-center justify-between gap-3 rounded-2xl px-4 py-3", date === today ? "bg-brand-soft" : "bg-surface")}>
                      <span className="flex items-center gap-3"><span className="w-9 text-sm font-medium">{WEEKDAY_SHORT[weekday(date)]}</span><Chip tone={TONE[t]}>Día {t}</Chip></span>
                      <span className="text-right text-xs text-muted tabular">{num(d.targets.kcal)} kcal · {num(d.targets.proteinG)} g proteína{(d.targets.planBelowFloor ?? 0) > 0 ? ` · faltan ${num(d.targets.planBelowFloor)} kcal` : ""}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>

          {([1, 2, 3] as DayType[]).map((t) => {
            const r = DAY_RULES[t];
            return (
              <Card key={t} tone={TONE[t]} className="space-y-2">
                <H2>{r.name}</H2>
                <p className="text-sm">{r.short}.</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><p className="font-medium">Sí</p><ul className="list-disc pl-4">{r.allowed.map((a) => <li key={a}>{a}</li>)}</ul></div>
                  <div><p className="font-medium">No</p><ul className="list-disc pl-4">{r.forbidden.map((a) => <li key={a}>{a}</li>)}</ul></div>
                </div>
                <p className="text-sm"><span className="font-medium">Bebidas:</span> {lower(r.drinks)}</p>
              </Card>
            );
          })}

          <Card className="space-y-3">
            <H2>Cada toma</H2>
            <ol className="space-y-1 text-sm">
              <li><span className="font-medium">7:00 a. m.</span> 3 huevos (1 entero y 2 claras) o 100 g de proteína animal + vegetales (+ 100 g de carbo los días 1 y 2).</li>
              <li><span className="font-medium">10:00 a. m.</span> 120 g de proteína magra o 5 claras + vegetales (+ 100 g de carbo el día 1).</li>
              <li><span className="font-medium">1:00 p. m.</span> 180 g de proteína magra + vegetales (+ 100 g de carbo el día 1).</li>
              <li><span className="font-medium">4:00 p. m.</span> 120 g de proteína magra o 5 claras + vegetales.</li>
              <li><span className="font-medium">7:00 p. m.</span> 180 g de proteína magra + vegetales.</li>
              <li><span className="font-medium">10:00 p. m.</span> Batido de proteína (o 120 g de proteína / 5 claras).</li>
            </ol>
          </Card>

          <Card className="space-y-2 text-sm">
            <H2>Permitidos</H2>
            <p><span className="font-medium">Carbohidratos:</span> {PLAN_CARBS.map((k) => FOODS[k].name.replace(/ cocid[oa]( en agua)?/, "")).join(", ")}.</p>
            <p><span className="font-medium">Proteínas:</span> {PLAN_PROTEINS.map((k) => FOODS[k].name).join(", ")} (pescado blanco en filete) y huevo. Nada de proteínas con grasa.</p>
            <p><span className="font-medium">Frutas (días 2 y 3):</span> {PLAN_FRUITS.map(([k]) => FOODS[k].name.replace("pulpa de ", "")).join(", ")}.</p>
            <p><span className="font-medium">Vegetales:</span> todos los días, los que quieras, menos remolacha y zanahoria.</p>
          </Card>

          <Notice tone="sun" title="Seguridad">
            Nunca bajamos de {num(PLAN_FLOOR_KCAL)} kcal al día: si un día queda corto, la app suma un poco de almendras o aguacate (días 2 y 3) o hasta 60 g más de proteína magra en almuerzo y cena, y lo marca como complemento. Este plan da unos 200–240 g de proteína al día, más que tu meta anterior de 175 g: hazte el chequeo de función renal que recomendamos al empezar.
          </Notice>
        </>
      )}
    </div>
  );
}
