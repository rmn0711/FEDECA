"use client";
import { useMemo } from "react";
import { useApp } from "./app-context";
import { computeDay, type SlotView } from "./day";
import { addDays, weekStart } from "./format";
import { useTable } from "./hooks";
import { findSubstitute, planWeek, type OverrideMap } from "./menu/planner";
import { RECIPE_BY_SLUG } from "@/data/recipes";
import { dayStats, streak } from "./stats";
import type { AlcoholLog, DailyCheck, MealLog, MenuOverride } from "./types";

/** Datos y acciones del día de hoy para el perfil activo. */
export function useToday() {
  const { active, householdId, today, nowTime } = useApp();
  const ws = weekStart(today);
  const we = addDays(ws, 6);
  const from60 = addDays(today, -60);

  const ov = useTable<MenuOverride>("menu_overrides", { match: { household_id: householdId }, range: { col: "date", from: ws, to: we } });
  const logsQ = useTable<MealLog>("meal_logs", active ? { match: { profile_id: active.id }, range: { col: "date", from: from60, to: we } } : null, [active?.id]);
  const alc = useTable<AlcoholLog>("alcohol_logs", active ? { match: { profile_id: active.id }, range: { col: "date", from: ws, to: we } } : null, [active?.id]);
  const checks = useTable<DailyCheck>("daily_checks", active ? { match: { profile_id: active.id }, range: { col: "date", from: ws, to: we } } : null, [active?.id]);

  const overrides: OverrideMap = useMemo(() => Object.fromEntries(ov.rows.map((o) => [`${o.date}:${o.slot}`, o.recipe_slug])), [ov.rows]);
  const stats = useMemo(() => dayStats(logsQ.rows), [logsQ.rows]);
  const day = useMemo(() => {
    if (!active) return null;
    return computeDay({ profile: active, date: today, today, overrides, logs: logsQ.rows.filter((l) => l.date === today), alcohol: alc.rows.filter((a) => a.date === today) });
  }, [active, today, overrides, logsQ.rows, alc.rows]);
  const check = checks.rows.find((c) => c.date === today) ?? null;

  async function eat(s: SlotView, factor = 1) {
    if (!active) return;
    await logsQ.upsert(
      { household_id: householdId, profile_id: active.id, date: today, slot: s.slot, recipe_slug: s.recipe.slug, status: "eaten", eaten_at: nowTime, protein_g: Math.round(s.portion.macros.p * factor * 10) / 10, kcal: Math.round(s.portion.macros.kcal * factor), portion_factor: factor },
      ["profile_id", "date", "slot"],
    );
  }
  async function skip(s: SlotView) {
    if (!active) return;
    await logsQ.upsert({ household_id: householdId, profile_id: active.id, date: today, slot: s.slot, recipe_slug: s.recipe.slug, status: "skipped", eaten_at: null, protein_g: 0, kcal: 0, portion_factor: 0 }, ["profile_id", "date", "slot"]);
  }
  async function undo(s: SlotView) {
    if (s.log) await logsQ.remove(s.log.id!);
  }
  /** Cambia la receta por otra con macros equivalentes (el menú es compartido: aplica a los dos). */
  async function swap(s: SlotView): Promise<boolean> {
    const week = Object.values(planWeek(today, overrides)).flat();
    const base = RECIPE_BY_SLUG[s.recipe.slug];
    const sub = findSubstitute(base, week);
    if (!sub) return false;
    await ov.upsert({ household_id: householdId, date: today, slot: s.slot, recipe_slug: sub.slug, reason: "cambio" }, ["household_id", "date", "slot"]);
    return true;
  }
  async function addWater(ml: number) {
    if (!active) return;
    await checks.upsert({ household_id: householdId, profile_id: active.id, date: today, water_ml: Math.max(0, (check?.water_ml ?? 0) + ml) }, ["profile_id", "date"]);
  }
  async function saveCheck(patch: Partial<DailyCheck>) {
    if (!active) return;
    await checks.upsert({ household_id: householdId, profile_id: active.id, date: today, ...patch }, ["profile_id", "date"]);
  }

  return {
    day, stats, check, overrides, logs: logsQ.rows, alcohol: alc.rows, checks: checks.rows, ws, we,
    streak: streak(stats, today), loading: logsQ.loading || ov.loading,
    eat, skip, undo, swap, addWater, saveCheck, reloadAlcohol: alc.reload,
  };
}
