import { describe, expect, it } from "vitest";
import { RECIPES, RECIPE_BY_SLUG, recipesOfKind } from "@/data/recipes";
import { EXCLUDED_PATTERN, FOODS } from "@/data/foods";
import { describeLine, recipeText, scaleRecipe, snackTitle, sumMacros } from "@/lib/menu/core";
import { findSubstitute, planWeek, validateCatalog } from "@/lib/menu/planner";
import { buildShoppingList, mealPrepTips } from "@/lib/menu/shopping";
import { dayTargets } from "@/lib/nutrition/targets";
import { addDays } from "@/lib/format";
import type { Profile } from "@/lib/types";
import { defaultMealTimes } from "@/lib/nutrition/meals";

const jose: Profile = {
  id: "j", household_id: "h", slug: "jose", name: "Jose", mode: "fat_loss", sex: "male", age: 35, height_cm: 178,
  start_weight_kg: 123, current_weight_kg: 123, goal_weight_kg: 95, pre_pregnancy_weight_kg: null, due_date: null,
  waist_cm: 120, hip_cm: 112, neck_cm: 43, training_time: "17:30", training_days: [1, 2, 4, 5], training_place: "gym",
  uses_glp1: false, protein_anchor_weight_kg: 123, meal_times: defaultMealTimes(), onboarding_done: true, medical_ack: true,
};
const esposa: Profile = { ...jose, id: "e", slug: "esposa", name: "Esposa", mode: "pregnancy", sex: "female", age: 30, height_cm: 163, start_weight_kg: null, current_weight_kg: 62, pre_pregnancy_weight_kg: 58, due_date: "2027-04-15", training_days: [], training_time: null, training_place: null, protein_anchor_weight_kg: null };

describe("catálogo de recetas", () => {
  it("más de 150 recetas y más de 40 meriendas de solo proteína", () => {
    expect(RECIPES.length).toBeGreaterThan(150);
    expect(recipesOfKind("snack").length).toBeGreaterThan(40);
    expect(recipesOfKind("lunch").length).toBeGreaterThanOrEqual(28);
    expect(recipesOfKind("dinner").length).toBeGreaterThanOrEqual(28);
  });
  it("EXCLUSIONES ABSOLUTAS: tomate, pepino, papaya, brócoli, coliflor", () => {
    for (const r of RECIPES) expect(EXCLUDED_PATTERN.test(recipeText(r)), r.slug).toBe(false);
    expect(validateCatalog()).toEqual([]);
    for (const f of Object.values(FOODS)) expect(EXCLUDED_PATTERN.test(f.name), f.key).toBe(false);
  });
  it("cada receta tiene macros finitos, tiempo y pasos", () => {
    for (const r of RECIPES) {
      expect(Number.isFinite(r.macros.kcal) && r.macros.p > 0, r.slug).toBe(true);
      expect(r.steps.length).toBeGreaterThan(0);
      expect(r.timeMin).toBeGreaterThan(0);
      expect(new Set(r.lines.map((l) => l.food)).size).toBe(r.lines.length);
    }
  });
  it("slugs únicos", () => {
    expect(new Set(RECIPES.map((r) => r.slug)).size).toBe(RECIPES.length);
  });
  it("meriendas: solo proteína (sin carbohidratos relevantes) y títulos con equivalencia", () => {
    for (const r of recipesOfKind("snack")) {
      expect(r.lines.every((l) => l.role === "protein"), r.slug).toBe(true);
      expect(sumMacros(r.lines).p, r.slug).toBeGreaterThanOrEqual(18);
    }
    const pechuga = RECIPES.find((r) => r.slug.startsWith("merienda-") && r.lines.length === 1 && r.lines[0].food === "pechuga" && r.lines[0].g === 120)!;
    expect(snackTitle(pechuga.lines)).toBe("120 g de pechuga de pollo = 37 g de proteína");
    expect(describeLine({ food: "whey", g: 45, role: "protein" })).toBe("1,5 scoop de proteína whey");
  });
  it("post-cena ≤ 200 kcal con 20 g de proteína", () => {
    for (const r of recipesOfKind("postdinner")) {
      const p = scaleRecipe(r, { proteinG: 20, kcal: 150 });
      expect(p.macros.kcal, r.slug).toBeLessThanOrEqual(200);
    }
  });
});

describe("porciones por perfil", () => {
  it("el almuerzo de Jose alcanza 40 g de proteína", () => {
    const t = dayTargets(jose, "2026-11-10", "2026-11-10");
    expect(t.proteinG).toBe(175);
    for (const r of recipesOfKind("lunch").slice(0, 20)) {
      const p = scaleRecipe(r, { proteinG: t.proteinSlots[2], kcal: t.kcalSlots[2] });
      expect(Math.abs(p.macros.p - 40), r.slug).toBeLessThan(4);
    }
  });
  it("la cena prioriza proteína aunque las kcal queden por debajo", () => {
    const r = recipesOfKind("dinner")[0];
    const p = scaleRecipe(r, { proteinG: 30, kcal: 650 });
    expect(Math.abs(p.macros.p - 30)).toBeLessThan(3);
  });
  it("Jose nunca baja de 1.800 kcal y los días de pierna suman kcal", () => {
    for (let d = 0; d < 7; d++) {
      const t = dayTargets(jose, addDays("2026-11-09", d));
      expect(t.kcal).toBeGreaterThanOrEqual(1800);
    }
    const mon = dayTargets(jose, "2026-11-09");
    const tue = dayTargets(jose, "2026-11-10");
    expect(mon.isLegDay).toBe(true);
    expect(mon.kcal).toBeGreaterThan(tue.kcal);
    expect(mon.preSlot).toBe(3);
    expect(mon.postSlot).toBe(4);
  });
  it("embarazo: calorías con trimestre y sin déficit", () => {
    const t = dayTargets(esposa, "2026-11-08", "2026-11-08");
    expect(t.trimester).toBe(2);
    expect(t.addKcal).toBe(340);
    expect(t.proteinG).toBeGreaterThanOrEqual(71);
    expect(t.proteinSlots.reduce((a, b) => a + b, 0)).toBe(t.proteinG);
  });
});

describe("planificador", () => {
  it("28 días: sin repetir almuerzo ni cena dentro de la semana (ni en el ciclo)", () => {
    const lunches = new Set<string>();
    const dinners = new Set<string>();
    for (let w = 0; w < 4; w++) {
      const plan = planWeek(addDays("2026-11-09", w * 7));
      const wl = Object.values(plan).map((d) => d[2]);
      const wd = Object.values(plan).map((d) => d[4]);
      expect(new Set(wl).size).toBe(7);
      expect(new Set(wd).size).toBe(7);
      wl.forEach((s) => lunches.add(s));
      wd.forEach((s) => dinners.add(s));
    }
    expect(lunches.size).toBe(28);
    expect(dinners.size).toBe(28);
  });
  it("tipos correctos por toma y tope de atún (2) y róbalo (1) por semana", () => {
    for (let w = 0; w < 12; w++) {
      const plan = planWeek(addDays("2026-11-09", w * 7));
      const slugs = Object.values(plan).flat();
      const kinds = ["breakfast", "snack", "lunch", "snack", "dinner", "postdinner"];
      Object.values(plan).forEach((d) => d.forEach((s, i) => expect(RECIPE_BY_SLUG[s].kind).toBe(kinds[i])));
      const atun = slugs.filter((s) => RECIPE_BY_SLUG[s].lines.some((l) => l.food === "atun")).length;
      const robalo = slugs.filter((s) => RECIPE_BY_SLUG[s].lines.some((l) => l.food === "robalo")).length;
      expect(atun).toBeLessThanOrEqual(2);
      expect(robalo).toBeLessThanOrEqual(1);
    }
  });
  it("es determinístico", () => {
    expect(planWeek("2026-11-11")).toEqual(planWeek("2026-11-09"));
  });
  it("sustituto con macros equivalentes", () => {
    const plan = planWeek("2026-11-09");
    const week = Object.values(plan).flat();
    const cur = RECIPE_BY_SLUG[plan["2026-11-09"][2]];
    const sub = findSubstitute(cur, week)!;
    expect(sub.kind).toBe("lunch");
    expect(week.includes(sub.slug)).toBe(false);
    expect(Math.abs(sub.macros.p - cur.macros.p) / cur.macros.p).toBeLessThan(0.25);
  });
});

describe("lista de mercado y meal prep", () => {
  const week = Array.from({ length: 7 }, (_, i) => addDays("2026-11-09", i));
  const plan = planWeek(week[0]);
  const persons = [
    { plan, targets: Object.fromEntries(week.map((d) => [d, dayTargets(jose, d)])), pregnant: false },
    { plan, targets: Object.fromEntries(week.map((d) => [d, dayTargets(esposa, d, "2026-11-08")])), pregnant: true },
  ];
  it("agrupa por sección y suma ambos perfiles", () => {
    const solo = buildShoppingList([persons[0]]);
    const both = buildShoppingList(persons);
    const total = (l: ReturnType<typeof buildShoppingList>) => Object.values(l).flat().reduce((a, i) => a + i.rawG, 0);
    expect(total(both)).toBeGreaterThan(total(solo));
    expect(Object.values(both).flat().length).toBeGreaterThan(10);
    expect(both["Carnes y aves"].length + both["Pescados y mariscos"].length).toBeGreaterThan(0);
  });
  it("la lista de ella no incluye queso costeño", () => {
    const l = buildShoppingList([persons[1]]);
    expect(Object.values(l).flat().some((i) => i.food === "costeno")).toBe(false);
  });
  it("sugiere meal prep", () => {
    const tips = mealPrepTips(persons, week);
    expect(tips.length).toBeGreaterThan(3);
  });
});
