// Tipos compartidos de toda la aplicación.

export type ProfileMode = "fat_loss" | "pregnancy";
export type Sex = "male" | "female";

/* ───────────────────────── Comidas ───────────────────────── */

export type RecipeKind = "breakfast" | "snack" | "lunch" | "dinner" | "postdinner";
export type SlotId = 0 | 1 | 2 | 3 | 4 | 5;

export interface SlotDef {
  id: SlotId;
  key: string;
  label: string;
  kind: RecipeKind;
  defaultTime: string; // HH:MM
  proteinOnly: boolean;
}

export const SLOTS: SlotDef[] = [
  { id: 0, key: "desayuno", label: "Desayuno", kind: "breakfast", defaultTime: "07:00", proteinOnly: false },
  { id: 1, key: "media_manana", label: "Media mañana", kind: "snack", defaultTime: "10:00", proteinOnly: true },
  { id: 2, key: "almuerzo", label: "Almuerzo", kind: "lunch", defaultTime: "13:00", proteinOnly: false },
  { id: 3, key: "media_tarde", label: "Media tarde", kind: "snack", defaultTime: "16:00", proteinOnly: true },
  { id: 4, key: "cena", label: "Cena", kind: "dinner", defaultTime: "19:00", proteinOnly: false },
  { id: 5, key: "post_cena", label: "Post-cena", kind: "postdinner", defaultTime: "22:00", proteinOnly: true },
];

export const SLOT_IDS: SlotId[] = [0, 1, 2, 3, 4, 5];

/* ───────────────────────── Perfil ───────────────────────── */

export type TrainingPlace = "gym" | "home";

export interface Profile {
  id: string;
  household_id: string;
  slug: "jose" | "esposa";
  name: string;
  mode: ProfileMode;
  sex: Sex;
  age: number | null;
  height_cm: number;
  start_weight_kg: number | null;
  current_weight_kg: number | null;
  goal_weight_kg: number | null;
  pre_pregnancy_weight_kg: number | null;
  due_date: string | null; // ISO yyyy-mm-dd
  waist_cm: number | null;
  hip_cm: number | null;
  neck_cm: number | null;
  training_time: string | null; // HH:MM
  training_days: number[]; // 0 = domingo … 6 = sábado (días de fuerza)
  training_place: TrainingPlace | null;
  uses_glp1: boolean;
  /** Peso con el que se calculó la última meta de proteína (recalcula cada 3 kg). */
  protein_anchor_weight_kg: number | null;
  meal_times: string[]; // 6 horas HH:MM
  onboarding_done: boolean;
  medical_ack: boolean;
  created_at?: string;
}

/* ───────────────────────── Rodilla / ejercicio ───────────────────────── */

export type KneeDx =
  | "none"
  | "undiagnosed_pain"
  | "meniscus"
  | "acl"
  | "mcl"
  | "patellofemoral"
  | "osteoarthritis"
  | "patellar_tendinitis"
  | "post_surgery";

export type KneeSide = "right" | "left" | "both";
export type Phase = 1 | 2 | 3;

export interface KneeProfile {
  id: string;
  profile_id: string;
  household_id: string;
  side: KneeSide;
  diagnosis: KneeDx;
  surgery_type: string | null;
  surgery_months_ago: number | null;
  pain_rest: number;
  pain_stairs: number;
  pain_chair: number;
  ortho_clearance: boolean;
  start_date: string; // inicio del programa
  phase_override: Phase | null;
}

export type SessionKind =
  | "leg_a"
  | "leg_b"
  | "upper_a"
  | "upper_b"
  | "cardio"
  | "cardio_long"
  | "cardio_knee"
  | "mobility";

export type ExerciseGroup =
  | "warmup"
  | "knee_block"
  | "leg_a"
  | "leg_b"
  | "upper_a"
  | "upper_b"
  | "core"
  | "cardio"
  | "stretch"
  | "mobility";

export type RepUnit = "reps" | "seconds" | "minutes";

/** Clave de ilustración (pose base animada) usada por <ExerciseArt/>. */
export type ArtKey =
  | "quad_set"
  | "slr"
  | "tke"
  | "wall_sit"
  | "bridge"
  | "hip_thrust"
  | "clamshell"
  | "side_walk"
  | "calf_raise"
  | "single_leg_balance"
  | "sit_to_stand"
  | "leg_press"
  | "leg_curl"
  | "leg_extension"
  | "hip_adduction"
  | "hip_abduction"
  | "step_up"
  | "rdl"
  | "single_leg_bridge"
  | "spanish_squat"
  | "chest_press"
  | "seated_row"
  | "shoulder_press"
  | "biceps_curl"
  | "lat_pulldown"
  | "incline_press"
  | "db_row"
  | "triceps_ext"
  | "dead_bug"
  | "bird_dog"
  | "incline_plank"
  | "pallof"
  | "bike"
  | "elliptical"
  | "walk"
  | "swim"
  | "stretch_quad"
  | "stretch_ham"
  | "stretch_calf"
  | "stretch_hip_flexor"
  | "stretch_glute"
  | "mobility_hip"
  | "mobility_ankle"
  | "cat_cow"
  | "generic";

export interface RomLimit {
  /** Grados de flexión de rodilla (0 = extensión completa). */
  minDeg: number;
  maxDeg: number;
}

export interface Exercise {
  slug: string;
  name: string;
  groups: ExerciseGroup[];
  muscles: string[];
  equipment: string[];
  homeOk: boolean;
  /** Series, repeticiones (rango) y unidad. */
  sets: number;
  repsMin: number;
  repsMax: number;
  unit: RepUnit;
  restSec: number;
  tempo: string; // p. ej. "3-1-2-0"
  /** Impacto: siempre "none" o "low" en este programa. */
  impact: "none" | "low";
  isometric: boolean;
  unilateral: boolean;
  /** Fase mínima en la que el ejercicio se habilita. */
  minPhase: Phase;
  /** Sin carga externa progresable (se progresa por tiempo / repeticiones). */
  bodyweight: boolean;
  /** Diagnósticos para los que el ejercicio queda BLOQUEADO. */
  blockedFor: KneeDx[];
  /** Rango seguro general de flexión de rodilla (null = no aplica / sin flexión de rodilla). */
  safeRom: RomLimit | null;
  /** Rangos más restrictivos por diagnóstico (sustituyen a safeRom). */
  romByDx?: Partial<Record<KneeDx, RomLimit>>;
  safeRomText: string;
  cues: [string, string, string];
  easier: string;
  harder: string;
  /** Slug del ejercicio al que se regresa automáticamente si hay dolor ≥ 6. */
  regressionSlug: string | null;
  /** Slug del ejercicio al que se progresa. */
  progressionSlug: string | null;
  art: ArtKey;
}

export interface WorkoutSession {
  id: string;
  household_id: string;
  profile_id: string;
  date: string;
  kind: SessionKind;
  phase: Phase;
  started_at: string | null;
  ended_at: string | null;
  pain_before: number | null;
  pain_after: number | null;
  pain_next_day: number | null;
  swelling_next_day: boolean | null;
  notes: string | null;
}

export interface WorkoutSet {
  id: string;
  household_id: string;
  profile_id: string;
  session_id: string;
  date: string;
  exercise_slug: string;
  set_no: number;
  weight_kg: number | null;
  reps: number | null;
  rpe: number | null;
  knee_pain: number | null;
}

export interface KneePainLog {
  id: string;
  household_id: string;
  profile_id: string;
  date: string;
  context: "rest" | "stairs" | "chair" | "before" | "during" | "next_day";
  pain: number;
  swelling: boolean;
  alarm: string | null;
  session_id: string | null;
}

/* ───────────────────────── Seguimiento ───────────────────────── */

export interface WeightLog {
  id: string;
  household_id: string;
  profile_id: string;
  date: string;
  weight_kg: number;
}

export interface Measurement {
  id: string;
  household_id: string;
  profile_id: string;
  date: string;
  waist_cm: number | null;
  hip_cm: number | null;
  neck_cm: number | null;
  arm_cm: number | null;
  thigh_cm: number | null;
}

export interface DailyCheck {
  id: string;
  household_id: string;
  profile_id: string;
  date: string;
  water_ml: number;
  steps: number | null;
  sleep_h: number | null;
  trained: boolean;
  notes: string | null;
}

export interface MealLog {
  id: string;
  household_id: string;
  profile_id: string;
  date: string;
  slot: SlotId;
  recipe_slug: string;
  status: "eaten" | "skipped";
  eaten_at: string | null; // HH:MM real
  protein_g: number;
  kcal: number;
  portion_factor: number;
}

export interface MenuOverride {
  id: string;
  household_id: string;
  date: string;
  slot: SlotId;
  recipe_slug: string;
  reason: string | null;
}

export interface AlcoholLog {
  id: string;
  household_id: string;
  profile_id: string;
  date: string;
  drink_key: string;
  mixer_key: string | null;
  qty: number;
  kcal: number;
  std_drinks: number;
}

export interface SymptomNote {
  id: string;
  household_id: string;
  profile_id: string;
  date: string;
  note: string;
}
