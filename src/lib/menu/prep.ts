// Preparación del día siguiente: qué adobar en la noche, qué remojar y a qué hora empezar a cocinar en la mañana.
import { FOODS } from "@/data/foods";
import { computeDay } from "../day";
import { minToTime, timeToMin } from "../format";
import type { FoodPrefs } from "../prefs";
import { NO_PREFS } from "../prefs";
import type { Profile } from "../types";
import type { OverrideMap } from "./planner";

interface Marinade {
  text: string;
  minH: number;
  maxH: number;
  note?: string;
}

const POLLO: Marinade = { text: "ajo machacado, jugo de limón, comino, orégano, sal, pimienta y 1 cucharadita de aceite", minH: 4, maxH: 16 };
const RES: Marinade = { text: "ajo, cebolla larga picada, comino, sal, pimienta y un chorrito de limón", minH: 6, maxH: 16 };
const CERDO: Marinade = { text: "ajo, orégano, comino, pimienta, sal y jugo de limón", minH: 6, maxH: 16 };
const MOLIDA: Marinade = { text: "ajo, cebolla rallada, comino, sal y pimienta (mézclala bien; no necesita más de unas horas)", minH: 2, maxH: 8 };
const PESCADO: Marinade = { text: "ajo, sal y pimienta", minH: 1, maxH: 8, note: "El limón agrégalo solo 20–30 minutos antes de cocinar: el ácido \"cocina\" el pescado y lo deja chicloso." };
const MARISCO: Marinade = { text: "ajo, sal y pimienta", minH: 1, maxH: 6, note: "Agrega el limón solo 15 minutos antes de cocinar." };

export const MARINADES: Record<string, Marinade> = {
  pechuga: POLLO, muslo: POLLO, pavo: POLLO, res: RES, cerdo: CERDO, molida: MOLIDA,
  bocachico: PESCADO, mojarra: PESCADO, robalo: PESCADO, salmon: PESCADO, camaron: MARISCO,
};

export const SOAKABLE: Record<string, { hours: string }> = {
  lentejas: { hours: "2 a 4 horas" },
  frijoles: { hours: "8 a 12 horas" },
  garbanzo: { hours: "8 a 12 horas" },
};

export interface PersonAmount {
  name: string;
  rawG: number;
  cookedG: number;
}

export interface MarinateItem {
  slot: number;
  slotLabel: string;
  mealTime: string;
  recipeName: string;
  recipeSlug: string;
  foodKey: string;
  foodName: string;
  perPerson: PersonAmount[];
  totalRawG: number;
  marinade: string;
  minH: number;
  maxH: number;
  note?: string;
  /** "tonight": adóbalo esta noche (antes de `marinateAt`); "morning": adóbalo mañana a `marinateAt` (adobos cortos como el pescado) */
  when: "tonight" | "morning";
  marinateAt: string;
  cookStart: string;
}

export interface SoakItem {
  foodKey: string;
  foodName: string;
  slotLabel: string;
  recipeName: string;
  perPerson: PersonAmount[];
  totalRawG: number;
  hours: string;
}

export interface CookItem {
  slot: number;
  slotLabel: string;
  mealTime: string;
  cookStart: string;
  timeMin: number;
  recipeName: string;
  recipeSlug: string;
  needsCooking: boolean;
  marinated: string[];
  keySteps: string[];
}

export interface DayPrep {
  date: string;
  marinate: MarinateItem[];
  soak: SoakItem[];
  cook: CookItem[];
  pregnantNote: boolean;
}

/** Empieza a cocinar con 10 minutos de margen antes del tiempo de preparación, redondeado a 5 min. */
export function cookStartTime(mealTime: string, timeMin: number): string {
  const raw = timeToMin(mealTime) - timeMin - 10;
  return minToTime(Math.floor(raw / 5) * 5);
}

export function prepForDay(input: { date: string; profiles: Profile[]; overrides: OverrideMap; prefs?: FoodPrefs; today?: string }): DayPrep {
  const { date, profiles, overrides, prefs = NO_PREFS, today = date } = input;
  const days = profiles.map((p) => ({ p, day: computeDay({ profile: p, date, today, overrides, logs: [], prefs }) }));
  const first = days[0]?.day;
  const marinate: MarinateItem[] = [];
  const soak: SoakItem[] = [];
  const cook: CookItem[] = [];
  if (!first) return { date, marinate, soak, cook, pregnantNote: false };

  first.slots.forEach((s, i) => {
    const recipe = s.recipe;
    const mealTime = s.baseTime;
    const start = cookStartTime(mealTime, recipe.timeMin);
    const marinatedNames: string[] = [];

    // proteínas marinables y legumbres de la toma, sumando a los dos
    const amounts = new Map<string, PersonAmount[]>();
    for (const { p, day } of days) {
      for (const l of day.slots[i].portion.lines) {
        if (!MARINADES[l.food] && !SOAKABLE[l.food]) continue;
        const food = FOODS[l.food];
        const raw = food.rawYield ? l.g / food.rawYield : l.g;
        const arr = amounts.get(l.food) ?? [];
        arr.push({ name: p.name, rawG: Math.round(raw / 5) * 5, cookedG: l.g });
        amounts.set(l.food, arr);
      }
    }
    for (const [foodKey, perPerson] of amounts) {
      const total = perPerson.reduce((a, x) => a + x.rawG, 0);
      if (MARINADES[foodKey]) {
        const m = MARINADES[foodKey];
        // Ventana de adobo: entre (hora de cocinar − máximo) y (hora de cocinar − mínimo).
        const cookAbs = 1440 + timeToMin(start);
        const earliest = cookAbs - m.maxH * 60;
        const latest = cookAbs - m.minH * 60;
        let when: "tonight" | "morning" = "tonight";
        let marinateAt: string;
        if (earliest > 23 * 60 + 30) {
          // Un adobo que no puede empezar antes de dormir: mejor en la mañana, dentro de la ventana.
          when = "morning";
          marinateAt = minToTime(Math.min(Math.max(earliest, 1440 + 6 * 60), latest) - 1440);
        } else {
          marinateAt = minToTime(Math.min(Math.max(earliest, 21 * 60), latest, 23 * 60 + 30));
        }
        marinate.push({ slot: i, slotLabel: s.label, mealTime, recipeName: recipe.dish ?? recipe.name, recipeSlug: recipe.slug, foodKey, foodName: FOODS[foodKey].name, perPerson, totalRawG: total, marinade: m.text, minH: m.minH, maxH: m.maxH, note: m.note, when, marinateAt, cookStart: start });
        marinatedNames.push(FOODS[foodKey].name);
      } else {
        soak.push({ foodKey, foodName: FOODS[foodKey].name, slotLabel: s.label, recipeName: recipe.dish ?? recipe.name, perPerson, totalRawG: total, hours: SOAKABLE[foodKey].hours });
      }
    }
    cook.push({
      slot: i,
      slotLabel: s.label,
      mealTime,
      cookStart: start,
      timeMin: recipe.timeMin,
      recipeName: recipe.dish ?? recipe.name,
      recipeSlug: recipe.slug,
      needsCooking: recipe.timeMin >= 10,
      marinated: marinatedNames,
      keySteps: recipe.steps.slice(0, 3),
    });
  });
  return { date, marinate, soak, cook: cook.sort((a, b) => timeToMin(a.cookStart) - timeToMin(b.cookStart)), pregnantNote: profiles.some((p) => p.mode === "pregnancy") };
}

/** Texto corto del aviso de las 8 p. m. */
export function marinateReminder(prep: DayPrep): { title: string; body: string } | null {
  if (!prep.marinate.some((m) => m.when === "tonight") && !prep.soak.length) return null;
  const parts = [
    ...prep.marinate.filter((m) => m.when === "tonight").map((m) => `${m.foodName} ${Math.round(m.totalRawG)} g (${m.slotLabel.toLowerCase()})`),
    ...prep.soak.map((s) => `remojar ${s.foodName} ${Math.round(s.totalRawG)} g`),
  ];
  return { title: "Adoba esta noche para mañana", body: parts.join(" · ") };
}
