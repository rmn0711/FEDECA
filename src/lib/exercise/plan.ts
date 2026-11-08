// Estructura semanal del entrenamiento (3–5 días de fuerza).
import type { SessionKind } from "../types";

export const DEFAULT_TRAINING_DAYS = [1, 2, 4, 5]; // lun, mar, jue, vie

const STRENGTH_ORDER: SessionKind[] = ["leg_a", "upper_a", "leg_b", "upper_b", "leg_a"];

export interface SessionInfo {
  kind: SessionKind;
  label: string;
  durationMin: number;
  hasKneeBlock: "full" | "short" | "none";
  cardioMin: number;
  strength: boolean;
}

export const SESSION_INFO: Record<SessionKind, SessionInfo> = {
  leg_a: { kind: "leg_a", label: "Pierna A + bloque de rodilla + core", durationMin: 75, hasKneeBlock: "full", cardioMin: 0, strength: true },
  leg_b: { kind: "leg_b", label: "Pierna B + bloque de rodilla + core", durationMin: 75, hasKneeBlock: "full", cardioMin: 0, strength: true },
  upper_a: { kind: "upper_a", label: "Superior A + cardio", durationMin: 60, hasKneeBlock: "short", cardioMin: 25, strength: true },
  upper_b: { kind: "upper_b", label: "Superior B + cardio", durationMin: 60, hasKneeBlock: "short", cardioMin: 25, strength: true },
  cardio_knee: { kind: "cardio_knee", label: "Cardio de bajo impacto + bloque de rodilla corto", durationMin: 50, hasKneeBlock: "short", cardioMin: 40, strength: false },
  cardio: { kind: "cardio", label: "Cardio de bajo impacto", durationMin: 35, hasKneeBlock: "none", cardioMin: 35, strength: false },
  cardio_long: { kind: "cardio_long", label: "Cardio largo de bajo impacto", durationMin: 50, hasKneeBlock: "none", cardioMin: 50, strength: false },
  mobility: { kind: "mobility", label: "Descanso activo: movilidad y estiramientos", durationMin: 25, hasKneeBlock: "none", cardioMin: 0, strength: false },
};

/** Mapea los días de fuerza (0=dom…6=sáb) a tipos de sesión; los demás días son cardio, cardio largo (sáb) o movilidad (dom). */
export function weekPlan(trainingDays: number[]): Record<number, SessionKind> {
  const days = [...trainingDays].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)); // lunes primero
  const plan: Record<number, SessionKind> = {};
  days.forEach((d, i) => (plan[d] = STRENGTH_ORDER[i % STRENGTH_ORDER.length]));
  for (let d = 0; d < 7; d++) {
    if (plan[d]) continue;
    plan[d] = d === 0 ? "mobility" : d === 6 ? "cardio_long" : "cardio_knee";
  }
  return plan;
}

export const legDaysOf = (trainingDays: number[]): number[] => {
  const plan = weekPlan(trainingDays);
  return Object.entries(plan)
    .filter(([, k]) => k === "leg_a" || k === "leg_b")
    .map(([d]) => Number(d));
};

export const sessionForDay = (trainingDays: number[], weekdayIdx: number): SessionKind => weekPlan(trainingDays)[weekdayIdx];
