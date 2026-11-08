// Seguridad alimentaria del embarazo: sustituciones, notas, topes semanales y cafeína.
import { FOODS } from "@/data/foods";
import type { Recipe, RecipeLine } from "../menu/types";

export const CAFFEINE_MAX_MG = 200;

export interface CaffeineItem {
  key: string;
  name: string;
  mg: number;
  serving: string;
}

export const CAFFEINE_ITEMS: CaffeineItem[] = [
  { key: "tinto", name: "Café tinto", mg: 95, serving: "1 taza (240 ml)" },
  { key: "cafe_leche", name: "Café con leche", mg: 80, serving: "1 taza (240 ml)" },
  { key: "instantaneo", name: "Café instantáneo", mg: 62, serving: "1 taza (240 ml)" },
  { key: "espresso", name: "Espresso / pocillo pequeño", mg: 63, serving: "30 ml" },
  { key: "te_negro", name: "Té negro", mg: 47, serving: "1 taza (240 ml)" },
  { key: "te_verde", name: "Té verde", mg: 28, serving: "1 taza (240 ml)" },
  { key: "cola", name: "Gaseosa cola", mg: 34, serving: "1 lata (355 ml)" },
  { key: "cola_zero", name: "Gaseosa cola sin azúcar", mg: 38, serving: "1 lata (355 ml)" },
  { key: "chocolate", name: "Chocolate oscuro", mg: 20, serving: "30 g" },
  { key: "descafeinado", name: "Café descafeinado", mg: 3, serving: "1 taza (240 ml)" },
];

export function caffeineTotal(entries: { key: string; qty: number }[]): number {
  return entries.reduce((a, e) => a + (CAFFEINE_ITEMS.find((i) => i.key === e.key)?.mg ?? 0) * e.qty, 0);
}

export type CaffeineStatus = "ok" | "near" | "over";
export function caffeineStatus(mg: number): CaffeineStatus {
  if (mg > CAFFEINE_MAX_MG) return "over";
  if (mg >= CAFFEINE_MAX_MG * 0.8) return "near";
  return "ok";
}

export interface PregnancyLineView {
  line: RecipeLine;
  /** alimento original si fue sustituido */
  replacedFrom?: string;
  note?: string;
  level?: "avoid" | "limit" | "cook";
}

export interface PregnancyView {
  lines: PregnancyLineView[];
  notes: string[];
  /** familias con tope semanal que esta receta consume */
  limited: { family: string; weeklyMax: number }[];
  caffeineMg: number;
  hasSubstitution: boolean;
  needsAttention: boolean;
}

/** Aplica las reglas de seguridad del embarazo a una receta (sustituye lo no apto y agrega notas). */
export function pregnancyView(recipe: Pick<Recipe, "lines" | "pregNote" | "caffeineMg" | "family">): PregnancyView {
  const lines: PregnancyLineView[] = [];
  const notes = new Set<string>();
  const limited: { family: string; weeklyMax: number }[] = [];
  let hasSub = false;
  for (const l of recipe.lines) {
    const food = FOODS[l.food];
    const rule = food.preg;
    if (rule?.level === "avoid" && rule.sub) {
      lines.push({ line: { ...l, food: rule.sub }, replacedFrom: l.food, note: rule.note, level: "avoid" });
      notes.add(rule.note);
      hasSub = true;
    } else if (rule) {
      lines.push({ line: l, note: rule.note, level: rule.level });
      notes.add(rule.note);
      if (rule.level === "limit" && rule.weeklyMax) limited.push({ family: food.key, weeklyMax: rule.weeklyMax });
    } else {
      lines.push({ line: l });
    }
  }
  if (recipe.pregNote) notes.add(recipe.pregNote);
  notes.add("Lava muy bien las frutas y verduras antes de consumirlas.");
  const caffeineMg = recipe.caffeineMg ?? 0;
  if (caffeineMg > 0) notes.add(`Contiene cafeína (${caffeineMg} mg): cuéntala dentro del tope de ${CAFFEINE_MAX_MG} mg al día, o usa descafeinado.`);
  return { lines, notes: [...notes], limited, caffeineMg, hasSubstitution: hasSub, needsAttention: hasSub || limited.length > 0 };
}

/** Topes semanales por alimento de riesgo (mercurio). */
export const PREGNANCY_WEEKLY_CAPS: Record<string, number> = { atun: 2, robalo: 1 };

/** Cuenta cuántas veces aparece cada alimento limitado en una lista de recetas. */
export function weeklyLimitedCounts(recipes: Pick<Recipe, "lines">[]): Record<string, number> {
  const c: Record<string, number> = {};
  for (const r of recipes) {
    const seen = new Set<string>();
    for (const l of r.lines) if (PREGNANCY_WEEKLY_CAPS[l.food] && !seen.has(l.food)) { seen.add(l.food); c[l.food] = (c[l.food] ?? 0) + 1; }
  }
  return c;
}

export const FOOD_SAFETY_RULES: string[] = [
  "Nada crudo ni poco cocido: carnes, pescados, huevos, ceviches ni sushi.",
  "Solo lácteos y quesos pasteurizados (cuidado con el queso costeño artesanal).",
  "Pescados bajos en mercurio. Evita sierra, pez espada y atún de aleta grande; el atún en lata, máximo 1–2 porciones por semana.",
  "Embutidos solo si están bien calentados (hasta que humeen).",
  "Cafeína máxima de 200 mg al día (café, gaseosas y té).",
  "Lava bien frutas y verduras.",
  "Alcohol: cero.",
];
