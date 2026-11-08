// Utilidades puras de recetas: macros, porciones, descripciones y filtros.
import { FOODS } from "@/data/foods";
import { num } from "../format";
import type { Macros, Recipe, RecipeDef, RecipeLine, Role } from "./types";

export const zero = (): Macros => ({ kcal: 0, p: 0, c: 0, f: 0, fiber: 0 });

export function lineMacros(line: RecipeLine, factor = 1): Macros {
  const food = FOODS[line.food];
  if (!food) throw new Error(`Alimento desconocido: ${line.food}`);
  const k = (line.g * factor) / 100;
  const b = food.per100;
  return { kcal: b.kcal * k, p: b.p * k, c: b.c * k, f: b.f * k, fiber: b.fiber * k };
}

export function sumMacros(lines: RecipeLine[], factors?: Partial<Record<Role, number>>): Macros {
  const out = zero();
  for (const l of lines) {
    const m = lineMacros(l, factors?.[l.role] ?? 1);
    out.kcal += m.kcal;
    out.p += m.p;
    out.c += m.c;
    out.f += m.f;
    out.fiber += m.fiber;
  }
  return out;
}

/** Une líneas repetidas del mismo alimento (suma gramos y conserva el primer rol). */
export function mergeLines(lines: RecipeLine[]): RecipeLine[] {
  const out: RecipeLine[] = [];
  for (const l of lines) {
    const prev = out.find((o) => o.food === l.food);
    if (prev) prev.g += l.g;
    else out.push({ ...l });
  }
  return out;
}

export function buildRecipe(def: RecipeDef): Recipe {
  const lines = mergeLines(def.lines);
  return { ...def, lines, macros: sumMacros(lines) };
}

/* ───────────── Porciones por perfil ───────────── */

export interface PortionTarget {
  proteinG: number;
  kcal: number;
}

export interface Portion {
  factors: Record<Role, number>;
  lines: (RecipeLine & { rawG: number })[];
  macros: Macros;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Escala una receta para llegar a la proteína objetivo (prioridad máxima) y acercarse a las kcal objetivo
 * moviendo primero los carbohidratos y luego las grasas. Verduras y fijos no se tocan.
 */
export function scaleRecipe(recipe: Recipe, target: PortionTarget, opts: { maxFactor?: number } = {}): Portion {
  const lines = recipe.lines;
  const pProtein = sumMacros(lines.filter((l) => l.role === "protein")).p;
  const pOther = sumMacros(lines.filter((l) => l.role !== "protein")).p;
  const maxF = opts.maxFactor ?? 3;
  const kp = pProtein > 0 ? clamp((target.proteinG - pOther) / pProtein, 0.4, maxF) : 1;
  const factors: Record<Role, number> = { protein: kp, carb: 1, fat: 1, veg: 1, fixed: 1 };

  const kcalNow = () => sumMacros(lines, factors).kcal;
  const group = (role: Role) => sumMacros(lines.filter((l) => l.role === role)).kcal;
  /** Reajusta la proteína tras mover carbohidratos/grasas (aportan algo de proteína). */
  const resolveProtein = () => {
    if (pProtein <= 0) return;
    const other = sumMacros(lines.filter((l) => l.role !== "protein"), factors).p;
    factors.protein = clamp((target.proteinG - other) / pProtein, 0.4, maxF);
  };

  let diff = target.kcal - kcalNow();
  const carbBase = group("carb");
  if (carbBase > 0 && Math.abs(diff) > 5) {
    factors.carb = clamp((carbBase + diff) / carbBase, 0.4, 3);
    diff = target.kcal - kcalNow();
  }
  const fatBase = group("fat");
  if (fatBase > 0 && Math.abs(diff) > 5) {
    factors.fat = clamp((fatBase + diff) / fatBase, 0.5, 2);
  }
  resolveProtein();

  const scaled = lines.map((l) => {
    const f = factors[l.role];
    const g = Math.round(l.g * f);
    const food = FOODS[l.food];
    const rawG = food.rawYield ? Math.round(g / food.rawYield) : g;
    return { ...l, g, rawG };
  });
  const macros = sumMacros(scaled, undefined);
  return { factors, lines: scaled, macros };
}

/* ───────────── Descripciones ───────────── */

/** "1/2", "1 1/2", "2" para cantidades de medidas caseras (cuartos). */
function quarters(n: number): string {
  const q = Math.round(n * 4) / 4;
  const whole = Math.floor(q);
  const frac = q - whole;
  const fr = frac === 0.25 ? "1/4" : frac === 0.5 ? "1/2" : frac === 0.75 ? "3/4" : "";
  if (whole === 0 && fr) return fr;
  return fr ? `${whole} ${fr}` : String(whole);
}

export function homeMeasure(foodKey: string, grams: number): string | null {
  const food = FOODS[foodKey];
  if (!food?.measure || food.key === "especias") return null;
  const n = grams / food.measure.g;
  if (n < 0.2) return null;
  const q = Math.round(n * 4) / 4;
  const label = q > 1 ? (food.measure.plural ?? food.measure.label) : food.measure.label;
  const text = quarters(n);
  return `${text} ${/^(1\/4|1\/2|3\/4)$/.test(text) ? "de " : ""}${label}`;
}

export interface LineView {
  food: string;
  name: string;
  cookedG: number;
  rawG: number | null;
  home: string | null;
  label?: string;
  role: Role;
}

export function lineViews(lines: RecipeLine[]): LineView[] {
  return lines.map((l) => {
    const food = FOODS[l.food];
    const rawG = food.rawYield ? Math.round(l.g / food.rawYield) : null;
    return { food: l.food, name: food.name, cookedG: l.g, rawG, home: homeMeasure(l.food, l.g), label: l.label, role: l.role };
  });
}

/** Texto corto de un ingrediente: "120 g de pechuga de pollo" / "3 claras" / "1,5 scoop de proteína whey". */
export function describeLine(line: RecipeLine): string {
  const food = FOODS[line.food];
  if (food.unit && (food.key === "huevo" || food.key === "clara")) {
    const n = Math.max(1, Math.round(line.g / food.measure!.g));
    return `${n} ${n === 1 ? food.unit.singular : food.unit.plural}`;
  }
  if (food.key === "whey" || food.key === "caseina") {
    const sc = Math.round((line.g / food.measure!.g) * 2) / 2;
    return `${num(sc, sc % 1 ? 1 : 0)} scoop de ${food.name.replace(" en polvo", "")}`;
  }
  return `${num(line.g)} g de ${food.name}`;
}

/** Título de merienda: "120 g de pechuga de pollo = 36 g de proteína". */
export function snackTitle(lines: RecipeLine[]): string {
  const p = sumMacros(lines).p;
  return `${lines.map(describeLine).join(" + ")} = ${num(Math.round(p))} g de proteína`;
}

/** Texto completo (nombre, ingredientes y pasos) para validar exclusiones. */
export function recipeText(r: RecipeDef): string {
  const names = r.lines.map((l) => FOODS[l.food].name + " " + (l.label ?? ""));
  return [r.name, ...names, ...r.steps, ...r.tags, r.pregNote ?? ""].join(" \n ");
}
