import { addDays } from "./format";
import type { MealLog } from "./types";

export interface DayStat {
  eaten: number;
  skipped: number;
  protein: number;
  kcal: number;
}

export function dayStats(logs: Pick<MealLog, "date" | "status" | "protein_g" | "kcal">[]): Record<string, DayStat> {
  const out: Record<string, DayStat> = {};
  for (const l of logs) {
    const s = (out[l.date] ??= { eaten: 0, skipped: 0, protein: 0, kcal: 0 });
    if (l.status === "eaten") {
      s.eaten++;
      s.protein += l.protein_g;
      s.kcal += l.kcal;
    } else s.skipped++;
  }
  return out;
}

/** Racha: días consecutivos con al menos `minMeals` tomas cumplidas. Si hoy aún no cumple, la racha cuenta desde ayer. */
export function streak(stats: Record<string, DayStat>, today: string, minMeals = 5): number {
  let d = (stats[today]?.eaten ?? 0) >= minMeals ? today : addDays(today, -1);
  let n = 0;
  while ((stats[d]?.eaten ?? 0) >= minMeals) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}
