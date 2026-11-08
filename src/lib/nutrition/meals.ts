// Horario de comidas: corrimiento por registro tardío, redistribución de proteína y ajuste por entrenamiento.
import { minToTime, timeToMin } from "../format";
import { SLOTS } from "../types";

export const MEAL_GAP_MIN = 180;
export const LAST_MEAL_LIMIT_MIN = 23 * 60;
export const MAX_PROTEIN_PER_MEAL = 45;

export const defaultMealTimes = () => SLOTS.map((s) => s.defaultTime);

export interface SlotState {
  /** hora real si ya se comió (HH:MM) */
  eatenAt?: string | null;
  skipped?: boolean;
}

export interface ScheduledSlot {
  slot: number;
  baseTime: string;
  time: string;
  shiftedMin: number;
  /** true si no cabe antes de las 23:00 tras el corrimiento */
  dropped: boolean;
  status: "eaten" | "skipped" | "pending";
}

/**
 * Si una toma se registra tarde, corre las siguientes para mantener 3 h entre comidas,
 * sin pasar de las 11:00 p. m. Las tomas que ya no caben quedan como `dropped`.
 */
export function rescheduleDay(baseTimes: string[], states: SlotState[]): ScheduledSlot[] {
  const out: ScheduledSlot[] = [];
  let prevEnd: number | null = null; // hora real o planeada de la toma anterior no omitida
  for (let i = 0; i < baseTimes.length; i++) {
    const st = states[i] ?? {};
    const base = timeToMin(baseTimes[i]);
    if (st.skipped) {
      out.push({ slot: i, baseTime: baseTimes[i], time: baseTimes[i], shiftedMin: 0, dropped: false, status: "skipped" });
      continue;
    }
    if (st.eatenAt) {
      const t = timeToMin(st.eatenAt);
      out.push({ slot: i, baseTime: baseTimes[i], time: st.eatenAt, shiftedMin: t - base, dropped: false, status: "eaten" });
      prevEnd = t;
      continue;
    }
    let t = base;
    if (prevEnd !== null) t = Math.max(base, prevEnd + MEAL_GAP_MIN);
    const dropped = t > LAST_MEAL_LIMIT_MIN;
    out.push({ slot: i, baseTime: baseTimes[i], time: minToTime(Math.min(t, LAST_MEAL_LIMIT_MIN)), shiftedMin: t - base, dropped, status: "pending" });
    if (!dropped) prevEnd = t;
  }
  return out;
}

export interface RedistributionResult {
  targets: number[];
  /** proteína que no cupo (supera el máximo por toma en las tomas restantes) */
  unallocated: number;
}

/**
 * Redistribuye la proteína de las tomas omitidas / descartadas en las siguientes tomas pendientes
 * (máximo 45 g por toma).
 */
export function redistributeProtein(targets: number[], skippedOrDropped: boolean[], doneUpTo: number[] = []): RedistributionResult {
  const out = [...targets];
  let pool = 0;
  for (let i = 0; i < out.length; i++) {
    if (skippedOrDropped[i]) {
      pool += out[i];
      out[i] = 0;
    }
  }
  // tomas elegibles: pendientes, no omitidas, posteriores a la última omitida
  const lastSkipped = skippedOrDropped.lastIndexOf(true);
  const doneSet = new Set(doneUpTo);
  let eligible = out.map((_, i) => i).filter((i) => !skippedOrDropped[i] && !doneSet.has(i) && i > lastSkipped);
  if (eligible.length === 0) eligible = out.map((_, i) => i).filter((i) => !skippedOrDropped[i] && !doneSet.has(i));
  // reparte de a 1 g de forma pareja respetando el tope
  let guard = 0;
  while (pool > 0 && eligible.length && guard++ < 5000) {
    const room = eligible.filter((i) => out[i] < MAX_PROTEIN_PER_MEAL);
    if (!room.length) break;
    const share = Math.max(1, Math.floor(pool / room.length));
    for (const i of room) {
      const add = Math.min(share, MAX_PROTEIN_PER_MEAL - out[i], pool);
      out[i] += add;
      pool -= add;
      if (pool <= 0) break;
    }
  }
  return { targets: out, unallocated: pool };
}

/* ───────────── Entrenamiento (perfil Jose) ───────────── */

export interface WorkoutSlots {
  pre: number | null;
  post: number | null;
}

/**
 * Pre-entreno: la toma que queda 60–90 min antes (la más cercana a 75 min; se acepta 45–120 si no hay otra).
 * Post-entreno: la primera toma que cae dentro de las 2 h posteriores al final de la sesión.
 */
export function assignWorkoutSlots(times: string[], trainingTime: string, durationMin = 75): WorkoutSlots {
  const start = timeToMin(trainingTime);
  const end = start + durationMin;
  let pre: number | null = null;
  let bestDelta = Infinity;
  times.forEach((t, i) => {
    const before = start - timeToMin(t);
    if (before >= 45 && before <= 120) {
      const delta = Math.abs(before - 75);
      if (delta < bestDelta) {
        bestDelta = delta;
        pre = i;
      }
    }
  });
  let post: number | null = null;
  for (let i = 0; i < times.length; i++) {
    const t = timeToMin(times[i]);
    if (t >= end - 15 && t <= end + 120) {
      post = i;
      break;
    }
  }
  return { pre, post };
}

export const PRE_WORKOUT_TIP = "Pre-entreno: proteína + carbohidrato de fácil digestión, 60–90 minutos antes de entrenar.";
export const POST_WORKOUT_TIP = "Post-entreno: 30–40 g de proteína dentro de las 2 horas siguientes a la sesión.";

/** Texto del recordatorio push. */
export function reminderText(slotLabel: string, plate: string, grams: string): { title: string; body: string } {
  return { title: `${slotLabel} en 10 minutos`, body: `${plate} — ${grams}` };
}
