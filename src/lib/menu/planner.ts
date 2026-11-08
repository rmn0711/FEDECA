// Planificador del menú compartido: rotación de 28+ días, topes semanales y cambio de receta.
import { RECIPES, RECIPE_BY_SLUG, recipesOfKind } from "@/data/recipes";
import { EXCLUDED_PATTERN } from "@/data/foods";
import { addDays, daysBetween, weekStart } from "../format";
import { PREGNANCY_WEEKLY_CAPS } from "../nutrition/safety";
import type { RecipeKind, SlotId } from "../types";
import { SLOTS } from "../types";
import { recipeText } from "./core";
import type { Recipe } from "./types";
import { isAllowed, likeScore, NO_PREFS, prefsKey, type FoodPrefs } from "../prefs";

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

/** Familias de "comida real" para las meriendas de proteína (el resto son lácteos y batidos). */
const MEAT_FAMILIES = new Set(["pollo", "pavo", "res", "cerdo", "camaron", "atun", "sardina", "bocachico", "mojarra", "salmon", "huevo"]);

export interface Pools {
  breakfast: Recipe[];
  snackMeat: Recipe[];
  snackDairy: Recipe[];
  lunch: Recipe[];
  dinner: Recipe[];
  postdinner: Recipe[];
  /** pools donde los gustos dejaron muy pocas opciones y se ignoraron */
  relaxed: string[];
}

const MIN_POOL: Record<string, number> = { breakfast: 7, snackMeat: 7, snackDairy: 3, lunch: 7, dinner: 7, postdinner: 3 };
const poolCache = new Map<string, Pools>();

/** Pools filtrados por gustos. Dentro de cada familia los platos con alimentos que "me gustan" salen primero. */
export function getPools(prefs: FoodPrefs = NO_PREFS): Pools {
  const key = prefsKey(prefs);
  const hit = poolCache.get(key);
  if (hit) return hit;
  const relaxed: string[] = [];
  const build = (name: string, list: Recipe[]): Recipe[] => {
    let ok = list.filter((r) => isAllowed(r, prefs));
    if (ok.length < MIN_POOL[name]) {
      relaxed.push(name);
      ok = list;
    }
    ok = [...ok].sort((a, b) => likeScore(b, prefs) - likeScore(a, prefs)); // estable
    return interleave(ok);
  };
  const snacks = recipesOfKind("snack");
  const pools: Pools = {
    breakfast: build("breakfast", recipesOfKind("breakfast")),
    snackMeat: build("snackMeat", snacks.filter((r) => MEAT_FAMILIES.has(r.family))),
    snackDairy: build("snackDairy", snacks.filter((r) => !MEAT_FAMILIES.has(r.family))),
    lunch: build("lunch", recipesOfKind("lunch")),
    dinner: build("dinner", recipesOfKind("dinner")),
    postdinner: build("postdinner", recipesOfKind("postdinner")),
    relaxed,
  };
  if (poolCache.size > 50) poolCache.clear();
  poolCache.set(key, pools);
  return pools;
}

/** Cuántas recetas quedan por tipo con estos gustos (para avisar si el menú se queda corto). */
export function coverage(prefs: FoodPrefs) {
  const count = (kind: RecipeKind) => recipesOfKind(kind).filter((r) => isAllowed(r, prefs)).length;
  return { breakfast: count("breakfast"), snack: count("snack"), lunch: count("lunch"), dinner: count("dinner"), postdinner: count("postdinner") };
}

export type DayPlan = string[]; // 6 slugs, uno por toma
export type OverrideMap = Record<string, string>; // `${date}:${slot}` → slug

const capKey = (r: Recipe): string[] => {
  const keys: string[] = [];
  for (const l of r.lines) if (PREGNANCY_WEEKLY_CAPS[l.food] && !keys.includes(l.food)) keys.push(l.food);
  return keys;
};

/**
 * Qué pool usa cada toma. Media mañana: casi siempre comida real (cerdo, res, pollo, pescado, huevo en trozos);
 * media tarde alterna con lácteos y batidos. Así la proteína de las meriendas no depende solo del yogur.
 */
function poolFor(slotId: number, kind: RecipeKind, n: number, pools: Pools): Recipe[] {
  if (kind === "snack") {
    const d = ((n % 7) + 7) % 7;
    if (slotId === 1) return d === 2 || d === 5 ? pools.snackDairy : pools.snackMeat;
    return d === 1 || d === 3 || d === 6 ? pools.snackMeat : pools.snackDairy;
  }
  return pools[kind as "breakfast" | "lunch" | "dinner" | "postdinner"];
}

/** Plan de una semana (lunes a domingo) a partir de la rotación determinística. */
export function planWeek(anyDateInWeek: string, overrides: OverrideMap = {}, prefs: FoodPrefs = NO_PREFS): Record<string, DayPlan> {
  const pools = getPools(prefs);
  const ws = weekStart(anyDateInWeek);
  const n0 = daysBetween(EPOCH, ws);
  const used = new Set<string>();
  const counts: Record<string, number> = {};
  const result: Record<string, DayPlan> = {};

  const pick = (pool: Recipe[], start: number, banned: Set<string>): Recipe => {
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
        r = pick(poolFor(slot.id, slot.kind, n, pools), slot.kind === "snack" ? n * 3 + (slot.id === 3 ? 1 : 0) : n, dayBanned);
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

export function planDay(date: string, overrides: OverrideMap = {}, prefs: FoodPrefs = NO_PREFS): DayPlan {
  return planWeek(date, overrides, prefs)[date];
}

/** Receta planeada para una toma. */
export function recipeFor(date: string, slot: SlotId, overrides: OverrideMap = {}, prefs: FoodPrefs = NO_PREFS): Recipe {
  return RECIPE_BY_SLUG[planDay(date, overrides, prefs)[slot]];
}

/* ───────────── "No tengo esto / no me provoca" ───────────── */

/** Cambia la receta por otra del mismo tipo con macros equivalentes (±12 % de proteína, ±20 % de kcal). */
export function findSubstitute(current: Recipe, weekSlugs: string[], opts: { dislikedFamilies?: string[]; dislikedFoods?: string[]; prefs?: FoodPrefs } = {}): Recipe | null {
  const prefs = opts.prefs ?? NO_PREFS;
  const pools = getPools(prefs);
  const basePool = current.kind === "snack" ? (MEAT_FAMILIES.has(current.family) ? pools.snackMeat : pools.snackDairy) : pools[current.kind as "breakfast" | "lunch" | "dinner" | "postdinner"];
  const used = new Set(weekSlugs);
  const counts: Record<string, number> = {};
  for (const s of weekSlugs) for (const c of capKey(RECIPE_BY_SLUG[s])) counts[c] = (counts[c] ?? 0) + 1;
  const candidates = basePool.filter((r) => {
    if (r.slug === current.slug || used.has(r.slug)) return false;
    if (opts.dislikedFamilies?.includes(r.family)) return false;
    if (opts.dislikedFoods?.some((f) => r.lines.some((l) => l.food === f))) return false;
    if (capKey(r).some((c) => (counts[c] ?? 0) >= PREGNANCY_WEEKLY_CAPS[c])) return false;
    return true;
  });
  const dist = (r: Recipe) => -likeScore(r, prefs) * 0.15 + Math.abs(r.macros.p - current.macros.p) / Math.max(1, current.macros.p) + Math.abs(r.macros.kcal - current.macros.kcal) / Math.max(1, current.macros.kcal);
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
