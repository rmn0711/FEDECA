// Objetivos diarios por perfil (calorías, proteína, reparto por toma, carbohidrato ciclado).
import { weekday } from "../format";
import { legDaysOf } from "../exercise/plan";
import type { Profile, SlotId } from "../types";
import { SLOTS } from "../types";
import { bmi, carbCycleForWeek, fatLossTargets, GLP1_PORTION_FACTOR, kcalPerSlot, proteinPerSlot, waterGoalMl, MIN_KCAL_FAT_LOSS } from "./calc";
import { assignWorkoutSlots } from "./meals";
import { pregnancyTargets } from "./pregnancy";

export interface DayTargets {
  mode: Profile["mode"];
  kcal: number;
  proteinG: number;
  proteinSlots: number[];
  kcalSlots: number[];
  waterMl: number;
  /** solo fat_loss */
  preSlot: SlotId | null;
  postSlot: SlotId | null;
  isLegDay: boolean;
  carbDeltaPerMealG: number;
  /** factor de porción (GLP-1 → porciones más pequeñas) aplicado a kcal de carbohidrato/grasa */
  glp1: boolean;
  trimester?: 1 | 2 | 3;
  week?: number;
  addKcal?: number;
}

export function dayTargets(p: Profile, date: string, today = date): DayTargets {
  const weight = p.current_weight_kg ?? p.start_weight_kg ?? 70;
  if (p.mode === "pregnancy") {
    const t = pregnancyTargets({ weightKg: weight, heightCm: p.height_cm, age: p.age ?? 30, dueDate: p.due_date ?? "2027-04-15", today });
    const proteinSlots = proteinPerSlot(t.proteinG);
    return {
      mode: "pregnancy",
      kcal: t.kcal,
      proteinG: t.proteinG,
      proteinSlots,
      kcalSlots: kcalPerSlot(t.kcal, proteinSlots),
      waterMl: 2300,
      preSlot: null,
      postSlot: null,
      isLegDay: false,
      carbDeltaPerMealG: 0,
      glp1: false,
      trimester: t.trimester,
      week: t.week,
      addKcal: t.addKcal,
    };
  }
  const days = p.training_days.length;
  const base = fatLossTargets({ weightKg: weight, heightCm: p.height_cm, age: p.age ?? 35, sex: p.sex, trainingDays: days });
  const legDays = legDaysOf(p.training_days);
  const cycle = carbCycleForWeek(legDays)[weekday(date)];
  const isLeg = legDays.includes(weekday(date));
  // Nunca por debajo del mínimo seguro, ni siquiera en días de descanso compensados.
  const kcal = Math.max(MIN_KCAL_FAT_LOSS, base.kcal + cycle.dayKcalDelta);
  const proteinG = p.protein_anchor_weight_kg && p.protein_anchor_weight_kg - weight < 3 ? fatLossTargets({ weightKg: p.protein_anchor_weight_kg, heightCm: p.height_cm, age: p.age ?? 35, sex: p.sex, trainingDays: days }).proteinG : base.proteinG;
  const proteinSlots = proteinPerSlot(proteinG);
  const kcalSlots = kcalPerSlot(kcal, proteinSlots);
  const times = p.meal_times;
  const ws = isLeg && p.training_time ? assignWorkoutSlots(times, p.training_time) : { pre: null, post: null };
  if (isLeg) {
    const add = cycle.carbDeltaPerMealG * 4;
    if (ws.pre !== null) kcalSlots[ws.pre] += add;
    if (ws.post !== null) kcalSlots[ws.post] += add;
  }
  const finalKcalSlots = p.uses_glp1 ? kcalSlots.map((k, i) => (SLOTS[i].proteinOnly ? k : Math.round(k * GLP1_PORTION_FACTOR))) : kcalSlots;
  return {
    mode: "fat_loss",
    kcal,
    proteinG,
    proteinSlots,
    kcalSlots: finalKcalSlots,
    waterMl: waterGoalMl(weight),
    preSlot: ws.pre as SlotId | null,
    postSlot: ws.post as SlotId | null,
    isLegDay: isLeg,
    carbDeltaPerMealG: isLeg ? cycle.carbDeltaPerMealG : 0,
    glp1: p.uses_glp1,
  };
}

export const profileBmi = (p: Profile) => (p.current_weight_kg ? bmi(p.current_weight_kg, p.height_cm) : null);
