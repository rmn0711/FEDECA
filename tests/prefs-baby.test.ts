import { describe, expect, it } from "vitest";
import { RECIPE_BY_SLUG, recipesOfKind } from "@/data/recipes";
import { EXCLUDED_PATTERN } from "@/data/foods";
import { addDays } from "@/lib/format";
import { coverage, findSubstitute, getPools, planWeek } from "@/lib/menu/planner";
import { buildPrefs, isAllowed, recipeFoodKeys } from "@/lib/prefs";
import { BABY_WEEKS, babyForWeek } from "@/lib/nutrition/baby";
import { snackHeading } from "@/lib/menu/core";

const WEEK0 = "2026-11-09";
const weeks = (n: number, prefs = buildPrefs([])) => Array.from({ length: n }, (_, w) => planWeek(addDays(WEEK0, w * 7), {}, prefs));

describe("gustos de comida", () => {
  it("un 'no me gusta' gana sobre un 'me gusta' y se combinan las personas", () => {
    const p = buildPrefs([{ food_key: "avena", pref: "dislike" }, { food_key: "avena", pref: "like" }, { food_key: "cerdo", pref: "like" }, { food_key: "maracuya", pref: "dislike" }]);
    expect(p.dislikes.has("avena")).toBe(true);
    expect(p.likes.has("avena")).toBe(false);
    expect(p.likes.has("cerdo")).toBe(true);
  });
  it("sin avena ni maracuyá: nunca aparecen en 4 semanas de menú", () => {
    const prefs = buildPrefs([{ food_key: "avena", pref: "dislike" }, { food_key: "maracuya", pref: "dislike" }]);
    for (const wk of weeks(4, prefs)) {
      for (const day of Object.values(wk)) {
        for (const slug of day) {
          const foods = recipeFoodKeys(RECIPE_BY_SLUG[slug]);
          expect(foods.has("avena"), slug).toBe(false);
          expect(foods.has("maracuya"), slug).toBe(false);
        }
      }
    }
  });
  it("sigue sin repetir almuerzo ni cena en la semana con gustos aplicados", () => {
    const prefs = buildPrefs([{ food_key: "avena", pref: "dislike" }, { food_key: "cerdo", pref: "dislike" }, { food_key: "robalo", pref: "dislike" }]);
    for (const wk of weeks(4, prefs)) {
      expect(new Set(Object.values(wk).map((d) => d[2])).size).toBe(7);
      expect(new Set(Object.values(wk).map((d) => d[4])).size).toBe(7);
    }
  });
  it("el alimento sustituto del embarazo también cuenta (queso costeño → campesino)", () => {
    const prefs = buildPrefs([{ food_key: "campesino", pref: "dislike" }]);
    const costeno = RECIPE_BY_SLUG["breakfast-arepa-con-queso-costeno-y-huevo"];
    expect(isAllowed(costeno, prefs)).toBe(false);
  });
  it("avisa cuando los gustos dejan pocas opciones y relaja el filtro en ese tipo de toma", () => {
    const meats = ["pechuga", "muslo", "res", "molida", "cerdo", "pavo", "bocachico", "mojarra", "robalo", "salmon", "camaron", "atun", "sardina", "huevo", "clara", "jamon_pavo"];
    const prefs = buildPrefs(meats.map((m) => ({ food_key: m, pref: "dislike" as const })));
    expect(getPools(prefs).relaxed.length).toBeGreaterThan(0);
    expect(coverage(prefs).lunch).toBeLessThan(7);
    // aun así el planificador entrega 6 tomas válidas por día
    const plan = planWeek(WEEK0, {}, prefs);
    for (const d of Object.values(plan)) expect(d).toHaveLength(6);
  });
  it("lo que me gusta aparece antes (sin romper la rotación)", () => {
    const prefs = buildPrefs([{ food_key: "mojarra", pref: "like" }]);
    const lunches = getPools(prefs).lunch;
    const firstMojarra = lunches.findIndex((r) => r.family === "mojarra");
    const firstOther = lunches.findIndex((r) => r.family === "bocachico");
    expect(firstMojarra).toBeLessThanOrEqual(firstOther);
  });
  it("cambiar plato respeta los gustos", () => {
    const prefs = buildPrefs([{ food_key: "pechuga", pref: "dislike" }]);
    const week = Object.values(planWeek(WEEK0, {}, prefs)).flat();
    const cur = RECIPE_BY_SLUG[planWeek(WEEK0, {}, prefs)[WEEK0][2]];
    const sub = findSubstitute(cur, week, { prefs })!;
    expect(recipeFoodKeys(sub).has("pechuga")).toBe(false);
  });
});

describe("meriendas de proteína con comida real", () => {
  const all = weeks(4);
  const MEAT = new Set(["pollo", "pavo", "res", "cerdo", "camaron", "atun", "sardina", "bocachico", "mojarra", "salmon", "huevo"]);
  it("hay meriendas de cerdo magro en trozos con nombre de plato", () => {
    const cerdo = recipesOfKind("snack").filter((r) => r.family === "cerdo");
    expect(cerdo.length).toBeGreaterThanOrEqual(3);
    expect(cerdo.some((r) => /Cerdo magro en trozos/.test(snackHeading(r, r.lines).title))).toBe(true);
    expect(snackHeading(cerdo[0], cerdo[0].lines).detail).toMatch(/g de proteína$/);
    for (const r of cerdo) expect(EXCLUDED_PATTERN.test(r.name + r.steps.join(" "))).toBe(false);
  });
  it("la media mañana es comida real en la mayoría de los días", () => {
    let real = 0, total = 0;
    for (const wk of all) for (const d of Object.values(wk)) { total++; if (MEAT.has(RECIPE_BY_SLUG[d[1]].family)) real++; }
    expect(real / total).toBeGreaterThan(0.6);
  });
  it("el cerdo aparece en las meriendas del mes y no hay meriendas repetidas en la semana", () => {
    const fam = new Set<string>();
    for (const wk of all) {
      const snacks = Object.values(wk).flatMap((d) => [d[1], d[3]]);
      expect(new Set(snacks).size).toBe(snacks.length);
      snacks.forEach((s) => fam.add(RECIPE_BY_SLUG[s].family));
    }
    expect(fam.has("cerdo")).toBe(true);
    expect(fam.has("res")).toBe(true);
    expect(fam.has("lacteo")).toBe(true);
  });
});

describe("tamaño del bebé", () => {
  it("frijol en la semana 8, aguacate en la 16, banano en la 20 y sandía en la 40", () => {
    expect(babyForWeek(8)!.key).toBe("frijol");
    expect(babyForWeek(16)!.key).toBe("aguacate");
    expect(babyForWeek(17)!.key).toBe("pera");
    expect(babyForWeek(20)!.key).toBe("banano");
    expect(babyForWeek(40)!.key).toBe("sandia");
    expect(babyForWeek(42)!.week).toBe(40);
    expect(babyForWeek(2)).toBeNull();
  });
  it("las medidas crecen con las semanas y se evitan los alimentos excluidos", () => {
    for (let i = 1; i < BABY_WEEKS.length; i++) {
      expect(BABY_WEEKS[i].week).toBeGreaterThan(BABY_WEEKS[i - 1].week);
      expect(BABY_WEEKS[i].cm).toBeGreaterThanOrEqual(BABY_WEEKS[i - 1].cm);
      expect(EXCLUDED_PATTERN.test(BABY_WEEKS[i].label)).toBe(false);
    }
    expect(BABY_WEEKS.every((b) => !/papaya|tomate|pepino|br[oó]coli|coliflor/i.test(b.label))).toBe(true);
  });
});
