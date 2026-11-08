// Planificador del menú compartido: rotación de 28+ días, topes semanales y cambio de receta.
import { RECIPES, RECIPE_BY_SLUG, recipesOfKind } from "@/data/recipes";
import { EXCLUDED_PATTERN } from "@/data/foods";
import { addDays, daysBetween, weekStart } from "../format";
import { PREGNANCY_WEEKLY_CAPS } from "../nutrition/safety";
import type { RecipeKind, SlotId } from "../types";
import { SLOTS } from "../types";
import { recipeText } from "./core";
import type { Recipe } from "./types";

const EPOCH = "2026-01-05"; // lunes

/** Intercala las recetas por familia de proteína para que los días consecutivos varíen. */
function interleave(list: Recipe[]): Recipe[] {
  const groups = new Map<string, Recipe[]>();
  for (const r of list) groups.set(r.family, [...(groups.get(r.family) ?? []), r]);
  const queues = [...groups.values()].sort((a, b) => b.length - a.length);
  const out: Recipe[] = [];
  while (out.length < list.length) {
    for (const q of queues) {
      const r = q.shift();
      if (r) out.push(r);
    }
  }
  return out;
}

const POOLS: Record<RecipeKind, Recipe[]> = {
  breakfast: interleave(recipesOfKind("breakfast")),
  snack: interleave(recipesOfKind("snack")),
  lunch: interleave(recipesOfKind("lunch")),
  dinner: interleave(recipesOfKind("dinner")),
  postdinner: interleave(recipesOfKind("postdinner")),
};

export type DayPlan = string[]; // 6 slugs, uno por toma
export type OverrideMap = Record<string, string>; // `${date}:${slot}` → slug

const capKey = (r: Recipe): string[] => {
  const keys: string[] = [];
  for (const l of r.lines) if (PREGNANCY_WEEKLY_CAPS[l.food] && !keys.includes(l.food)) keys.push(l.food);
  return keys;
};

/** Plan de una semana (lunes a domingo) a partir de la rotación determinística. */
export function planWeek(anyDateInWeek: string, overrides: OverrideMap = {}): Record<string, DayPlan> {
  const ws = weekStart(anyDateInWeek);
  const n0 = daysBetween(EPOCH, ws);
  const used = new Set<string>();
  const counts: Record<string, number> = {};
  const result: Record<string, DayPlan> = {};

  const pick = (kind: RecipeKind, start: number, banned: Set<string>): Recipe => {
    const pool = POOLS[kind];
    for (let k = 0; k < pool.length; k++) {
      const r = pool[(((start + k) % pool.length) + pool.length) % pool.length];
      if (banned.has(r.slug) || used.has(r.slug)) continue;
      const caps = capKey(r);
      if (caps.some((c) => (counts[c] ?? 0) >= PREGNANCY_WEEKLY_CAPS[c])) continue;
      return r;
    }
    return pool[((start % pool.length) + pool.length) % pool.length];
  };

  for (let d = 0; d < 7; d++) {
    const date = addDays(ws, d);
    const n = n0 + d;
    const dayBanned = new Set<string>();
    const day: string[] = [];
    SLOTS.forEach((slot) => {
      const ov = overrides[`${date}:${slot.id}`];
      let r: Recipe;
      if (ov && RECIPE_BY_SLUG[ov]) r = RECIPE_BY_SLUG[ov];
      else {
        const offset = slot.kind === "snack" ? n * 2 + (slot.id === 3 ? 1 : 0) : n;
        r = pick(slot.kind, offset, dayBanned);
      }
      used.add(r.slug);
      dayBanned.add(r.slug);
      for (const c of capKey(r)) counts[c] = (counts[c] ?? 0) + 1;
      day.push(r.slug);
    });
    result[date] = day;
  }
  return result;
}

export function planDay(date: string, overrides: OverrideMap = {}): DayPlan {
  return planWeek(date, overrides)[date];
}

/** Receta planeada para una toma. */
export function recipeFor(date: string, slot: SlotId, overrides: OverrideMap = {}): Recipe {
  return RECIPE_BY_SLUG[planDay(date, overrides)[slot]];
}

/* ───────────── "No tengo esto / no me provoca" ───────────── */

/** Cambia la receta por otra del mismo tipo con macros equivalentes (±12 % de proteína, ±20 % de kcal). */
export function findSubstitute(current: Recipe, weekSlugs: string[], opts: { dislikedFamilies?: string[]; dislikedFoods?: string[] } = {}): Recipe | null {
  const used = new Set(weekSlugs);
  const counts: Record<string, number> = {};
  for (const s of weekSlugs) for (const c of capKey(RECIPE_BY_SLUG[s])) counts[c] = (counts[c] ?? 0) + 1;
  const candidates = POOLS[current.kind].filter((r) => {
    if (r.slug === current.slug || used.has(r.slug)) return false;
    if (opts.dislikedFamilies?.includes(r.family)) return false;
    if (opts.dislikedFoods?.some((f) => r.lines.some((l) => l.food === f))) return false;
    if (capKey(r).some((c) => (counts[c] ?? 0) >= PREGNANCY_WEEKLY_CAPS[c])) return false;
    return true;
  });
  const dist = (r: Recipe) => Math.abs(r.macros.p - current.macros.p) / Math.max(1, current.macros.p) + Math.abs(r.macros.kcal - current.macros.kcal) / Math.max(1, current.macros.kcal);
  const ok = candidates.filter((r) => Math.abs(r.macros.p - current.macros.p) / Math.max(1, current.macros.p) <= 0.12 && Math.abs(r.macros.kcal - current.macros.kcal) / Math.max(1, current.macros.kcal) <= 0.2);
  const list = (ok.length ? ok : candidates).sort((a, b) => dist(a) - dist(b));
  // prefiere otra familia de proteína
  return list.find((r) => r.family !== current.family) ?? list[0] ?? null;
}

/* ───────────── Validación ───────────── */

export function validateCatalog() {
  const problems: string[] = [];
  for (const r of RECIPES) {
    if (EXCLUDED_PATTERN.test(recipeText(r))) problems.push(`Exclusión en ${r.slug}`);
    if (!r.steps.length) problems.push(`Sin pasos: ${r.slug}`);
  }
  return problems;
}
