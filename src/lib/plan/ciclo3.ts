// Plan del nutricionista (referencia de un amigo con el mismo perfil): ciclo de 3 días que se repite cada semana.
//   Día 1: carbohidrato en desayuno, media mañana y almuerzo. Sin frutas, aceites, frutos secos ni aguacate.
//   Día 2: carbohidrato solo en el desayuno. Con frutas permitidas, aceite de oliva, almendras y aguacate.
//   Día 3: sin carbohidratos. Con frutas permitidas, aceite de oliva, almendras y aguacate.
// Proteína por toma: 3 huevos (1 entero + 2 claras) · 120 g · 180 g · 120 g · 180 g · 120 g o batido.
// Vegetales al gusto todos los días, menos remolacha y zanahoria.
import { FOODS } from "@/data/foods";
import { RECIPE_BY_SLUG } from "@/data/recipes";
import { legDaysOf } from "../exercise/plan";
import { daysBetween, weekday } from "../format";
import { buildRecipe, sumMacros } from "../menu/core";
import type { Recipe, RecipeLine } from "../menu/types";
import { NO_PREFS, type FoodPrefs } from "../prefs";
import type { Profile, RecipeKind } from "../types";

export type DayType = 1 | 2 | 3;
export type Weigh = "cocido" | "crudo";
export const PLAN_FLOOR_KCAL = 1800;
const EPOCH = "2026-01-05";

/* ───────────── Reglas por tipo de día ───────────── */

export interface DayRule {
  type: DayType;
  name: string;
  short: string;
  carbSlots: number[];
  extras: boolean;
  drinks: string;
  allowed: string[];
  forbidden: string[];
}

export const DAY_RULES: Record<DayType, DayRule> = {
  1: {
    type: 1,
    name: "Día 1 · carga de carbohidratos",
    short: "Carbo en desayuno, media mañana y almuerzo",
    carbSlots: [0, 1, 2],
    extras: false,
    drinks: "Tinto, té de hierbas o agua, sin azúcar.",
    allowed: ["100 g de carbohidrato en desayuno, media mañana y almuerzo", "Proteína magra en todas las tomas", "Vegetales al gusto"],
    forbidden: ["Frutas", "Aceites de ningún tipo", "Frutos secos", "Aguacate", "Proteínas con grasa"],
  },
  2: {
    type: 2,
    name: "Día 2 · carbo solo al desayuno",
    short: "Carbo solo en el desayuno · con fruta y grasas buenas",
    carbSlots: [0],
    extras: true,
    drinks: "Tinto, té de hierbas, agua o jugo de fruta permitida sin azúcar (o con stevia).",
    allowed: ["100 g de carbohidrato solo en el desayuno", "Frutas permitidas", "Aceite de oliva", "Almendras (único fruto seco)", "Aguacate", "Vegetales al gusto"],
    forbidden: ["Carbohidrato después del desayuno", "Otros frutos secos", "Proteínas con grasa"],
  },
  3: {
    type: 3,
    name: "Día 3 · sin carbohidratos",
    short: "Sin carbohidratos · con fruta y grasas buenas",
    carbSlots: [],
    extras: true,
    drinks: "Tinto, té de hierbas, agua o jugo de fruta permitida sin azúcar (o con stevia).",
    allowed: ["Frutas permitidas", "Aceite de oliva", "Almendras (único fruto seco)", "Aguacate", "Vegetales al gusto"],
    forbidden: ["Carbohidratos en todo el día", "Otros frutos secos", "Proteínas con grasa"],
  },
};

/** Listas permitidas por el plan (claves de la base de alimentos). */
export const PLAN_CARBS = ["arroz", "yuca", "platano_hervido", "guineo", "papa", "ahuyama", "name", "lentejas", "zaragoza", "garbanzo", "pasta_arroz", "avena_cocida"];
// Rotación automática con los carbohidratos que más rinden; guineo verde y ahuyama siguen permitidos (aparecen al
// cambiar de plato) pero casi no aportan energía, así que no entran solos en la rotación.
const BREAKFAST_CARBS = ["yuca", "platano_hervido", "avena_cocida", "papa", "name"];
const LUNCH_CARBS = ["arroz", "yuca", "platano_hervido", "papa", "name", "lentejas", "zaragoza", "garbanzo", "pasta_arroz"];
const SWAP_EXTRA_CARBS = ["guineo", "ahuyama"];
/** Complemento máximo de proteína por comida para respetar el mínimo de kcal sin disparar la proteína. */
export const MAX_COMPLEMENT_G = 60;
export const PLAN_PROTEINS = ["pechuga", "res", "cerdo", "pavo", "mojarra", "robalo"];
export const PLAN_FRUITS: [string, number][] = [["pina", 150], ["kiwi", 150], ["maracuya", 36], ["mango_verde", 150], ["manzana_verde", 180], ["pera_verde", 170], ["guayaba", 120], ["pomelo", 240]];
export const PLAN_FORBIDDEN_VEG = ["zanahoria", "remolacha"];

export interface VegCombo {
  name: string;
  lines: [string, number][];
}
export const PLAN_VEG: VegCombo[] = [
  { name: "habichuela y pimentón", lines: [["habichuela", 100], ["pimenton", 50]] },
  { name: "espinaca con champiñones", lines: [["espinaca", 80], ["champi", 80]] },
  { name: "ensalada de lechuga y repollo", lines: [["lechuga", 60], ["repollo", 80]] },
  { name: "calabacín con cebolla", lines: [["calabacin", 150], ["cebolla", 30]] },
  { name: "berenjena asada", lines: [["berenjena", 150]] },
  { name: "repollo salteado con pimentón", lines: [["repollo", 100], ["pimenton", 50]] },
  { name: "ensalada verde con pimentón", lines: [["lechuga", 80], ["pimenton", 50], ["cebolla", 20]] },
];

/** Gramos de proteína del plan por toma (3 huevos en el desayuno). */
export const PLAN_PROTEIN_G = [100, 120, 180, 120, 180, 120];
const KIND: RecipeKind[] = ["breakfast", "snack", "lunch", "snack", "dinner", "postdinner"];
export const CARB_G = 100;

/* ───────────── Semana: qué tipo de día es cada día ───────────── */

/**
 * El día 1 (carga de carbohidratos) cae en los días de pierna; después sigue 2 y 3.
 * Con pierna lunes y jueves: lun 1, mar 2, mié 3, jue 1, vie 2, sáb 3, dom 2. Se repite igual cada semana.
 */
export function weekDayTypes(trainingDays: number[]): Record<number, DayType> {
  let legs = legDaysOf(trainingDays);
  if (!legs.length) legs = [1, 4];
  const order = [1, 2, 3, 4, 5, 6, 0];
  const out: Record<number, DayType> = {};
  let prev: DayType = 3;
  for (let pass = 0; pass < 2; pass++) {
    for (const d of order) {
      const t: DayType = legs.includes(d) ? 1 : prev === 1 ? 2 : prev === 2 ? 3 : 2;
      out[d] = t;
      prev = t;
    }
  }
  return out;
}

export const dayTypeFor = (p: Pick<Profile, "training_days">, date: string): DayType => weekDayTypes(p.training_days)[weekday(date)];

export const usesPlan = (p: Pick<Profile, "mode"> & { diet_plan?: string | null }) => p.mode === "fat_loss" && (p.diet_plan ?? "ciclo3") === "ciclo3";

/* ───────────── Especificación compacta de una toma ───────────── */

export interface PlanSpec {
  d: DayType;
  s: number;
  /** eggs = 1 huevo + 2 claras · prot = proteína magra · claras = 5 claras · shake = batido */
  k: "eggs" | "prot" | "claras" | "shake";
  p?: string;
  g?: number;
  /** gramos extra de proteína para no bajar del mínimo */
  cg?: number;
  c?: string | null;
  v?: number;
  f?: [string, number] | null;
  x?: [string, number][];
  w?: Weigh;
}

const b64 = (s: string) => (typeof btoa === "function" ? btoa(s) : Buffer.from(s, "binary").toString("base64")).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64 = (s: string) => {
  const t = s.replace(/-/g, "+").replace(/_/g, "/");
  return typeof atob === "function" ? atob(t) : Buffer.from(t, "base64").toString("binary");
};
export const encodeSpec = (spec: PlanSpec) => `plan-${b64(JSON.stringify(spec))}`;
export function decodeSpec(slug: string): PlanSpec | null {
  if (!slug.startsWith("plan-")) return null;
  try {
    return JSON.parse(unb64(slug.slice(5))) as PlanSpec;
  } catch {
    return null;
  }
}

const fname = (k: string) => FOODS[k].name;
const FISH = new Set(["mojarra", "robalo"]);
const ART: Record<string, string> = { pechuga: "pollo", pavo: "pollo", res: "res", cerdo: "cerdo", mojarra: "pescado", robalo: "pescado" };

/** Gramos cocidos que corresponden a los gramos del plan (si se pesa en crudo, se convierte). */
const cookedFromPlan = (food: string, g: number, w: Weigh) => (w === "crudo" && FOODS[food].rawYield ? Math.round(g * FOODS[food].rawYield!) : g);

function carbStep(c: string): string {
  if (c === "arroz") return "Cocina el arroz sin aceite: solo agua, sal y ajo, tapado a fuego bajo 18 minutos.";
  if (c === "avena_cocida") return "Cocina la avena en agua con canela, sin azúcar (puedes endulzar con stevia).";
  if (c === "pasta_arroz") return "Cocina la pasta de arroz en agua hirviendo con sal según el empaque y escúrrela.";
  if (c === "ahuyama") return "Cocina la ahuyama al vapor o hervida hasta que esté blanda.";
  if (["lentejas", "zaragoza", "garbanzo"].includes(c)) return `Cocina ${fname(c).replace(" cocido", "")} sin aceite ni grasa, solo con cebolla, ajo, comino y sal.`;
  return `Hierve ${fname(c).replace(" cocida", "").replace(" cocido", "")} en agua con sal hasta que esté blando.`;
}

export function recipeFromSpec(spec: PlanSpec, slug = encodeSpec(spec)): Recipe {
  const w = spec.w ?? "cocido";
  const oil = DAY_RULES[spec.d].extras;
  const lines: RecipeLine[] = [];
  const steps: string[] = [];
  let title = "";
  let family = "pollo";
  let art = "pollo";
  let timeMin = 10;

  if (spec.k === "eggs") {
    lines.push({ food: "huevo", g: 50, role: "protein", label: "1 entero" }, { food: "clara", g: 66, role: "protein", label: "2 claras" });
    title = "3 huevos (1 entero y 2 claras)";
    steps.push(`Bate 1 huevo entero con 2 claras y cocínalos revueltos o en tortilla en sartén antiadherente ${oil ? "con unas gotas de aceite de oliva" : "sin aceite"}, hasta que estén firmes.`);
    family = "huevo";
    art = "huevo";
  } else if (spec.k === "claras") {
    lines.push({ food: "clara", g: 165, role: "protein", label: "5 claras" });
    title = "5 claras de huevo";
    steps.push(`Cocina 5 claras revueltas o en tortilla en sartén antiadherente ${oil ? "con unas gotas de aceite de oliva" : "sin aceite"}.`);
    family = "huevo";
    art = "huevo";
  } else if (spec.k === "shake") {
    lines.push({ food: "whey", g: 30, role: "protein", label: "1 scoop en agua" });
    title = "Batido de proteína (1 scoop en agua)";
    steps.push("Mezcla 1 scoop de proteína con 250–300 ml de agua fría en el shaker.");
    family = "whey";
    art = "batido";
    timeMin = 2;
  } else {
    const p = spec.p ?? "pechuga";
    const planG = (spec.g ?? 120) + (spec.cg ?? 0);
    lines.push({ food: p, g: cookedFromPlan(p, planG, w), role: "protein", label: w === "crudo" ? `${planG} g pesados en crudo` : undefined });
    title = `${spec.g ?? 120} g de ${fname(p)}${spec.cg ? ` (+${spec.cg} g de complemento)` : ""}`;
    steps.push(
      FISH.has(p)
        ? `Filete de ${fname(p)} sazonado con ajo y sal ${oil ? "(el limón 20 minutos antes)" : "y limón"}; a la plancha ${oil ? "con 1 cucharadita de aceite de oliva" : "sin aceite"} o al horno, 4–5 minutos por lado, hasta que se desmenuce.`
        : `Sazona ${fname(p)} con ajo, sal, pimienta y limón (puedes adobarla desde la noche). Cocínala a la plancha ${oil ? "con 1 cucharadita de aceite de oliva" : "sin aceite, con un chorrito de agua"} hasta que esté bien cocida.`,
    );
    family = p === "pechuga" ? "pollo" : p;
    art = ART[p] ?? "pollo";
    timeMin = 20;
  }

  if (spec.c) {
    lines.push({ food: spec.c, g: CARB_G, role: "carb" });
    title += ` con ${CARB_G} g de ${fname(spec.c)}`;
    steps.push(carbStep(spec.c));
    timeMin = Math.max(timeMin, spec.c === "arroz" || spec.c === "yuca" || spec.c === "name" ? 25 : ["lentejas", "zaragoza", "garbanzo"].includes(spec.c) ? 35 : 15);
  }
  if (spec.v !== undefined && spec.k !== "shake") {
    const veg = PLAN_VEG[spec.v % PLAN_VEG.length];
    for (const [food, g] of veg.lines) lines.push({ food, g, role: "veg" });
    title += `${spec.c ? " y" : " con"} ${veg.name}`;
    steps.push(oil ? `Verduras al gusto (${veg.name}): crudas en ensalada o salteadas con 1 cucharadita de aceite de oliva.` : `Verduras al gusto (${veg.name}): al vapor o salteadas con un poco de agua o caldo, sin aceite.`);
  }
  if (spec.f) {
    title += ` + ${fname(spec.f[0]).replace("pulpa de ", "")}`;
    lines.push({ food: spec.f[0], g: spec.f[1], role: "fixed", label: "fruta permitida" });
    steps.push(`Fruta permitida: ${fname(spec.f[0])} (entera o en jugo sin azúcar, con stevia si quieres).`);
  }
  for (const [food, g] of spec.x ?? []) {
    lines.push({ food, g, role: "fat" });
    steps.push(food === "almendras" ? `${g} g de almendras (unas ${Math.round(g / 1.2)}).` : food === "aguacate" ? `${g} g de aguacate.` : `${g} g de aceite de oliva para las verduras.`);
  }
  if (spec.cg) steps.push(`Incluye ${spec.cg} g más de proteína magra para no bajar del mínimo seguro de ${PLAN_FLOOR_KCAL.toLocaleString("es-CO")} kcal del día.`);
  steps.push(`Para tomar: ${DAY_RULES[spec.d].drinks.charAt(0).toLowerCase()}${DAY_RULES[spec.d].drinks.slice(1)}`);

  const kind = KIND[spec.s];
  const name = title.charAt(0).toUpperCase() + title.slice(1);
  const r = buildRecipe({ slug, name, kind, lines, timeMin, steps, tags: ["plan del nutricionista", `día ${spec.d}`], art, family, dish: kind === "snack" ? name : undefined });
  return { ...r, slug };
}

export const planRecipeFromSlug = (slug: string): Recipe | undefined => {
  const spec = decodeSpec(slug);
  return spec ? recipeFromSpec(spec, slug) : undefined;
};

/** Busca cualquier receta: catálogo o toma del plan. */
export const getRecipe = (slug: string): Recipe | undefined => RECIPE_BY_SLUG[slug] ?? planRecipeFromSlug(slug);

/* ───────────── Armar el día ───────────── */

const allowed = <T>(list: T[], key: (t: T) => string, prefs: FoodPrefs): T[] => {
  const ok = list.filter((x) => !prefs.dislikes.has(key(x)));
  const liked = ok.filter((x) => prefs.likes.has(key(x)));
  const rest = ok.filter((x) => !prefs.likes.has(key(x)));
  const res = [...liked, ...rest];
  return res.length ? res : list;
};

export interface PlanDay {
  type: DayType;
  specs: PlanSpec[];
  recipes: Recipe[];
  kcal: number;
  protein: number;
  floorApplied: number;
  /** kcal que aún faltan para el mínimo (si el complemento no alcanzó). */
  belowFloor: number;
}

/**
 * Las 6 tomas del día. Si el almuerzo o la cena de la casa usan una proteína permitida (pechuga, res, cerdo, pavo,
 * pescado blanco), se usa la misma para cocinar una sola vez.
 */
export function planDay(input: { profile: Pick<Profile, "training_days"> & { plan_weigh?: Weigh | null }; date: string; prefs?: FoodPrefs; overrides?: Record<string, string>; sharedSlugs?: string[] }): PlanDay {
  const { profile, date, prefs = NO_PREFS, overrides = {}, sharedSlugs = [] } = input;
  const w: Weigh = profile.plan_weigh ?? "cocido";
  const d = dayTypeFor(profile, date);
  const rule = DAY_RULES[d];
  const n = daysBetween(EPOCH, date);
  const mod = (i: number, len: number) => ((i % len) + len) % len;

  const proteins = allowed(PLAN_PROTEINS, (x) => x, prefs);
  const bCarbs = allowed(BREAKFAST_CARBS, (x) => x, prefs);
  const lCarbs = allowed(LUNCH_CARBS, (x) => x, prefs);
  const fruits = allowed(PLAN_FRUITS, (x) => x[0], prefs);
  const vegIdx = PLAN_VEG.map((_, i) => i).filter((i) => PLAN_VEG[i].lines.every(([f]) => !prefs.dislikes.has(f)));
  const veg = (k: number) => (vegIdx.length ? vegIdx[mod(k, vegIdx.length)] : mod(k, PLAN_VEG.length));
  const eggsOk = !prefs.dislikes.has("huevo") && !prefs.dislikes.has("clara");
  const shakeOk = !prefs.dislikes.has("whey");

  const shared = (slot: number) => {
    const r = sharedSlugs[slot] ? RECIPE_BY_SLUG[sharedSlugs[slot]] : undefined;
    const main = r?.lines.find((l) => l.role === "protein")?.food;
    return main && proteins.includes(main) ? main : null;
  };
  const lunchP = shared(2) ?? proteins[mod(n * 2, proteins.length)];
  let dinnerP = shared(4) ?? proteins[mod(n * 2 + 3, proteins.length)];
  if (dinnerP === lunchP && proteins.length > 1 && !shared(4)) dinnerP = proteins[mod(proteins.indexOf(lunchP) + 1, proteins.length)];
  const snackP = (k: number) => {
    const pool = proteins.filter((p) => p !== lunchP && p !== dinnerP);
    const list = pool.length ? pool : proteins;
    return list[mod(n + k, list.length)];
  };
  const carb = (slot: number) => (rule.carbSlots.includes(slot) ? (slot === 2 ? lCarbs[mod(n, lCarbs.length)] : bCarbs[mod(n + (slot === 1 ? 3 : 0), bCarbs.length)]) : null);
  const evenDay = mod(n, 2) === 0;

  const specs: PlanSpec[] = [
    eggsOk ? { d, s: 0, k: "eggs", c: carb(0), v: veg(n), w } : { d, s: 0, k: "prot", p: snackP(5), g: 100, c: carb(0), v: veg(n), w },
    evenDay || !eggsOk ? { d, s: 1, k: "prot", p: snackP(0), g: 120, c: carb(1), v: veg(n + 2), w } : { d, s: 1, k: "claras", c: carb(1), v: veg(n + 2), w },
    { d, s: 2, k: "prot", p: lunchP, g: 180, c: carb(2), v: veg(n + 4), w },
    !evenDay || !eggsOk ? { d, s: 3, k: "prot", p: snackP(1), g: 120, c: null, v: veg(n + 1), w } : { d, s: 3, k: "claras", c: null, v: veg(n + 1), w },
    { d, s: 4, k: "prot", p: dinnerP, g: 180, c: null, v: veg(n + 3), w },
    shakeOk ? { d, s: 5, k: "shake", w } : eggsOk ? { d, s: 5, k: "claras", c: null, v: veg(n + 5), w } : { d, s: 5, k: "prot", p: snackP(2), g: 120, c: null, v: veg(n + 5), w },
  ];
  if (rule.extras) {
    if (fruits.length) specs[0].f = fruits[mod(n, fruits.length)];
    if (!prefs.dislikes.has("aguacate")) specs[2].x = [["aguacate", 50]];
    if (!prefs.dislikes.has("almendras")) specs[3].x = [["almendras", 15]];
    if (specs[4].v !== undefined) specs[4].x = [["aceite", 5]];
  }

  // Cambios de plato de Jose (se guardan en las tomas 10–15 para no tocar el menú de la casa).
  specs.forEach((sp, i) => {
    const o = overrides[`${date}:${10 + i}`];
    const dec = o ? decodeSpec(o) : null;
    if (dec) specs[i] = { ...dec, d, s: i, w };
  });

  // Piso de seguridad: nunca menos de 1.800 kcal.
  const total = () => specs.reduce((a, sp) => a + recipeFromSpec(sp).macros.kcal, 0);
  let deficit = PLAN_FLOOR_KCAL - total();
  let floorApplied = 0;
  if (deficit > 0 && rule.extras) {
    const add = (slot: number, food: string, max: number) => {
      if (deficit <= 0 || prefs.dislikes.has(food)) return;
      const cur = specs[slot].x?.find((e) => e[0] === food)?.[1] ?? 0;
      const per = FOODS[food].per100.kcal / 100;
      const extra = Math.min(max - cur, Math.ceil(deficit / per / 5) * 5);
      if (extra <= 0) return;
      specs[slot].x = [...(specs[slot].x ?? []).filter((e) => e[0] !== food), [food, cur + extra]];
      deficit -= extra * per;
      floorApplied += extra * per;
    };
    add(3, "almendras", 30);
    add(2, "aguacate", 100);
  }
  if (deficit > 0) {
    for (const slot of [2, 4]) {
      const sp = specs[slot];
      if (sp.k !== "prot" || !sp.p) continue;
      const per = FOODS[sp.p].per100.kcal / 100;
      const extra = Math.min(MAX_COMPLEMENT_G - (sp.cg ?? 0), Math.ceil(deficit / 2 / per / 10) * 10);
      if (extra <= 0) continue;
      sp.cg = (sp.cg ?? 0) + extra;
      floorApplied += extra * per;
    }
    deficit = PLAN_FLOOR_KCAL - total();
  }

  const recipes = specs.map((sp) => recipeFromSpec(sp));
  const m = sumMacros(recipes.flatMap((r) => r.lines));
  return { type: d, specs, recipes, kcal: Math.round(m.kcal), protein: Math.round(m.p), floorApplied: Math.round(floorApplied), belowFloor: Math.max(0, Math.round(PLAN_FLOOR_KCAL - m.kcal)) };
}

/** "Cambiar plato" dentro del plan: misma toma, otra proteína / carbohidrato / verdura, respetando las reglas del día. */
export function planAlternative(slug: string, prefs: FoodPrefs = NO_PREFS): string | null {
  const sp = decodeSpec(slug);
  if (!sp) return null;
  const proteins = allowed(PLAN_PROTEINS, (x) => x, prefs);
  const next = <T>(list: T[], cur: T | undefined) => list[(Math.max(0, list.indexOf(cur as T)) + 1) % list.length];
  const alt: PlanSpec = { ...sp, cg: undefined, v: (sp.v ?? 0) + 1 };
  if (sp.k === "eggs") Object.assign(alt, { k: "prot", p: proteins[0], g: 100 });
  else if (sp.k === "shake") Object.assign(alt, { k: "claras", v: sp.v ?? 0 });
  else if (sp.k === "claras") Object.assign(alt, { k: "prot", p: proteins[0], g: PLAN_PROTEIN_G[sp.s] });
  else if (sp.s === 0) Object.assign(alt, { k: "eggs", p: undefined, g: undefined });
  else alt.p = next(proteins, sp.p);
  if (sp.c) {
    const list = allowed([...(sp.s === 2 ? LUNCH_CARBS : BREAKFAST_CARBS), ...SWAP_EXTRA_CARBS], (x) => x, prefs);
    alt.c = next(list, sp.c);
  }
  return encodeSpec(alt);
}
