// Estado completo de un día para un perfil: horario, porciones, redistribución y alcohol.
import { RECIPE_BY_SLUG } from "@/data/recipes";
import { adaptForPregnancy } from "./menu/adapt";
import { scaleRecipe, type Portion } from "./menu/core";
import { planDay, type OverrideMap } from "./menu/planner";
import { NO_PREFS, type FoodPrefs } from "./prefs";
import type { Recipe } from "./menu/types";
import { adjustSlotsForAlcohol } from "./nutrition/alcohol";
import { redistributeProtein, rescheduleDay, type ScheduledSlot } from "./nutrition/meals";
import { dayTargets, type DayTargets } from "./nutrition/targets";
import type { AlcoholLog, MealLog, Profile, SlotId } from "./types";
import { SLOTS } from "./types";

export interface SlotView {
  slot: SlotId;
  label: string;
  proteinOnly: boolean;
  time: string;
  baseTime: string;
  status: ScheduledSlot["status"];
  dropped: boolean;
  recipe: Recipe;
  proteinG: number;
  kcal: number;
  portion: Portion;
  log?: MealLog;
  isPre: boolean;
  isPost: boolean;
}

export interface DayState {
  targets: DayTargets;
  slots: SlotView[];
  eatenProtein: number;
  eatenKcal: number;
  doneCount: number;
  unallocatedProtein: number;
  alcoholKcal: number;
  next: SlotView | null;
}

export interface DayInput {
  profile: Profile;
  date: string;
  today: string;
  overrides: OverrideMap;
  logs: MealLog[]; // solo de ese perfil y fecha
  alcohol?: AlcoholLog[]; // del día
  prefs?: FoodPrefs;
}

export function computeDay({ profile, date, today, overrides, logs, alcohol = [], prefs = NO_PREFS }: DayInput): DayState {
  const targets = dayTargets(profile, date, today);
  const plan = planDay(date, overrides, prefs);
  const byslot = new Map(logs.map((l) => [l.slot, l]));
  const states = SLOTS.map((s) => {
    const l = byslot.get(s.id);
    return l ? { eatenAt: l.status === "eaten" ? l.eaten_at : null, skipped: l.status === "skipped" } : {};
  });
  const sched = rescheduleDay(profile.meal_times, states);
  const lost = sched.map((s) => s.status === "skipped" || s.dropped);
  const done = sched.map((s, i) => (s.status === "eaten" ? i : -1)).filter((i) => i >= 0);
  const redis = redistributeProtein(targets.proteinSlots, lost, done);
  const alcoholKcal = Math.round(alcohol.reduce((a, e) => a + e.kcal, 0));
  const pending = sched.filter((s) => s.status === "pending" && !s.dropped).map((s) => s.slot);
  const kcalSlots = alcoholKcal > 0 && pending.length ? adjustSlotsForAlcohol(targets.kcalSlots, redis.targets, pending, alcoholKcal) : targets.kcalSlots;

  const slots: SlotView[] = SLOTS.map((def, i) => {
    const base = RECIPE_BY_SLUG[plan[i]];
    const recipe = profile.mode === "pregnancy" ? adaptForPregnancy(base) : base;
    const log = byslot.get(def.id);
    const proteinG = redis.targets[i] > 0 ? redis.targets[i] : targets.proteinSlots[i];
    const portion = scaleRecipe(recipe, { proteinG, kcal: kcalSlots[i] });
    return {
      slot: def.id,
      label: def.label,
      proteinOnly: def.proteinOnly,
      time: sched[i].time,
      baseTime: sched[i].baseTime,
      status: sched[i].status,
      dropped: sched[i].dropped,
      recipe,
      proteinG,
      kcal: kcalSlots[i],
      portion,
      log,
      isPre: targets.preSlot === i,
      isPost: targets.postSlot === i,
    };
  });
  const eaten = logs.filter((l) => l.status === "eaten");
  return {
    targets,
    slots,
    eatenProtein: eaten.reduce((a, l) => a + l.protein_g, 0),
    eatenKcal: eaten.reduce((a, l) => a + l.kcal, 0),
    doneCount: sched.filter((s) => s.status === "eaten").length,
    unallocatedProtein: redis.unallocated,
    alcoholKcal,
    next: slots.find((s) => s.status === "pending" && !s.dropped) ?? null,
  };
}
