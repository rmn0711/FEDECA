import { pregnancyView } from "../nutrition/safety";
import { buildRecipe } from "./core";
import type { Recipe } from "./types";

/** Receta adaptada al embarazo: sustituye ingredientes no aptos y recalcula macros. */
export function adaptForPregnancy(recipe: Recipe): Recipe {
  const view = pregnancyView(recipe);
  if (!view.hasSubstitution) return recipe;
  return buildRecipe({ ...recipe, lines: view.lines.map((v) => v.line) });
}
