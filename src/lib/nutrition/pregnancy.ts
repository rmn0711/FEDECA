// Embarazo: semana, trimestre, calorías, proteína y ganancia de peso (IOM).
import { daysBetween } from "../format";
import { activityFactor, bmr, MIN_KCAL_PREGNANCY, bmi } from "./calc";

export type Trimester = 1 | 2 | 3;

/** Semana de gestación (0–42) calculada con la fecha probable de parto (FPP = semana 40). */
export function gestationalWeek(dueDateISO: string, todayISO: string): number {
  const daysToDue = daysBetween(todayISO, dueDateISO);
  const days = 280 - daysToDue;
  return Math.min(42, Math.max(0, Math.floor(days / 7)));
}

export function gestationalDays(dueDateISO: string, todayISO: string): number {
  return Math.max(0, 280 - daysBetween(todayISO, dueDateISO));
}

export function trimesterOf(week: number): Trimester {
  if (week < 14) return 1;
  if (week < 28) return 2;
  return 3;
}

export const TRIMESTER_KCAL_ADD: Record<Trimester, number> = { 1: 0, 2: 340, 3: 450 };

export interface PregnancyTargets {
  week: number;
  trimester: Trimester;
  maintenanceKcal: number;
  addKcal: number;
  kcal: number;
  proteinG: number;
}

export function pregnancyTargets(p: {
  weightKg: number;
  heightCm: number;
  age: number;
  dueDate: string;
  today: string;
}): PregnancyTargets {
  const week = gestationalWeek(p.dueDate, p.today);
  const tri = trimesterOf(week);
  // Mantenimiento con actividad ligera (sin módulo de ejercicio); NUNCA déficit.
  const maintenance = Math.round(bmr(p.weightKg, p.heightCm, p.age, "female") * activityFactor(2));
  const addKcal = TRIMESTER_KCAL_ADD[tri];
  const kcal = Math.max(MIN_KCAL_PREGNANCY, maintenance + addKcal);
  const proteinG = Math.max(71, Math.round(p.weightKg * 1.1));
  return { week, trimester: tri, maintenanceKcal: maintenance, addKcal, kcal, proteinG };
}

/* ───────────── IOM ───────────── */

export interface IomCategory {
  key: "under" | "normal" | "over" | "obese";
  label: string;
  totalMin: number;
  totalMax: number;
  weeklyMin: number;
  weeklyMax: number;
}

export function iomCategory(prePregBmi: number): IomCategory {
  if (prePregBmi < 18.5) return { key: "under", label: "Bajo peso previo", totalMin: 12.5, totalMax: 18, weeklyMin: 0.44, weeklyMax: 0.58 };
  if (prePregBmi < 25) return { key: "normal", label: "Peso previo normal", totalMin: 11.5, totalMax: 16, weeklyMin: 0.35, weeklyMax: 0.5 };
  if (prePregBmi < 30) return { key: "over", label: "Sobrepeso previo", totalMin: 7, totalMax: 11.5, weeklyMin: 0.23, weeklyMax: 0.33 };
  return { key: "obese", label: "Obesidad previa", totalMin: 5, totalMax: 9, weeklyMin: 0.17, weeklyMax: 0.27 };
}

export function iomForProfile(prePregKg: number, heightCm: number) {
  return iomCategory(bmi(prePregKg, heightCm));
}

/** Rango de ganancia acumulada esperada (kg) en una semana: 0,5–2 kg al final del 1.er trimestre y luego lineal hasta el total IOM en la semana 40. */
export function expectedGainRange(cat: IomCategory, week: number): { min: number; max: number } {
  const w = Math.max(0, Math.min(40, week));
  if (w <= 13) return { min: (0.5 * w) / 13, max: (2 * w) / 13 };
  const f = (w - 13) / 27;
  return { min: 0.5 + (cat.totalMin - 0.5) * f, max: 2 + (cat.totalMax - 2) * f };
}

export type GainStatus = "below" | "within" | "above";
export function gainStatus(cat: IomCategory, week: number, gainKg: number): GainStatus {
  const r = expectedGainRange(cat, week);
  if (gainKg < r.min - 0.5) return "below";
  if (gainKg > r.max + 0.5) return "above";
  return "within";
}

/* ───────────── Mensajes fijos ───────────── */

export const PREGNANCY_DISCLAIMER =
  "Este plan complementa, no reemplaza, las indicaciones de tu ginecólogo. Suplementos solo por indicación médica.";

export const PREGNANCY_SYMPTOM_REMINDER =
  "Si notas algo raro (sangrado, dolor abdominal, flujo inusual, dolor de cabeza fuerte, visión borrosa, hinchazón repentina, fiebre o menos movimientos del bebé), consulta a tu ginecólogo o ve a urgencias hoy.";

export const POST_DINNER_PREGNANCY_TIP = "Espera 30–60 minutos antes de acostarte para evitar la acidez.";

/** Palabras en notas libres que merecen recordar al ginecólogo. */
const SYMPTOM_WORDS = /(sangr|dolor|fiebre|contracci|mareo|v[oó]mito|visi[oó]n|hinchaz|flujo|picaz|desmayo|palpita|sin movimiento|no se mueve|ardor al orinar)/i;
export const symptomNeedsAttention = (note: string) => SYMPTOM_WORDS.test(note);

export const NUTRIENT_FOCUS: { key: string; label: string; why: string; foods: string[] }[] = [
  { key: "hierro", label: "Hierro", why: "Apoya el aumento del volumen de sangre.", foods: ["res magra", "lentejas", "frijoles", "espinaca", "garbanzo"] },
  { key: "folato", label: "Folato", why: "Desarrollo del tubo neural.", foods: ["lentejas", "espinaca", "garbanzo", "aguacate", "habichuela"] },
  { key: "calcio", label: "Calcio", why: "Huesos del bebé y los tuyos.", foods: ["yogur griego", "queso campesino pasteurizado", "leche descremada", "sardinas"] },
  { key: "omega3", label: "Omega-3", why: "Cerebro y retina del bebé.", foods: ["salmón bien cocido", "sardinas", "mojarra", "bocachico"] },
  { key: "yodo", label: "Yodo", why: "Tiroides y neurodesarrollo.", foods: ["leche", "yogur", "huevo cocido", "pescado bien cocido"] },
];
