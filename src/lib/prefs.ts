// Gustos de comida: "no me gusta" saca el alimento del menú; "me gusta" lo prioriza.
import { FOODS } from "@/data/foods";
import type { Recipe } from "./menu/types";

export type PrefValue = "like" | "dislike";
export interface FoodPrefRow {
  id?: string;
  household_id: string;
  profile_id: string;
  food_key: string;
  pref: PrefValue;
}

export interface FoodPrefs {
  dislikes: Set<string>;
  likes: Set<string>;
}

export const NO_PREFS: FoodPrefs = { dislikes: new Set(), likes: new Set() };

/** Alimentos que no tiene sentido preguntar (condimentos). */
export const NON_PREFERABLE = new Set(["especias", "aceite", "limon"]);

/**
 * El menú es uno solo para los dos: lo que cualquiera marque como "no me gusta" sale del menú de ambos.
 * Un "no me gusta" siempre gana sobre un "me gusta".
 */
export function buildPrefs(rows: Pick<FoodPrefRow, "food_key" | "pref">[]): FoodPrefs {
  const dislikes = new Set(rows.filter((r) => r.pref === "dislike").map((r) => r.food_key));
  const likes = new Set(rows.filter((r) => r.pref === "like" && !dislikes.has(r.food_key)).map((r) => r.food_key));
  return { dislikes, likes };
}

/** Alimentos de una receta, incluyendo el reemplazo que se usa en el embarazo. */
export function recipeFoodKeys(r: Pick<Recipe, "lines">): Set<string> {
  const s = new Set<string>();
  for (const l of r.lines) {
    s.add(l.food);
    const sub = FOODS[l.food]?.preg?.sub;
    if (sub) s.add(sub);
  }
  return s;
}

export const isAllowed = (r: Pick<Recipe, "lines">, prefs: FoodPrefs): boolean => {
  if (prefs.dislikes.size === 0) return true;
  for (const f of recipeFoodKeys(r)) if (prefs.dislikes.has(f)) return false;
  return true;
};

export const likeScore = (r: Pick<Recipe, "lines">, prefs: FoodPrefs): number => {
  if (prefs.likes.size === 0) return 0;
  let n = 0;
  for (const f of recipeFoodKeys(r)) if (prefs.likes.has(f)) n++;
  return n;
};

export const prefsKey = (p: FoodPrefs) => `${[...p.dislikes].sort().join(",")}|${[...p.likes].sort().join(",")}`;
