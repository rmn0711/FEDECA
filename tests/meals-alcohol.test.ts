import { describe, expect, it } from "vitest";
import { assignWorkoutSlots, defaultMealTimes, redistributeProtein, rescheduleDay } from "@/lib/nutrition/meals";
import { adjustSlotsForAlcohol, alcoholBlockedByLegDay, alcoholStatus, DRINKS, entryKcal, entryStd, MIXERS } from "@/lib/nutrition/alcohol";
import { CAFFEINE_ITEMS, caffeineStatus, caffeineTotal, pregnancyView } from "@/lib/nutrition/safety";
import { RECIPE_BY_SLUG } from "@/data/recipes";

describe("horario de comidas", () => {
  const base = defaultMealTimes();
  it("registro tardío corre las siguientes 3 h", () => {
    const r = rescheduleDay(base, [{ eatenAt: "07:00" }, { eatenAt: "10:40" }]);
    expect(r[2].time).toBe("13:40");
    expect(r[3].time).toBe("16:40");
    expect(r[4].time).toBe("19:40");
    expect(r[5].time).toBe("22:40");
  });
  it("no pasa de las 11:00 p. m. y marca como descartadas las que no caben", () => {
    const r = rescheduleDay(base, [{ eatenAt: "09:00" }, { eatenAt: "12:30" }, { eatenAt: "16:00" }]);
    expect(r[3].time).toBe("19:00");
    expect(r[4].time).toBe("22:00");
    expect(r[5].dropped).toBe(true);
    const late = rescheduleDay(base, [{ eatenAt: "07:00" }, { eatenAt: "10:00" }, { eatenAt: "15:00" }, { eatenAt: "18:30" }]);
    expect(late[4].time).toBe("21:30");
    expect(late[5].dropped).toBe(true);
    expect(late[5].time <= "23:00").toBe(true);
  });
  it("redistribuye la proteína de una toma omitida (máx. 45 g)", () => {
    const r = redistributeProtein([30, 30, 40, 30, 30, 20], [false, false, false, true, false, false], [0, 1, 2]);
    expect(r.targets[3]).toBe(0);
    expect(Math.max(...r.targets)).toBeLessThanOrEqual(45);
    expect(r.targets.reduce((a, b) => a + b, 0) + r.unallocated).toBe(180);
    const over = redistributeProtein([30, 30, 40, 30, 30, 20], [false, false, true, true, true, false], [0, 1]);
    expect(over.unallocated).toBeGreaterThan(0);
    expect(over.targets[5]).toBe(45);
  });
  it("pre y post entreno", () => {
    const w = assignWorkoutSlots(base, "17:30"); // 16:00 queda 90 min antes
    expect(w.pre).toBe(3);
    expect(w.post).toBe(4); // sesión termina 18:45; cena 19:00
  });
});

describe("alcohol", () => {
  it("equivalencias", () => {
    expect(DRINKS.map((d) => d.key)).toEqual(expect.arrayContaining(["cerveza", "cerveza_light", "vino", "whisky", "ron", "aguardiente", "tequila"]));
    const gaseosa = MIXERS.find((m) => m.key === "gaseosa")!;
    const ron = DRINKS.find((d) => d.key === "ron")!;
    expect(entryKcal(ron, gaseosa, 2)).toBe((105 + 140) * 2);
    expect(entryStd(ron, 2)).toBe(2);
    expect(gaseosa.sugary).toBe(true);
  });
  it("límites diario y semanal", () => {
    const e = (date: string, qty = 1) => ({ date, qty, kcal: 100, std_drinks: qty });
    const s = alcoholStatus([e("2026-11-09", 3), e("2026-11-10", 2), e("2026-11-11", 2), e("2026-11-12", 1)], "2026-11-09");
    expect(s.overDay).toBe(true);
    expect(s.overWeek).toBe(true);
    expect(s.dryDays).toBe(3);
    expect(s.tooFewDryDays).toBe(false);
  });
  it("bloquea el día antes y el día de pierna", () => {
    // lunes=1 y jueves=4: 2026-11-09 es lunes
    expect(alcoholBlockedByLegDay("2026-11-09", [1, 4]).blocked).toBe(true);
    expect(alcoholBlockedByLegDay("2026-11-08", [1, 4]).blocked).toBe(true);
    expect(alcoholBlockedByLegDay("2026-11-10", [1, 4]).blocked).toBe(false);
  });
  it("descuenta calorías de las tomas restantes sin quitar proteína", () => {
    const kcal = [600, 160, 1000, 160, 650, 130];
    const prot = [30, 30, 40, 30, 30, 20];
    const out = adjustSlotsForAlcohol(kcal, prot, [4, 5], 200);
    expect(kcal[4] + kcal[5] - (out[4] + out[5])).toBeCloseTo(200, 0);
    expect(out[5]).toBeGreaterThanOrEqual(prot[5] * 4.2 - 0.1);
  });
});

describe("seguridad embarazo", () => {
  it("cafeína: tope de 200 mg", () => {
    const tinto = CAFFEINE_ITEMS.find((i) => i.key === "tinto")!;
    expect(caffeineTotal([{ key: "tinto", qty: 2 }, { key: "cola", qty: 1 }])).toBe(tinto.mg * 2 + 34);
    expect(caffeineStatus(150)).toBe("ok");
    expect(caffeineStatus(170)).toBe("near");
    expect(caffeineStatus(210)).toBe("over");
  });
  it("sustituye queso costeño por campesino pasteurizado", () => {
    const r = RECIPE_BY_SLUG["breakfast-arepa-con-queso-costeno-y-huevo"];
    expect(r).toBeTruthy();
    const v = pregnancyView(r);
    expect(v.hasSubstitution).toBe(true);
    expect(v.lines.some((l) => l.line.food === "costeno")).toBe(false);
    expect(v.lines.some((l) => l.replacedFrom === "costeno" && l.line.food === "campesino")).toBe(true);
  });
  it("marca atún en lata con tope semanal", () => {
    const r = RECIPE_BY_SLUG["dinner-ensalada-de-atun-con-aguacate-y-lechuga"];
    expect(pregnancyView(r).limited.some((l) => l.family === "atun" && l.weeklyMax === 2)).toBe(true);
  });
});
