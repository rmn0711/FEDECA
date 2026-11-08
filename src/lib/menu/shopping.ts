// Lista de mercado semanal (suma de las porciones de ambos perfiles) y sugerencias de meal prep.
import { FOODS } from "@/data/foods";
import { RECIPE_BY_SLUG } from "@/data/recipes";
import { num } from "../format";
import { pregnancyView } from "../nutrition/safety";
import type { DayTargets } from "../nutrition/targets";
import { scaleRecipe } from "./core";
import { AISLE_ORDER, type Aisle, type RecipeLine } from "./types";

export interface PersonWeek {
  /** plan de la semana por fecha */
  plan: Record<string, string[]>;
  /** objetivos por fecha */
  targets: Record<string, DayTargets>;
  pregnant: boolean;
}

export interface ShoppingItem {
  food: string;
  name: string;
  rawG: number;
  label: string;
  aisle: Aisle;
}

export function portionLines(slug: string, t: DayTargets, slot: number, pregnant: boolean): (RecipeLine & { rawG: number })[] {
  const recipe = RECIPE_BY_SLUG[slug];
  const portion = scaleRecipe(recipe, { proteinG: t.proteinSlots[slot], kcal: t.kcalSlots[slot] });
  if (!pregnant) return portion.lines;
  const view = pregnancyView({ ...recipe, lines: portion.lines });
  return view.lines.map((v) => {
    const food = FOODS[v.line.food];
    const g = v.line.g;
    return { ...v.line, rawG: food.rawYield ? Math.round(g / food.rawYield) : g };
  });
}

function labelFor(foodKey: string, rawG: number): string {
  const f = FOODS[foodKey];
  if (f.unit) {
    const n = Math.ceil(rawG / f.unit.rawG);
    return `${num(n)} ${n === 1 ? f.unit.singular : f.unit.plural} (≈ ${num(Math.round(rawG))} g)`;
  }
  if (foodKey === "atun" || foodKey === "sardina") {
    const n = Math.ceil(rawG / f.measure!.g);
    return `${num(n)} ${n === 1 ? "lata" : "latas"} (≈ ${num(Math.round(rawG))} g escurrido)`;
  }
  if (foodKey === "whey" || foodKey === "caseina") return `${num(Math.round(rawG))} g (≈ ${num(Math.round(rawG / f.measure!.g))} scoops)`;
  if (rawG >= 1000) return `${num(rawG / 1000, 2)} kg`;
  return `${num(Math.round(rawG / 10) * 10)} g`;
}

export function buildShoppingList(people: PersonWeek[], opts: { pantryStaples?: boolean } = {}): Record<Aisle, ShoppingItem[]> {
  const totals: Record<string, number> = {};
  for (const person of people) {
    for (const [date, slugs] of Object.entries(person.plan)) {
      const t = person.targets[date];
      slugs.forEach((slug, slot) => {
        for (const l of portionLines(slug, t, slot, person.pregnant)) totals[l.food] = (totals[l.food] ?? 0) + l.rawG;
      });
    }
  }
  const grouped = Object.fromEntries(AISLE_ORDER.map((a) => [a, [] as ShoppingItem[]])) as Record<Aisle, ShoppingItem[]>;
  for (const [food, rawG] of Object.entries(totals)) {
    if (food === "especias" && !opts.pantryStaples) {
      grouped["Despensa"].push({ food, name: "Ajo, comino, cilantro, tomillo, orégano y sal", rawG: 0, label: "revisa la despensa", aisle: "Despensa" });
      continue;
    }
    const f = FOODS[food];
    grouped[f.aisle].push({ food, name: f.name, rawG, label: labelFor(food, rawG), aisle: f.aisle });
  }
  for (const a of AISLE_ORDER) grouped[a].sort((x, y) => x.name.localeCompare(y.name, "es"));
  return grouped;
}

/* ───────────── Meal prep del domingo ───────────── */

export interface PrepTip {
  title: string;
  detail: string;
}

export function mealPrepTips(people: PersonWeek[], week: string[]): PrepTip[] {
  // proteínas cocidas por tipo para lunes–miércoles (el pescado se prepara fresco)
  const raw: Record<string, number> = {};
  const fishRaw: Record<string, number> = {};
  const carbs: Record<string, number> = {};
  const legumes: Record<string, number> = {};
  const vegs: Record<string, number> = {};
  week.forEach((date, di) => {
    for (const person of people) {
      const slugs = person.plan[date];
      if (!slugs) continue;
      slugs.forEach((slug, slot) => {
        for (const l of portionLines(slug, person.targets[date], slot, person.pregnant)) {
          const f = FOODS[l.food];
          if (l.role === "protein" && f.aisle === "Carnes y aves" && di <= 4) raw[l.food] = (raw[l.food] ?? 0) + l.rawG;
          else if (l.role === "protein" && f.aisle === "Pescados y mariscos") fishRaw[l.food] = (fishRaw[l.food] ?? 0) + l.rawG;
          else if (["arroz", "arroz_int", "quinua"].includes(l.food)) carbs[l.food] = (carbs[l.food] ?? 0) + l.rawG;
          else if (["lentejas", "frijoles", "garbanzo"].includes(l.food)) legumes[l.food] = (legumes[l.food] ?? 0) + l.rawG;
          else if (f.aisle === "Verduras" && l.food !== "aguacate" && l.food !== "lechuga") vegs[l.food] = (vegs[l.food] ?? 0) + l.rawG;
        }
      });
    }
  });
  const list = (m: Record<string, number>) =>
    Object.entries(m)
      .filter(([, g]) => g > 50)
      .sort((a, b) => b[1] - a[1])
      .map(([k, g]) => `${FOODS[k].name} ${num(Math.round(g / 10) * 10)} g`)
      .join(", ");
  const tips: PrepTip[] = [];
  const meats = list(raw);
  if (meats) tips.push({ title: "Cocina las carnes del lunes al viernes", detail: `Cuece, desmecha o ase (peso crudo): ${meats}. Guárdalas en porciones en la nevera por máximo 3–4 días; congela lo del jueves en adelante.` });
  const fish = list(fishRaw);
  if (fish) tips.push({ title: "Pescados y mariscos: prepáralos frescos", detail: `Compra ${fish} y congela por porciones; descongela en la nevera la noche anterior. Cocina siempre completo (más aún en el embarazo).` });
  const c = list(carbs);
  if (c) tips.push({ title: "Arroz y quinua", detail: `Cocina de una vez (peso crudo): ${c}. Enfría rápido, refrigera en recipientes planos y consume en 4 días; recalienta hasta que humee.` });
  const lg = list(legumes);
  if (lg) tips.push({ title: "Legumbres", detail: `Remoja y cuece en tanda (peso seco): ${lg}. Se congelan muy bien en porciones.` });
  const v = list(vegs);
  if (v) tips.push({ title: "Verduras lavadas y cortadas", detail: `Lava con cuidado, desinfecta y corta: ${v}. Guarda en recipientes con papel absorbente.` });
  tips.push({ title: "Huevos duros y claras", detail: "Cuece una docena de huevos (10 minutos, yema firme) para desayunos y meriendas de la semana." });
  tips.push({ title: "Rotula con fecha", detail: "Escribe el día de preparación en cada recipiente. Lo que no vayas a comer en 3–4 días, al congelador." });
  return tips;
}
