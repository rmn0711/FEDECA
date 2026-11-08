import { describe, expect, it } from "vitest";
import { cookStartTime, marinateReminder, MARINADES, prepForDay } from "@/lib/menu/prep";
import { addDays } from "@/lib/format";
import { defaultMealTimes } from "@/lib/nutrition/meals";
import { planWeek } from "@/lib/menu/planner";
import { RECIPE_BY_SLUG } from "@/data/recipes";
import type { Profile } from "@/lib/types";

const base = { household_id: "h", age: 35, height_cm: 170, start_weight_kg: 120, current_weight_kg: 120, goal_weight_kg: 100, waist_cm: null, hip_cm: null, neck_cm: null, training_time: "17:30", training_place: "gym" as const, uses_glp1: false, protein_anchor_weight_kg: 120, meal_times: defaultMealTimes(), onboarding_done: true, medical_ack: true };
const jose: Profile = { ...base, id: "j", slug: "jose", name: "Jose", mode: "fat_loss", sex: "male", pre_pregnancy_weight_kg: null, due_date: null, training_days: [1, 2, 4, 5] };
const yani: Profile = { ...base, id: "y", slug: "esposa", name: "Yanina", mode: "pregnancy", sex: "female", height_cm: 162, current_weight_kg: 63, start_weight_kg: null, pre_pregnancy_weight_kg: 58, due_date: "2027-04-15", training_days: [], training_time: null, training_place: null, protein_anchor_weight_kg: null };

describe("preparación de mañana", () => {
  it("empieza a cocinar con margen y redondea a 5 minutos", () => {
    expect(cookStartTime("13:00", 40)).toBe("12:10");
    expect(cookStartTime("07:00", 15)).toBe("06:35");
  });
  it("suma lo crudo de los dos y cada adobo trae ventana y hora límite", () => {
    let found = 0;
    for (let d = 0; d < 14; d++) {
      const date = addDays("2026-11-03", d);
      const prep = prepForDay({ date, profiles: [jose, yani], overrides: {}, today: "2026-11-02" });
      for (const m of prep.marinate) {
        found++;
        expect(MARINADES[m.foodKey]).toBeTruthy();
        expect(m.perPerson.map((p) => p.name)).toEqual(["Jose", "Yanina"]);
        expect(m.totalRawG).toBe(m.perPerson.reduce((a, p) => a + p.rawG, 0));
        expect(m.perPerson[0].rawG).toBeGreaterThan(m.perPerson[0].cookedG * 0.9); // crudo ≥ cocido
        expect(m.maxH).toBeGreaterThan(m.minH);
        if (m.when === "tonight") expect(m.marinateAt >= "21:00" && m.marinateAt <= "23:30").toBe(true);
        else expect(m.marinateAt >= "05:00" && m.marinateAt < "18:00").toBe(true);
        // nunca queda más tiempo adobado que el máximo
        const cookAbs = 1440 + Number(m.cookStart.slice(0, 2)) * 60 + Number(m.cookStart.slice(3));
        const atAbs = (m.when === "tonight" ? 0 : 1440) + Number(m.marinateAt.slice(0, 2)) * 60 + Number(m.marinateAt.slice(3));
        expect((cookAbs - atAbs) / 60).toBeLessThanOrEqual(m.maxH + 0.01);
      }
      expect(prep.pregnantNote).toBe(true);
      expect(prep.cook).toHaveLength(6);
      // el cronograma va ordenado por hora de inicio
      expect([...prep.cook].map((c) => c.cookStart)).toEqual([...prep.cook].map((c) => c.cookStart).sort());
    }
    expect(found).toBeGreaterThan(10);
  });
  it("las legumbres se remojan y el pescado adoba sin limón", () => {
    for (let d = 0; d < 56; d++) {
      const date = addDays("2026-11-03", d);
      const prep = prepForDay({ date, profiles: [jose], overrides: {}, today: date });
      for (const s of prep.soak) expect(["lentejas", "frijoles", "garbanzo"]).toContain(s.foodKey);
      for (const m of prep.marinate.filter((x) => ["bocachico", "mojarra", "robalo", "salmon", "camaron"].includes(x.foodKey))) expect(m.note).toMatch(/limón/);
    }
  });
  it("respeta los cambios de plato (overrides) del día", () => {
    const date = "2026-11-03";
    const slug = Object.values(planWeek(date))[0][2];
    const other = Object.keys(RECIPE_BY_SLUG).find((k) => k.startsWith("lunch-pollo") || (RECIPE_BY_SLUG[k].kind === "lunch" && RECIPE_BY_SLUG[k].family === "cerdo"))!;
    const prep = prepForDay({ date, profiles: [jose], overrides: { [`${date}:2`]: other }, today: date });
    expect(prep.cook.find((c) => c.slot === 2)!.recipeSlug).toBe(other);
    expect(slug).toBeTruthy();
  });
  it("arma el aviso de las 8 p. m.", () => {
    for (let d = 0; d < 7; d++) {
      const prep = prepForDay({ date: addDays("2026-11-03", d), profiles: [jose, yani], overrides: {}, today: "2026-11-02" });
      const r = marinateReminder(prep);
      if (prep.marinate.some((m) => m.when === "tonight")) expect(r!.body).toMatch(/g/);
    }
  });
});
