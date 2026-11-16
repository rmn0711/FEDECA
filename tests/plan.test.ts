import { describe, expect, it } from "vitest";
import { computeDay } from "@/lib/day";
import { addDays } from "@/lib/format";
import { defaultMealTimes } from "@/lib/nutrition/meals";
import { DAY_RULES, decodeSpec, getRecipe, MAX_COMPLEMENT_G, PLAN_CARBS, PLAN_FLOOR_KCAL, PLAN_PROTEINS, planAlternative, planDay, weekDayTypes } from "@/lib/plan/ciclo3";
import { planWeek } from "@/lib/menu/planner";
import { RECIPE_BY_SLUG } from "@/data/recipes";
import { EXCLUDED_PATTERN } from "@/data/foods";
import { recipeText } from "@/lib/menu/core";
import { buildPrefs } from "@/lib/prefs";
import type { Profile } from "@/lib/types";

const jose: Profile = { id: "j", household_id: "h", slug: "jose", name: "Jose", mode: "fat_loss", sex: "male", age: 38, height_cm: 178, start_weight_kg: 123, current_weight_kg: 123, goal_weight_kg: 105, pre_pregnancy_weight_kg: null, due_date: null, waist_cm: null, hip_cm: null, neck_cm: null, training_time: "17:30", training_days: [1, 2, 4, 5], training_place: "gym", uses_glp1: false, protein_anchor_weight_kg: 123, meal_times: defaultMealTimes(), onboarding_done: true, medical_ack: true, diet_plan: "ciclo3", plan_weigh: "cocido" };
const yanina: Profile = { ...jose, id: "y", slug: "esposa", name: "Yanina", mode: "pregnancy", sex: "female", height_cm: 162, current_weight_kg: 63, pre_pregnancy_weight_kg: 58, due_date: "2027-04-15", training_days: [] };
const dates = Array.from({ length: 28 }, (_, i) => addDays("2026-11-16", i));
const ALLOWED_PROTEIN = new Set([...PLAN_PROTEINS, "huevo", "clara", "whey"]);
const EXTRAS = ["aguacate", "aceite", "almendras"];
const FRUITS = new Set(["pina", "kiwi", "maracuya", "mango_verde", "manzana_verde", "pera_verde", "guayaba", "pomelo"]);

describe("semana del plan del nutricionista", () => {
  it("Día 1 en los días de pierna; se repite igual cada semana", () => {
    expect(weekDayTypes([1, 2, 4, 5])).toEqual({ 1: 1, 2: 2, 3: 3, 4: 1, 5: 2, 6: 3, 0: 2 });
    expect(weekDayTypes([])[1]).toBe(1);
    const a = computeDay({ profile: jose, date: "2026-11-16", today: "2026-11-16", overrides: {}, logs: [] }).targets.planDayType;
    const b = computeDay({ profile: jose, date: "2026-11-23", today: "2026-11-23", overrides: {}, logs: [] }).targets.planDayType;
    expect(a).toBe(1);
    expect(b).toBe(a);
  });
});

describe("reglas de cada día", () => {
  for (const date of dates) {
    const d = computeDay({ profile: jose, date, today: date, overrides: {}, logs: [] });
    const type = d.targets.planDayType!;
    const rule = DAY_RULES[type];
    it(`${date} · Día ${type}`, () => {
      d.slots.forEach((s, i) => {
        expect(s.recipe.slug.startsWith("plan-")).toBe(true);
        const carbs = s.recipe.lines.filter((l) => l.role === "carb");
        if (rule.carbSlots.includes(i)) {
          expect(carbs).toHaveLength(1);
          expect(carbs[0].g).toBe(100);
          expect(PLAN_CARBS).toContain(carbs[0].food);
        } else expect(carbs).toHaveLength(0);
        for (const l of s.recipe.lines) {
          expect(["zanahoria", "remolacha"]).not.toContain(l.food);
          if (l.role === "protein") expect(ALLOWED_PROTEIN.has(l.food), l.food).toBe(true);
          if (!rule.extras) {
            expect(EXTRAS).not.toContain(l.food);
            expect(FRUITS.has(l.food)).toBe(false);
          }
        }
        expect(EXCLUDED_PATTERN.test(recipeText(s.recipe))).toBe(false);
      });
      // gramos de proteína del plan
      const prot = (i: number) => d.slots[i].recipe.lines.filter((l) => l.role === "protein");
      expect(prot(0).map((l) => l.food).sort()).toEqual(["clara", "huevo"]);
      for (const i of [2, 4]) {
        expect(prot(i)[0].g).toBeGreaterThanOrEqual(180);
        expect(prot(i)[0].g).toBeLessThanOrEqual(180 + MAX_COMPLEMENT_G);
      }
      for (const i of [1, 3]) {
        const p = prot(i)[0];
        expect(p.food === "clara" ? p.g === 165 : p.g === 120).toBe(true);
      }
      expect(prot(5)[0].food).toBe("whey");
      // mínimo seguro: o se cumple, o el faltante se reporta para avisar
      expect(d.targets.kcal + (d.targets.planBelowFloor ?? 0)).toBeGreaterThanOrEqual(PLAN_FLOOR_KCAL - 1);
    });
  }
  it("los días 2 y 3 traen fruta permitida y grasas buenas", () => {
    const d2 = computeDay({ profile: jose, date: "2026-11-17", today: "2026-11-17", overrides: {}, logs: [] });
    expect(d2.targets.planDayType).toBe(2);
    expect(d2.slots[0].recipe.lines.some((l) => FRUITS.has(l.food))).toBe(true);
    expect(d2.slots[2].recipe.lines.some((l) => l.food === "aguacate")).toBe(true);
    expect(d2.slots[3].recipe.lines.some((l) => l.food === "almendras")).toBe(true);
  });
});

describe("cambios y gustos", () => {
  it("la toma se reconstruye igual desde su enlace", () => {
    const d = computeDay({ profile: jose, date: "2026-11-16", today: "2026-11-16", overrides: {}, logs: [] });
    for (const s of d.slots) {
      const r = getRecipe(s.recipe.slug)!;
      expect(r.name).toBe(s.recipe.name);
      expect(Math.round(r.macros.kcal)).toBe(Math.round(s.recipe.macros.kcal));
    }
  });
  it("cambiar plato da otra opción permitida y respeta el día", () => {
    const date = "2026-11-16";
    const d = computeDay({ profile: jose, date, today: date, overrides: {}, logs: [] });
    const lunch = d.slots[2].recipe.slug;
    const alt = planAlternative(lunch)!;
    expect(alt).not.toBe(lunch);
    const d2 = computeDay({ profile: jose, date, today: date, overrides: { [`${date}:12`]: alt }, logs: [] });
    const spec = decodeSpec(d2.slots[2].recipe.slug)!;
    expect(spec.p).not.toBe(decodeSpec(lunch)!.p);
    expect(d2.slots[2].recipe.lines.filter((l) => l.role === "carb")).toHaveLength(1);
    // desayuno: huevos ↔ 100 g de proteína animal
    const bAlt = decodeSpec(planAlternative(d.slots[0].recipe.slug)!)!;
    expect(bAlt.k).toBe("prot");
    expect(bAlt.g).toBe(100);
    // batido ↔ claras
    expect(decodeSpec(planAlternative(d.slots[5].recipe.slug)!)!.k).toBe("claras");
  });
  it("el cambio de Jose no toca el menú de Yanina", () => {
    const date = "2026-11-16";
    const before = computeDay({ profile: yanina, date, today: date, overrides: {}, logs: [] }).slots.map((s) => s.recipe.slug);
    const alt = planAlternative(computeDay({ profile: jose, date, today: date, overrides: {}, logs: [] }).slots[2].recipe.slug)!;
    const after = computeDay({ profile: yanina, date, today: date, overrides: { [`${date}:12`]: alt }, logs: [] }).slots.map((s) => s.recipe.slug);
    expect(after).toEqual(before);
    expect(after.some((s) => s.startsWith("plan-"))).toBe(false);
  });
  it("respeta lo que no le gusta (avena, cerdo)", () => {
    const prefs = buildPrefs([{ food_key: "avena_cocida", pref: "dislike" }, { food_key: "cerdo", pref: "dislike" }]);
    for (const date of dates) {
      const d = computeDay({ profile: jose, date, today: date, overrides: {}, logs: [], prefs });
      for (const s of d.slots) for (const l of s.recipe.lines) expect(["avena_cocida", "cerdo"]).not.toContain(l.food);
    }
  });
  it("usa la misma proteína del almuerzo de la casa cuando está permitida (se cocina una vez)", () => {
    let aligned = 0;
    for (const date of dates) {
      const shared = planWeek(date)[date];
      const main = RECIPE_BY_SLUG[shared[2]].lines.find((l) => l.role === "protein")!.food;
      const p = planDay({ profile: jose, date, sharedSlugs: shared });
      if (PLAN_PROTEINS.includes(main)) {
        expect(p.specs[2].p).toBe(main);
        aligned++;
      }
    }
    expect(aligned).toBeGreaterThan(5);
  });
  it("pesando en crudo, la pechuga cocida pesa menos que lo indicado", () => {
    const crudo = { ...jose, plan_weigh: "crudo" as const };
    const date = dates.find((dt) => planDay({ profile: jose, date: dt }).specs[2].p === "pechuga")!;
    const p = planDay({ profile: crudo, date });
    const line = p.recipes[2].lines.find((l) => l.food === "pechuga")!;
    const planned = 180 + (p.specs[2].cg ?? 0);
    expect(line.g).toBe(Math.round(planned * 0.75));
    expect(line.g).toBeLessThan(planned);
    expect(line.label).toMatch(/crudo/);
  });
  it("con el plan apagado vuelve el menú calculado por la app", () => {
    const d = computeDay({ profile: { ...jose, diet_plan: "app" }, date: "2026-11-16", today: "2026-11-16", overrides: {}, logs: [] });
    expect(d.slots.some((s) => s.recipe.slug.startsWith("plan-"))).toBe(false);
    expect(d.targets.planDayType).toBeUndefined();
  });
});
