// Cálculos nutricionales y antropométricos puros (sin dependencias de UI).
import type { Sex } from "../types";

export const MIN_KCAL_FAT_LOSS = 1800;
export const MIN_KCAL_PREGNANCY = 1800;

const round = (n: number, d = 0) => {
  const p = 10 ** d;
  return Math.round(n * p) / p;
};
const roundTo = (n: number, step: number) => Math.round(n / step) * step;

/* ───────────── Composición básica ───────────── */

export const bmi = (weightKg: number, heightCm: number) => weightKg / (heightCm / 100) ** 2;

export function bmiCategory(v: number): string {
  if (v < 18.5) return "Bajo peso";
  if (v < 25) return "Peso normal";
  if (v < 30) return "Sobrepeso";
  if (v < 35) return "Obesidad grado I";
  if (v < 40) return "Obesidad grado II";
  return "Obesidad grado III";
}

/** Peso ideal de Devine. */
export function idealWeightKg(heightCm: number, sex: Sex): number {
  const inches = heightCm / 2.54;
  const over = Math.max(0, inches - 60);
  return (sex === "male" ? 50 : 45.5) + 2.3 * over;
}

/** Peso ajustado = ideal + 0,4 × (actual − ideal). */
export function adjustedWeightKg(weightKg: number, heightCm: number, sex: Sex): number {
  const ideal = idealWeightKg(heightCm, sex);
  if (weightKg <= ideal) return weightKg;
  return ideal + 0.4 * (weightKg - ideal);
}

/** Mifflin-St Jeor. */
export function bmr(weightKg: number, heightCm: number, age: number, sex: Sex): number {
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === "male" ? 5 : -161);
}

/** Factor de actividad según días de entrenamiento por semana. */
export function activityFactor(trainingDaysPerWeek: number): number {
  if (trainingDaysPerWeek <= 0) return 1.2;
  if (trainingDaysPerWeek <= 2) return 1.375;
  if (trainingDaysPerWeek <= 3) return 1.45;
  if (trainingDaysPerWeek <= 5) return 1.55;
  return 1.725;
}

/* ───────────── Perfil 1: pérdida de grasa ───────────── */

export interface FatLossTargets {
  bmr: number;
  tdee: number;
  deficit: number;
  kcal: number;
  adjustedWeightKg: number;
  proteinG: number;
  proteinPerKgAdj: number;
  minApplied: boolean;
  waterMl: number;
}

/** Déficit sugerido (500–750 kcal) según IMC. */
export function suggestedDeficit(bmiValue: number): number {
  if (bmiValue >= 35) return 750;
  if (bmiValue >= 30) return 600;
  return 500;
}

export const PROTEIN_G_PER_KG_ADJ = 1.9; // punto medio de 1,8–2,0

export function waterGoalMl(weightKg: number): number {
  return roundTo(weightKg * 35, 50);
}

export function fatLossTargets(p: {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: Sex;
  trainingDays: number;
  deficit?: number;
}): FatLossTargets {
  const b = bmr(p.weightKg, p.heightCm, p.age, p.sex);
  const tdee = b * activityFactor(p.trainingDays);
  const deficit = Math.min(750, Math.max(500, p.deficit ?? suggestedDeficit(bmi(p.weightKg, p.heightCm))));
  const raw = tdee - deficit;
  const kcal = Math.max(MIN_KCAL_FAT_LOSS, round(raw));
  const adj = adjustedWeightKg(p.weightKg, p.heightCm, p.sex);
  return {
    bmr: round(b),
    tdee: round(tdee),
    deficit,
    kcal,
    adjustedWeightKg: round(adj, 1),
    proteinG: roundTo(adj * PROTEIN_G_PER_KG_ADJ, 5),
    proteinPerKgAdj: PROTEIN_G_PER_KG_ADJ,
    minApplied: raw < MIN_KCAL_FAT_LOSS,
    waterMl: waterGoalMl(p.weightKg),
  };
}

/** La meta de proteína se recalcula cada vez que el peso baja 3 kg desde el ancla. */
export function needsProteinRecalc(anchorKg: number | null, currentKg: number): boolean {
  if (anchorKg == null) return true;
  return anchorKg - currentKg >= 3;
}

/* ───────────── Distribución por toma ───────────── */

/** Pesos de la distribución de proteína por toma (30/30/40/30/30/20 g con meta ≈ 175–180 g). */
export const PROTEIN_SLOT_WEIGHTS = [30, 30, 40, 30, 30, 20] as const;
const WEIGHT_SUM = 180;

/**
 * Reparte la proteína diaria en las 6 tomas. Con una meta dentro de ±3 % de 180 g
 * (p. ej. los 175 g de Jose) se usan exactamente los gramos fijos del plan; fuera de ese
 * rango se escala proporcionalmente (la esposa, por ejemplo).
 */
export function proteinPerSlot(dailyProteinG: number): number[] {
  const ratio = dailyProteinG / WEIGHT_SUM;
  if (Math.abs(ratio - 1) <= 0.03) return [...PROTEIN_SLOT_WEIGHTS];
  const raw = PROTEIN_SLOT_WEIGHTS.map((w) => w * ratio);
  const rounded = raw.map((v) => Math.round(v));
  // ajusta el residuo en el almuerzo para que la suma sea exacta
  const diff = Math.round(dailyProteinG) - rounded.reduce((a, b) => a + b, 0);
  rounded[2] += diff;
  return rounded;
}

/** kcal por toma: las tomas de solo proteína son pequeñas; el resto se reparte 27/43/30 entre desayuno, almuerzo y cena. */
export function kcalPerSlot(dailyKcal: number, proteinSlots: number[]): number[] {
  const snackKcal = (p: number, cap?: number) => {
    const v = Math.round(p * 4.6);
    return cap ? Math.min(cap, v) : v;
  };
  const s1 = snackKcal(proteinSlots[1]);
  const s3 = snackKcal(proteinSlots[3]);
  const s5 = snackKcal(proteinSlots[5], 200);
  const rest = Math.max(0, dailyKcal - s1 - s3 - s5);
  return [Math.round(rest * 0.27), s1, Math.round(rest * 0.43), s3, Math.round(rest * 0.3), s5];
}

/* ───────────── Días de pierna: carbohidrato ciclado ───────────── */

export interface CarbCycle {
  /** kcal extra (positivo) o menos (negativo) para el día. */
  dayKcalDelta: number;
  /** g de carbohidrato extra repartidos en pre y post entreno (por toma). */
  carbDeltaPerMealG: number;
}

/**
 * Días de pierna: +25 g de carbohidrato en la toma previa y en la posterior (≈ +200 kcal/día).
 * Se compensan en los días sin pierna para que la semana quede en el mismo total.
 */
export function carbCycleForWeek(legDays: number[], perMealG = 25): Record<number, CarbCycle> {
  const legSet = new Set(legDays);
  const nLeg = legSet.size;
  const out: Record<number, CarbCycle> = {};
  const extraPerLegDay = perMealG * 2 * 4;
  const nRest = 7 - nLeg;
  const comp = nRest > 0 ? (extraPerLegDay * nLeg) / nRest : 0;
  for (let d = 0; d < 7; d++) {
    out[d] = legSet.has(d)
      ? { dayKcalDelta: extraPerLegDay, carbDeltaPerMealG: perMealG }
      : { dayKcalDelta: -round(comp), carbDeltaPerMealG: 0 };
  }
  return out;
}

/* ───────────── Medicamento GLP-1 ───────────── */

export const GLP1_PORTION_FACTOR = 0.8;

/** Alerta si la proteína quedó por debajo de la meta (< 90 %) 2 días seguidos. */
export function proteinShortfallAlert(lastTwoDays: { proteinG: number; targetG: number }[]): boolean {
  if (lastTwoDays.length < 2) return false;
  return lastTwoDays.slice(-2).every((d) => d.proteinG < d.targetG * 0.9);
}

/* ───────────── Antropometría ───────────── */

/** % de grasa, fórmula de la Marina de EE. UU. (medidas en cm). */
export function navyBodyFat(p: { sex: Sex; heightCm: number; waistCm: number; neckCm: number; hipCm?: number | null }): number | null {
  const { sex, heightCm, waistCm, neckCm, hipCm } = p;
  if (sex === "male") {
    if (waistCm - neckCm <= 0) return null;
    const v = 86.01 * Math.log10(waistCm - neckCm) - 70.041 * Math.log10(heightCm) + 36.76;
    return clampBf(v);
  }
  if (!hipCm || waistCm + hipCm - neckCm <= 0) return null;
  const v = 163.205 * Math.log10(waistCm + hipCm - neckCm) - 97.684 * Math.log10(heightCm) - 78.387;
  return clampBf(v);
}
const clampBf = (v: number) => (Number.isFinite(v) ? Math.min(60, Math.max(2, v)) : null);

export const leanMassKg = (weightKg: number, bodyFatPct: number) => weightKg * (1 - bodyFatPct / 100);
export const waistHipRatio = (waist: number, hip: number) => waist / hip;
export const kgLost = (startKg: number, currentKg: number) => startKg - currentKg;
export const pctLost = (startKg: number, currentKg: number) => ((startKg - currentKg) / startKg) * 100;

export interface PointKg {
  date: string; // ISO
  kg: number;
}

/** Promedio móvil de 7 días calendario (incluye el día actual). */
export function movingAverage7(points: PointKg[]): PointKg[] {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const ms = (iso: string) => Date.parse(iso + "T00:00:00Z");
  return sorted.map((p) => {
    const window = sorted.filter((q) => ms(q.date) <= ms(p.date) && ms(p.date) - ms(q.date) < 7 * 86400000);
    return { date: p.date, kg: window.reduce((a, b) => a + b.kg, 0) / window.length };
  });
}

/** Proyección de la fecha de meta con regresión lineal sobre el promedio móvil (últimos 28 días). */
export function projectGoalDate(points: PointKg[], goalKg: number): { date: string; kgPerWeek: number } | null {
  const ma = movingAverage7(points);
  if (ma.length < 3) return null;
  const last = ma.slice(-28);
  const t0 = Date.parse(last[0].date + "T00:00:00Z");
  const xs = last.map((p) => (Date.parse(p.date + "T00:00:00Z") - t0) / 86400000);
  const ys = last.map((p) => p.kg);
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  const den = xs.reduce((a, x) => a + (x - mx) ** 2, 0);
  if (den === 0) return null;
  const slope = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / den; // kg/día
  if (slope >= -0.005) return null; // sin tendencia a la baja
  const current = ma[ma.length - 1].kg;
  if (current <= goalKg) return { date: ma[ma.length - 1].date, kgPerWeek: slope * 7 };
  const days = Math.ceil((current - goalKg) / -slope);
  const target = new Date(Date.parse(ma[ma.length - 1].date + "T00:00:00Z") + days * 86400000);
  return { date: target.toISOString().slice(0, 10), kgPerWeek: slope * 7 };
}

export interface Milestone {
  pct: number;
  atKg: number;
  reached: boolean;
}
export function milestones(startKg: number, currentKg: number): Milestone[] {
  return [5, 10, 15].map((p) => ({ pct: p, atKg: round(startKg * (1 - p / 100), 1), reached: currentKg <= startKg * (1 - p / 100) }));
}

/** Aviso médico si la pérdida semanal supera 1,5 % del peso durante 3 semanas seguidas. */
export function rapidLossWarning(points: PointKg[]): boolean {
  const ma = movingAverage7(points);
  if (ma.length < 2) return false;
  const lastDate = ma[ma.length - 1].date;
  const ms = (iso: string) => Date.parse(iso + "T00:00:00Z");
  const valueAt = (iso: string): number | null => {
    // último promedio disponible en o antes de la fecha
    const c = ma.filter((p) => ms(p.date) <= ms(iso));
    return c.length ? c[c.length - 1].kg : null;
  };
  let strikes = 0;
  for (let w = 0; w < 3; w++) {
    const end = new Date(ms(lastDate) - w * 7 * 86400000).toISOString().slice(0, 10);
    const start = new Date(ms(lastDate) - (w + 1) * 7 * 86400000).toISOString().slice(0, 10);
    const a = valueAt(start);
    const b = valueAt(end);
    if (a == null || b == null) return false;
    if ((a - b) / a > 0.015) strikes++;
  }
  return strikes === 3;
}

/** Carga sobre la rodilla: cada kg perdido quita ≈ 4 kg por paso. */
export const kneeLoadReductionKg = (kgLostTotal: number) => Math.max(0, kgLostTotal) * 4;
