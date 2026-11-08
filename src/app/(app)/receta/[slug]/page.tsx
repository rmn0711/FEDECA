"use client";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowLeft, Clock } from "lucide-react";
import { Button, Card, Chip, H2, Notice } from "@/components/ui";
import { FoodArt } from "@/components/FoodArt";
import { IngredientList, MacroRow, TagList } from "@/components/RecipeBits";
import { useApp } from "@/lib/app-context";
import { computeDay } from "@/lib/day";
import { num, time12 } from "@/lib/format";
import { useTable } from "@/lib/hooks";
import { RECIPE_BY_SLUG } from "@/data/recipes";
import { adaptForPregnancy } from "@/lib/menu/adapt";
import { scaleRecipe, snackHeading } from "@/lib/menu/core";
import { findSubstitute, planWeek, type OverrideMap } from "@/lib/menu/planner";
import { pregnancyView } from "@/lib/nutrition/safety";
import { FOODS } from "@/data/foods";
import type { MenuOverride, SlotId } from "@/lib/types";
import { buildPrefs } from "@/lib/prefs";

export default function RecipePage() {
  const { slug } = useParams<{ slug: string }>();
  const sp = useSearchParams();
  const router = useRouter();
  const { active, today, householdId, prefs, setPref, prefRows } = useApp();
  const date = sp.get("date") ?? today;
  const slotParam = sp.get("slot");
  const ov = useTable<MenuOverride>("menu_overrides", { match: { household_id: householdId }, range: { col: "date", from: date, to: date } }, [date]);
  const overrides: OverrideMap = useMemo(() => Object.fromEntries(ov.rows.map((o) => [`${o.date}:${o.slot}`, o.recipe_slug])), [ov.rows]);
  const [msg, setMsg] = useState<string | null>(null);

  const base = RECIPE_BY_SLUG[slug];
  const view = useMemo(() => {
    if (!active || !base) return null;
    const d = computeDay({ profile: active, date, today, overrides, logs: [], prefs });
    const s = slotParam !== null ? d.slots[Number(slotParam)] : d.slots.find((x) => x.recipe.slug === slug);
    if (s && s.recipe.slug === slug) return { portion: s.portion, recipe: s.recipe, slot: s.slot, time: s.baseTime, targetP: s.proteinG };
    const recipe = active.mode === "pregnancy" ? adaptForPregnancy(base) : base;
    return { portion: scaleRecipe(recipe, { proteinG: recipe.macros.p, kcal: recipe.macros.kcal }), recipe, slot: null as number | null, time: null as string | null, targetP: recipe.macros.p };
  }, [active, base, date, today, overrides, slug, slotParam, prefs]);

  if (!base || !active || !view) return <div className="space-y-4"><p>No encontramos esa receta.</p><Link href="/menu" className="text-brand underline">Volver al menú</Link></div>;
  const pv = pregnancyView(base);
  const replaced: Record<string, string> = {};
  pv.lines.forEach((l) => { if (l.replacedFrom) replaced[l.line.food] = FOODS[l.replacedFrom].name; });
  const snack = base.kind === "snack";
  const m = view.portion.macros;

  async function dislike(food: string, name: string) {
    await setPref(active!.id, food, "dislike");
    if (view?.slot == null) return setMsg(`Listo: ${name} ya no aparecerá en tu menú.`);
    const next = buildPrefs([...prefRows.filter((r) => !(r.profile_id === active!.id && r.food_key === food)), { food_key: food, pref: "dislike" }]);
    const week = Object.values(planWeek(date, overrides, next)).flat();
    const sub = findSubstitute(base, week, { prefs: next });
    if (!sub) return setMsg("Guardé tu gusto, pero no encontré un plato equivalente por ahora.");
    await ov.upsert({ household_id: householdId, date, slot: view.slot as SlotId, recipe_slug: sub.slug, reason: `no me gusta ${name}` }, ["household_id", "date", "slot"]);
    router.replace(`/receta/${sub.slug}?date=${date}&slot=${view.slot}`);
  }

  async function swap() {
    if (view?.slot == null) return;
    const week = Object.values(planWeek(date, overrides, prefs)).flat();
    const sub = findSubstitute(base, week, { prefs });
    if (!sub) return setMsg("No hay un plato equivalente disponible.");
    await ov.upsert({ household_id: householdId, date, slot: view.slot as SlotId, recipe_slug: sub.slug, reason: "no me provoca" }, ["household_id", "date", "slot"]);
    router.replace(`/receta/${sub.slug}?date=${date}&slot=${view.slot}`);
  }

  return (
    <article className="space-y-5">
      <button onClick={() => router.back()} className="inline-flex items-center gap-1 text-sm text-muted"><ArrowLeft size={16} aria-hidden /> Volver</button>
      <FoodArt art={base.art} className="h-44 w-full rounded-3xl" />
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wider text-muted">{view.slot !== null ? `${["Desayuno", "Media mañana", "Almuerzo", "Media tarde", "Cena", "Post-cena"][view.slot]}${view.time ? ` · ${time12(view.time)}` : ""}` : "Receta"}</p>
        <h1 className="font-display text-2xl font-semibold leading-snug">{snack ? snackHeading(base, view.portion.lines).title : base.name}</h1>
        {snack && <p className="text-muted">{snackHeading(base, view.portion.lines).detail}</p>}
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted"><span className="inline-flex items-center gap-1"><Clock size={14} aria-hidden /> {base.timeMin} min</span><TagList tags={base.tags.slice(0, 4)} /></div>
      </header>

      <Card className="space-y-3">
        <H2>Tu porción</H2>
        <p className="text-sm text-muted">Calculada para {active.name}: {num(Math.round(view.targetP))} g de proteína en esta toma.</p>
        <MacroRow kcal={m.kcal} p={m.p} c={m.c} f={m.f} fiber={m.fiber} />
      </Card>

      <section className="space-y-3">
        <H2>Ingredientes</H2>
        <p className="text-sm text-muted">Gramos tal como se comen (cocidos) y su equivalente crudo, con medidas caseras.</p>
        <IngredientList lines={view.portion.lines} replaced={active.mode === "pregnancy" ? replaced : {}} onDislike={dislike} />
      </section>

      {active.mode === "pregnancy" && pv.notes.length > 0 && (
        <Notice tone="plum" title="Seguridad en el embarazo"><ul className="list-disc space-y-1 pl-5">{pv.notes.map((n) => <li key={n}>{n}</li>)}</ul></Notice>
      )}

      <section className="space-y-3">
        <H2>Paso a paso</H2>
        <ol className="space-y-3">
          {base.steps.map((s, i) => (
            <li key={i} className="flex gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-soft text-sm font-semibold text-brand tabular">{i + 1}</span><p className="pt-0.5">{s}</p></li>
          ))}
        </ol>
      </section>

      {view.slot !== null && <div className="flex flex-wrap gap-2"><Button variant="soft" onClick={swap}>No tengo esto / no me provoca</Button></div>}
      {msg && <p role="status" className="text-sm text-clay">{msg}</p>}
      <Chip tone="sky">Menú compartido: el cambio aplica a los dos</Chip>
    </article>
  );
}
