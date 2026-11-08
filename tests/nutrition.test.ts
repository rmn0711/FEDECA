import { describe, expect, it } from "vitest";
import {
  adjustedWeightKg, bmi, bmr, carbCycleForWeek, fatLossTargets, idealWeightKg, kcalPerSlot, milestones, movingAverage7,
  navyBodyFat, needsProteinRecalc, projectGoalDate, proteinPerSlot, proteinShortfallAlert, rapidLossWarning, MIN_KCAL_FAT_LOSS,
} from "@/lib/nutrition/calc";
import { expectedGainRange, gestationalWeek, iomCategory, pregnancyTargets, trimesterOf } from "@/lib/nutrition/pregnancy";
import { num, parseNum, time12 } from "@/lib/format";

describe("formato Colombia", () => {
  it("usa coma decimal y punto de miles", () => {
    expect(num(1234.5, 1)).toBe("1.234,5");
    expect(num(93.1, 1)).toBe("93,1");
    expect(parseNum("93,5")).toBe(93.5);
    expect(time12("13:00")).toBe("1:00 p. m.");
  });
});

describe("Jose: pérdida de grasa", () => {
  const base = { weightKg: 123, heightCm: 178, age: 35, sex: "male" as const, trainingDays: 4 };
  it("peso ajustado ≈ 93 kg y proteína ≈ 175 g", () => {
    const adj = adjustedWeightKg(123, 178, "male");
    expect(adj).toBeGreaterThan(92.5);
    expect(adj).toBeLessThan(93.7);
    expect(idealWeightKg(178, "male")).toBeCloseTo(73.2, 0);
    expect(fatLossTargets(base).proteinG).toBe(175);
  });
  it("Mifflin-St Jeor", () => {
    expect(bmr(123, 178, 35, "male")).toBeCloseTo(2172.5, 1);
  });
  it("nunca baja de 1.800 kcal", () => {
    const t = fatLossTargets({ weightKg: 70, heightCm: 165, age: 60, sex: "female", trainingDays: 0, deficit: 750 });
    expect(t.kcal).toBe(MIN_KCAL_FAT_LOSS);
    expect(t.minApplied).toBe(true);
  });
  it("déficit entre 500 y 750", () => {
    expect(fatLossTargets({ ...base, deficit: 2000 }).deficit).toBe(750);
    expect(fatLossTargets({ ...base, deficit: 100 }).deficit).toBe(500);
  });
  it("reparte la proteína 30/30/40/30/30/20 con meta de 175 g", () => {
    expect(proteinPerSlot(175)).toEqual([30, 30, 40, 30, 30, 20]);
  });
  it("escala la proteína por toma en otras metas y suma exacto", () => {
    const s = proteinPerSlot(100);
    expect(s.reduce((a, b) => a + b, 0)).toBe(100);
  });
  it("post-cena ≤ 200 kcal", () => {
    expect(kcalPerSlot(2800, proteinPerSlot(175))[5]).toBeLessThanOrEqual(200);
  });
  it("recalcula proteína cada 3 kg", () => {
    expect(needsProteinRecalc(123, 120.5)).toBe(false);
    expect(needsProteinRecalc(123, 120)).toBe(true);
    expect(needsProteinRecalc(null, 120)).toBe(true);
  });
  it("ciclado de carbohidrato: semana sin cambio de calorías", () => {
    const c = carbCycleForWeek([1, 4]);
    const total = Object.values(c).reduce((a, d) => a + d.dayKcalDelta, 0);
    expect(Math.abs(total)).toBeLessThanOrEqual(3);
    expect(c[1].carbDeltaPerMealG).toBe(25);
    expect(c[2].dayKcalDelta).toBeLessThan(0);
  });
  it("alerta GLP-1: proteína corta 2 días seguidos", () => {
    expect(proteinShortfallAlert([{ proteinG: 120, targetG: 175 }, { proteinG: 130, targetG: 175 }])).toBe(true);
    expect(proteinShortfallAlert([{ proteinG: 120, targetG: 175 }, { proteinG: 172, targetG: 175 }])).toBe(false);
  });
});

describe("antropometría", () => {
  it("IMC y % de grasa de la Marina", () => {
    expect(bmi(123, 178)).toBeCloseTo(38.8, 1);
    const bf = navyBodyFat({ sex: "male", heightCm: 178, waistCm: 120, neckCm: 43 })!;
    expect(bf).toBeGreaterThan(30);
    expect(bf).toBeLessThan(45);
    expect(navyBodyFat({ sex: "female", heightCm: 165, waistCm: 80, neckCm: 33, hipCm: null })).toBeNull();
  });
  it("promedio móvil 7 días", () => {
    const ma = movingAverage7([{ date: "2026-01-01", kg: 100 }, { date: "2026-01-03", kg: 98 }, { date: "2026-01-10", kg: 96 }]);
    expect(ma[1].kg).toBe(99);
    expect(ma[2].kg).toBe(96);
  });
  it("proyecta fecha de meta con tendencia a la baja", () => {
    const pts = Array.from({ length: 28 }, (_, i) => ({ date: new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10), kg: 123 - i * 0.1 }));
    const p = projectGoalDate(pts, 100)!;
    expect(p.kgPerWeek).toBeCloseTo(-0.7, 1);
    expect(p.date > "2026-04-01").toBe(true);
    expect(projectGoalDate(pts.map((x) => ({ ...x, kg: 120 })), 100)).toBeNull();
  });
  it("hitos −5/−10/−15 %", () => {
    const m = milestones(123, 115);
    expect(m.map((x) => x.reached)).toEqual([true, false, false]);
  });
  it("aviso por pérdida > 1,5 %/semana durante 3 semanas", () => {
    const day = (i: number) => new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);
    const fast = Array.from({ length: 35 }, (_, i) => ({ date: day(i), kg: 123 * Math.pow(0.98, i / 7) }));
    expect(rapidLossWarning(fast)).toBe(true);
    const slow = Array.from({ length: 35 }, (_, i) => ({ date: day(i), kg: 123 - i * 0.05 }));
    expect(rapidLossWarning(slow)).toBe(false);
  });
});

describe("embarazo", () => {
  it("semana y trimestre desde la FPP", () => {
    expect(gestationalWeek("2027-04-15", "2027-04-15")).toBe(40);
    expect(gestationalWeek("2027-04-15", "2026-11-08")).toBe(17);
    expect(trimesterOf(13)).toBe(1);
    expect(trimesterOf(14)).toBe(2);
    expect(trimesterOf(28)).toBe(3);
  });
  it("calorías: mantenimiento + 0/340/450, sin déficit y proteína ≥ 71 g", () => {
    const common = { weightKg: 60, heightCm: 163, age: 30, dueDate: "2027-04-15" };
    const t1 = pregnancyTargets({ ...common, today: "2026-09-20" }); // semana ~ 10
    const t2 = pregnancyTargets({ ...common, today: "2026-11-08" });
    const t3 = pregnancyTargets({ ...common, today: "2027-03-01" });
    expect([t1.trimester, t2.trimester, t3.trimester]).toEqual([1, 2, 3]);
    expect(t1.addKcal).toBe(0);
    expect(t2.addKcal).toBe(340);
    expect(t3.addKcal).toBe(450);
    expect(t1.proteinG).toBe(71);
    expect(pregnancyTargets({ ...common, weightKg: 80, today: "2026-11-08" }).proteinG).toBe(88);
    expect(t2.kcal).toBeGreaterThanOrEqual(1800);
  });
  it("rangos IOM", () => {
    expect(iomCategory(22).totalMin).toBe(11.5);
    expect(iomCategory(27).totalMax).toBe(11.5);
    expect(iomCategory(32).totalMin).toBe(5);
    const cat = iomCategory(22);
    expect(expectedGainRange(cat, 40)).toEqual({ min: 11.5, max: 16 });
    expect(expectedGainRange(cat, 13).max).toBeCloseTo(2, 5);
  });
});
