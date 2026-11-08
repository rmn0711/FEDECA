// Módulo de alcohol (solo perfil Jose).
import { addDays, weekStart, weekday } from "../format";

export interface Drink {
  key: string;
  name: string;
  ml: number;
  kcal: number;
  /** tragos estándar (14 g de alcohol) */
  std: number;
  lowImpact: boolean;
  note?: string;
}

export const DRINKS: Drink[] = [
  { key: "cerveza", name: "Cerveza normal", ml: 330, kcal: 150, std: 1, lowImpact: false },
  { key: "cerveza_light", name: "Cerveza light", ml: 330, kcal: 100, std: 0.8, lowImpact: true },
  { key: "vino", name: "Vino", ml: 150, kcal: 125, std: 1, lowImpact: false },
  { key: "whisky", name: "Whisky", ml: 45, kcal: 105, std: 1, lowImpact: true },
  { key: "ron", name: "Ron", ml: 45, kcal: 105, std: 1, lowImpact: true },
  { key: "aguardiente", name: "Aguardiente", ml: 45, kcal: 85, std: 0.9, lowImpact: true },
  { key: "tequila", name: "Tequila", ml: 45, kcal: 100, std: 1, lowImpact: true },
];

export interface Mixer {
  key: string;
  name: string;
  kcal: number;
  sugary: boolean;
}
export const MIXERS: Mixer[] = [
  { key: "ninguno", name: "Solo / sin mezclador", kcal: 0, sugary: false },
  { key: "soda", name: "Soda o agua con gas y limón", kcal: 2, sugary: false },
  { key: "gaseosa_zero", name: "Gaseosa sin azúcar", kcal: 2, sugary: false },
  { key: "gaseosa", name: "Gaseosa normal", kcal: 140, sugary: true },
  { key: "jugo", name: "Jugo de fruta", kcal: 110, sugary: true },
  { key: "coctel", name: "Cóctel azucarado", kcal: 220, sugary: true },
];

export const LIMITS = { perDay: 2, perWeek: 7, minDryDaysPerWeek: 3 } as const;

export const drinkByKey = (k: string) => DRINKS.find((d) => d.key === k);
export const mixerByKey = (k: string | null) => MIXERS.find((m) => m.key === k) ?? MIXERS[0];

export interface AlcoholEntry {
  date: string;
  qty: number;
  kcal: number;
  std_drinks: number;
}

export const entryKcal = (drink: Drink, mixer: Mixer, qty: number) => Math.round((drink.kcal + mixer.kcal) * qty);
export const entryStd = (drink: Drink, qty: number) => Math.round(drink.std * qty * 10) / 10;

export const dayStd = (entries: AlcoholEntry[], date: string) => entries.filter((e) => e.date === date).reduce((a, e) => a + e.std_drinks, 0);

export function weekEntries(entries: AlcoholEntry[], date: string) {
  const ws = weekStart(date);
  const we = addDays(ws, 6);
  return entries.filter((e) => e.date >= ws && e.date <= we);
}

export interface AlcoholStatus {
  dayStd: number;
  weekStd: number;
  drinkingDays: number;
  dryDays: number;
  overDay: boolean;
  overWeek: boolean;
  tooFewDryDays: boolean;
}

export function alcoholStatus(entries: AlcoholEntry[], date: string): AlcoholStatus {
  const w = weekEntries(entries, date);
  const weekStd = w.reduce((a, e) => a + e.std_drinks, 0);
  const days = new Set(w.map((e) => e.date));
  const d = dayStd(entries, date);
  return {
    dayStd: d,
    weekStd,
    drinkingDays: days.size,
    dryDays: 7 - days.size,
    overDay: d > LIMITS.perDay,
    overWeek: weekStd > LIMITS.perWeek,
    tooFewDryDays: 7 - days.size < LIMITS.minDryDaysPerWeek,
  };
}

/** Sin alcohol el día antes ni el día de una sesión de pierna (legDays: 0=dom…6=sáb). */
export function alcoholBlockedByLegDay(date: string, legDays: number[]): { blocked: boolean; reason: string | null } {
  const wd = weekday(date);
  const tomorrow = weekday(addDays(date, 1));
  if (legDays.includes(wd)) return { blocked: true, reason: "Hoy entrenas pierna: sin alcohol el día de la sesión." };
  if (legDays.includes(tomorrow)) return { blocked: true, reason: "Mañana entrenas pierna: sin alcohol el día antes." };
  return { blocked: false, reason: null };
}

/**
 * Descuenta las kcal del alcohol de las tomas restantes sin tocar la proteína.
 * Se reduce de forma proporcional el componente no proteico, con piso en las kcal de la proteína.
 */
export function adjustSlotsForAlcohol(slotKcal: number[], slotProtein: number[], remaining: number[], alcoholKcal: number): number[] {
  const out = [...slotKcal];
  let toCut = alcoholKcal;
  for (let guard = 0; guard < 6 && toCut > 0.5; guard++) {
    const flex = remaining.map((i) => Math.max(0, out[i] - slotProtein[i] * 4.2));
    const total = flex.reduce((a, b) => a + b, 0);
    if (total <= 0) break;
    const cutNow = Math.min(toCut, total);
    remaining.forEach((i, k) => {
      out[i] = Math.round((out[i] - (cutNow * flex[k]) / total) * 10) / 10;
    });
    toCut -= cutNow;
  }
  return out;
}

export const ALCOHOL_EXPLANATION =
  "Mientras el cuerpo procesa el alcohol, prioriza quemarlo como combustible y frena la oxidación de grasa durante varias horas. Además reduce la síntesis de proteína muscular y empeora el sueño, lo que frena la recuperación después de entrenar. Pasarse del límite semanal te aleja del objetivo de grasa y de la protección de la rodilla.";
