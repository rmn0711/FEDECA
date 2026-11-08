// Protección de rodilla: regla del dolor, fases, disponibilidad de ejercicios, doble progresión y armado de sesiones.
import { EXERCISES, EXERCISE_BY_SLUG } from "@/data/exercises";
import { daysBetween } from "../format";
import type { Exercise, KneeDx, KneeProfile, Phase, RomLimit, SessionKind } from "../types";
import { SESSION_INFO } from "./plan";

export const DX_LABEL: Record<KneeDx, string> = {
  none: "Ninguno",
  undiagnosed_pain: "Dolor sin diagnóstico",
  meniscus: "Menisco",
  acl: "Ligamento cruzado anterior (LCA)",
  mcl: "Ligamento colateral medial (LCM)",
  patellofemoral: "Condromalacia / dolor patelofemoral",
  osteoarthritis: "Artrosis",
  patellar_tendinitis: "Tendinitis rotuliana",
  post_surgery: "Operado",
};

/* ───────────── Regla del dolor ───────────── */

export type PainAction = "continue" | "reduce" | "regress";

export function painAction(pain: number, swellingNextDay = false): PainAction {
  if (pain >= 6 || swellingNextDay) return "regress";
  if (pain >= 4) return "reduce";
  return "continue";
}

export const PAIN_MESSAGES: Record<PainAction, string> = {
  continue: "Dolor de 0 a 3: puedes continuar con normalidad.",
  reduce: "Dolor de 4 a 5: baja la carga o el rango de movimiento en la siguiente sesión.",
  regress: "Dolor de 6 o más (o hinchazón al día siguiente): se regresa el ejercicio a una versión más fácil.",
};

export const ALARM_SIGNS = [
  { key: "locking", label: "La rodilla se bloquea" },
  { key: "giving_way", label: "La rodilla se va o falla" },
  { key: "swelling", label: "Hinchazón marcada" },
  { key: "no_weight", label: "No puedes apoyar el peso" },
] as const;

export const ALARM_MESSAGE = "Para ya y consulta a un ortopedista o fisioterapeuta antes de seguir entrenando. No continúes la sesión.";

/** Si el dolor es ≥ 6 (o hay hinchazón) durante 7 días o más, recomendar ortopedista. */
export function recommendSpecialist(logs: { date: string; pain: number; swelling: boolean }[], today: string): boolean {
  const recent = logs.filter((l) => daysBetween(l.date, today) <= 7 && daysBetween(l.date, today) >= 0);
  if (!recent.length) return false;
  const bad = recent.filter((l) => l.pain >= 6 || l.swelling);
  if (!bad.length) return false;
  const first = bad.map((l) => l.date).sort()[0];
  return daysBetween(first, today) >= 6 && bad.length >= 2;
}

/* ───────────── Fases ───────────── */

export function phaseFor(knee: Pick<KneeProfile, "start_date" | "phase_override" | "diagnosis" | "ortho_clearance">, today: string): Phase {
  if (knee.phase_override) return knee.phase_override;
  const weeks = Math.floor(daysBetween(knee.start_date, today) / 7) + 1; // semana 1 = primeros 7 días
  let phase: Phase = weeks <= 4 ? 1 : weeks <= 8 ? 2 : 3;
  if (knee.diagnosis === "post_surgery" && !knee.ortho_clearance) phase = 1;
  return phase;
}

export const programWeek = (startDate: string, today: string) => Math.max(1, Math.floor(daysBetween(startDate, today) / 7) + 1);

export const PHASE_INFO: Record<Phase, { name: string; weeks: string; rpe: [number, number]; focus: string }> = {
  1: { name: "Adaptación", weeks: "semanas 1–4", rpe: [5, 6], focus: "Isométricos, máquinas y cargas livianas." },
  2: { name: "Fuerza", weeks: "semanas 5–8", rpe: [6, 7], focus: "Más carga; entran los step-ups y el peso muerto rumano." },
  3: { name: "Fuerza avanzada", weeks: "semana 9 en adelante", rpe: [7, 8], focus: "Unilaterales con carga y más rango si no hay dolor." },
};

/** Trote solo en fase 3, con 4 semanas sin dolor mayor a 3, IMC < 32 y aval del ortopedista. */
export function jogEligible(p: { phase: Phase; weeksWithoutPainOver3: number; bmi: number; orthoClearance: boolean }) {
  const reasons: string[] = [];
  if (p.phase < 3) reasons.push("Aún no estás en la fase 3.");
  if (p.weeksWithoutPainOver3 < 4) reasons.push("Necesitas 4 semanas sin dolor mayor a 3.");
  if (p.bmi >= 32) reasons.push("El IMC debe ser menor a 32.");
  if (!p.orthoClearance) reasons.push("Falta el aval del ortopedista.");
  return { eligible: reasons.length === 0, reasons };
}

/** Semanas consecutivas hacia atrás sin dolor > 3 (por logs diarios). */
export function weeksWithoutPainOver3(logs: { date: string; pain: number }[], today: string): number {
  const bad = logs.filter((l) => l.pain > 3).map((l) => l.date).sort();
  const last = bad[bad.length - 1];
  if (!last) {
    const first = logs.map((l) => l.date).sort()[0];
    return first ? Math.floor(daysBetween(first, today) / 7) : 0;
  }
  return Math.floor(daysBetween(last, today) / 7);
}

/* ───────────── Disponibilidad por diagnóstico ───────────── */

export interface Availability {
  available: boolean;
  reason?: string;
  rom: RomLimit | null;
  /** ejercicio sustituto sugerido cuando está bloqueado */
  fallback?: Exercise;
}

/** Tope extra de flexión por fase para ejercicios de cadena cerrada con carga (prensa). */
const PHASE_ROM_CAP: Record<string, Partial<Record<Phase, number>>> = {
  "prensa-piernas-rango-protegido": { 1: 45, 2: 60 },
  "prensa-una-pierna": { 3: 60 },
};

export function romFor(ex: Exercise, dx: KneeDx, phase?: Phase): RomLimit | null {
  const base = ex.romByDx?.[dx] ?? ex.safeRom;
  const cap = phase ? PHASE_ROM_CAP[ex.slug]?.[phase] : undefined;
  if (!base || cap === undefined) return base;
  return { minDeg: base.minDeg, maxDeg: Math.min(base.maxDeg, cap) };
}

/** Ejercicios que se quitan solos si ya hay dolor al subir escaleras o al levantarse de una silla (≥ 4). */
const PAIN_SENSITIVE = ["prensa-piernas-rango-protegido", "prensa-una-pierna", "extension-cuadriceps-90-45", "step-up-cajon-bajo"];

export function isExcluded(slug: string, knee: Pick<KneeProfile, "excluded_exercises" | "pain_stairs" | "pain_chair">): { excluded: boolean; reason?: string } {
  if (knee.excluded_exercises?.includes(slug)) return { excluded: true, reason: "Lo quitaste de tu rutina porque te molesta." };
  if (PAIN_SENSITIVE.includes(slug) && (knee.pain_stairs >= 4 || knee.pain_chair >= 4)) return { excluded: true, reason: "Con dolor de 4 o más al subir escaleras o levantarte, este ejercicio queda fuera por ahora." };
  return { excluded: false };
}

export function availability(ex: Exercise, knee: Pick<KneeProfile, "diagnosis" | "ortho_clearance"> & Partial<Pick<KneeProfile, "excluded_exercises" | "pain_stairs" | "pain_chair">>, phase: Phase): Availability {
  const rom = romFor(ex, knee.diagnosis, phase);
  const ex2 = isExcluded(ex.slug, { excluded_exercises: knee.excluded_exercises ?? [], pain_stairs: knee.pain_stairs ?? 0, pain_chair: knee.pain_chair ?? 0 });
  if (ex2.excluded) return { available: false, reason: ex2.reason, rom, fallback: ex.regressionSlug ? EXERCISE_BY_SLUG[ex.regressionSlug] : undefined };
  if (ex.minPhase > phase) return { available: false, reason: `Se habilita en la fase ${ex.minPhase}.`, rom, fallback: ex.regressionSlug ? EXERCISE_BY_SLUG[ex.regressionSlug] : undefined };
  if (ex.blockedFor.includes(knee.diagnosis)) return { available: false, reason: `Bloqueado por tu diagnóstico (${DX_LABEL[knee.diagnosis].toLowerCase()}).`, rom, fallback: ex.regressionSlug ? EXERCISE_BY_SLUG[ex.regressionSlug] : undefined };
  // Cirugía / LCA sin aval: la extensión de cuádriceps y los ejercicios unilaterales con carga quedan bloqueados.
  if ((knee.diagnosis === "post_surgery" || knee.diagnosis === "acl") && !knee.ortho_clearance && (ex.slug === "extension-cuadriceps-90-45" || ex.slug === "prensa-una-pierna")) {
    return { available: false, reason: "Requiere aval de tu ortopedista o fisioterapeuta.", rom, fallback: ex.regressionSlug ? EXERCISE_BY_SLUG[ex.regressionSlug] : undefined };
  }
  return { available: true, rom };
}

/* ───────────── Doble progresión ───────────── */

export interface SetRecord {
  weight_kg: number | null;
  reps: number | null;
  rpe: number | null;
  knee_pain: number | null;
}
export interface SessionSets {
  date: string;
  sets: SetRecord[];
}

export type ProgressionAction = "increase" | "hold" | "reduce" | "regress";
export interface Progression {
  action: ProgressionAction;
  nextWeightKg: number | null;
  message: string;
}

const roundKg = (v: number) => Math.round(v / 1.25) * 1.25;

const completed = (s: SessionSets, ex: Exercise) =>
  s.sets.length >= ex.sets && s.sets.every((x) => (x.reps ?? 0) >= ex.repsMax) && s.sets.every((x) => (x.rpe ?? 10) <= 7) && s.sets.every((x) => (x.knee_pain ?? 0) <= 3);

/**
 * Doble progresión. Sube 5–10 % de carga cuando completa todas las repeticiones con RPE ≤ 7 y dolor ≤ 3 en 2 sesiones seguidas.
 * Dolor 4–5: baja carga. Dolor ≥ 6: regresión del ejercicio.
 * `history` va de la más reciente a la más antigua.
 */
export function nextProgression(ex: Exercise, history: SessionSets[], opts: { swellingNextDay?: boolean } = {}): Progression {
  const last = history[0];
  if (!last || !last.sets.length) return { action: "hold", nextWeightKg: null, message: "Primera vez: empieza liviano y registra tus series." };
  const maxPain = Math.max(...last.sets.map((s) => s.knee_pain ?? 0));
  const weights = last.sets.map((s) => s.weight_kg ?? 0);
  const w = Math.max(...weights);
  const act = painAction(maxPain, opts.swellingNextDay);
  if (act === "regress") return { action: "regress", nextWeightKg: w ? roundKg(w * 0.7) : null, message: `Dolor ${maxPain}: pasa a una versión más fácil${ex.regressionSlug ? ` (${EXERCISE_BY_SLUG[ex.regressionSlug]?.name})` : ""}. Si persiste una semana, consulta a un ortopedista o fisioterapeuta.` };
  if (act === "reduce") return { action: "reduce", nextWeightKg: w ? roundKg(w * 0.9) : null, message: "Dolor 4–5: baja 10 % la carga o reduce el rango en la próxima sesión." };
  if (history.length >= 2 && completed(history[0], ex) && completed(history[1], ex) && !ex.isometric && !ex.bodyweight && w > 0) {
    const pct = w >= 40 ? 0.05 : 0.1;
    return { action: "increase", nextWeightKg: roundKg(w * (1 + pct)), message: `Completaste todas las repeticiones con RPE ≤ 7 y dolor ≤ 3 en 2 sesiones: sube ${Math.round(pct * 100)} %.` };
  }
  if (ex.isometric && history.length >= 2 && completed(history[0], ex) && completed(history[1], ex)) {
    return { action: "increase", nextWeightKg: null, message: "Suma 5 segundos a la duración o una serie más de forma gradual." };
  }
  return { action: "hold", nextWeightKg: w || null, message: "Mantén la carga hasta completar todas las repeticiones con RPE ≤ 7 en 2 sesiones seguidas." };
}

/* ───────────── Pasos ───────────── */

/** Base = promedio de la primera semana; +1.000 pasos por semana hasta 8.000–10.000. */
export function stepGoal(baselineAvg: number, weeksSinceBaseline: number): number {
  const raw = baselineAvg + 1000 * Math.max(0, weeksSinceBaseline);
  const floor = Math.min(raw, 10000);
  return Math.round(floor / 100) * 100;
}

/** Meta progresiva de minutos de cardio por semana (150 → 250). */
export function cardioWeeklyGoal(programWeekNo: number): number {
  return Math.min(250, 150 + Math.max(0, programWeekNo - 1) * 10);
}

/* ───────────── Armado de sesión ───────────── */

export interface PlannedExercise {
  exercise: Exercise;
  section: "Calentamiento" | "Bloque de rodilla" | "Fortalecimiento" | "Core" | "Cardio" | "Estiramientos" | "Movilidad";
  rom: RomLimit | null;
  note?: string;
  sets: number;
  repsLabel: string;
}

const KNEE_SHORT = ["cuadriceps-isometrico", "elevacion-pierna-recta", "extension-terminal-rodilla-banda", "puente-de-gluteo", "clamshell-banda", "equilibrio-una-pierna"];
const CORE_MAIN = ["dead-bug", "bird-dog", "plancha-inclinada-banco", "pallof-press"];
const STRETCH_ALL = ["estiramiento-cuadriceps", "estiramiento-isquiotibiales", "estiramiento-pantorrillas", "estiramiento-flexores-cadera", "estiramiento-gluteo-figura-4"];
const MAIN_BY_KIND: Partial<Record<SessionKind, string[]>> = {
  leg_a: ["sentarse-y-pararse-banco-alto", "prensa-piernas-rango-protegido", "curl-femoral-maquina", "extension-cuadriceps-90-45", "aduccion-maquina", "abduccion-maquina"],
  leg_b: ["step-up-cajon-bajo", "peso-muerto-rumano-mancuernas", "puente-a-una-pierna", "curl-femoral-acostado", "sentadilla-espanola-isometrica", "hip-thrust"],
  upper_a: ["press-pecho-maquina", "remo-sentado-maquina", "press-hombro-sentado", "curl-biceps-sentado"],
  upper_b: ["jalon-al-pecho", "press-inclinado-mancuernas", "remo-mancuerna-apoyo", "extension-triceps"],
};

export function repsLabel(ex: Exercise): string {
  const u = ex.unit === "seconds" ? " s" : ex.unit === "minutes" ? " min" : "";
  return ex.repsMin === ex.repsMax ? `${ex.repsMin}${u}` : `${ex.repsMin}–${ex.repsMax}${u}`;
}

export function buildSession(kind: SessionKind, knee: Parameters<typeof availability>[1], phase: Phase): PlannedExercise[] {
  const info = SESSION_INFO[kind];
  const out: PlannedExercise[] = [];
  const add = (slug: string, section: PlannedExercise["section"], opts: { sets?: number } = {}) => {
    let ex = EXERCISE_BY_SLUG[slug];
    if (!ex) return;
    const av = availability(ex, knee, phase);
    let note: string | undefined;
    if (!av.available) {
      if (av.fallback && availability(av.fallback, knee, phase).available) {
        note = `${av.reason} Se usa ${av.fallback.name}.`;
        ex = av.fallback;
      } else return;
    }
    if (out.some((o) => o.exercise.slug === ex.slug)) return;
    out.push({ exercise: ex, section, rom: romFor(ex, knee.diagnosis, phase), note, sets: opts.sets ?? ex.sets, repsLabel: repsLabel(ex) });
  };

  if (kind === "mobility") {
    ["gato-camello", "rotacion-toracica", "movilidad-cadera-90-90", "respiracion-diafragmatica-rodillas", "caminata-suave-recuperacion"].forEach((s) => add(s, "Movilidad"));
    return out;
  }
  if (info.strength || info.hasKneeBlock !== "none" || kind.startsWith("cardio")) {
    ["bici-calentamiento", "movilidad-cadera-circulos", "movilidad-tobillo", "circuito-activacion"].forEach((s) => add(s, "Calentamiento"));
  }
  if (info.hasKneeBlock === "full") {
    ["cuadriceps-isometrico", "elevacion-pierna-recta", "extension-terminal-rodilla-banda", "sentadilla-isometrica-pared", phase >= 2 ? "hip-thrust" : "puente-de-gluteo", "clamshell-banda", "caminata-lateral-banda", "elevacion-de-talones", "equilibrio-una-pierna"].forEach((s) => add(s, "Bloque de rodilla"));
  } else if (info.hasKneeBlock === "short") {
    KNEE_SHORT.forEach((s) => add(s, "Bloque de rodilla"));
  }
  (MAIN_BY_KIND[kind] ?? []).forEach((s) => add(s, "Fortalecimiento"));
  if (kind === "leg_a" || kind === "leg_b") CORE_MAIN.forEach((s) => add(s, "Core"));
  if (info.strength && kind.startsWith("upper")) CORE_MAIN.slice(0, 2).forEach((s) => add(s, "Core"));
  if (info.cardioMin > 0) add(kind === "cardio_long" ? "caminata-plano" : "bicicleta-estatica", "Cardio");
  if (info.strength || info.cardioMin > 0) STRETCH_ALL.forEach((s) => add(s, "Estiramientos"));
  return out;
}

/** Cada kilo perdido ≈ 4 kg menos de carga por paso. */
export const kneeLoadText = (kgLost: number) => Math.max(0, kgLost) * 4;

export const KNEE_PRINCIPLES = [
  "Cero impacto en las fases 1 y 2: sin saltos, trote, burpees, step aerobics, cambios bruscos de dirección ni escaleras rápidas.",
  "Sin sentadillas profundas con carga, sin zancadas con carga y sin apoyar las rodillas en superficies duras.",
  "Tren superior sentado o con apoyo para no cargar la rodilla de pie.",
  "Registra el dolor antes, durante y al día siguiente de cada sesión.",
];

export const ALL_EXERCISES = EXERCISES;
