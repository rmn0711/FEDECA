import { describe, expect, it } from "vitest";
import { EXERCISES, EXERCISE_BY_SLUG } from "@/data/exercises";
import { availability, buildSession, cardioWeeklyGoal, jogEligible, nextProgression, painAction, phaseFor, recommendSpecialist, romFor, stepGoal, weeksWithoutPainOver3 } from "@/lib/exercise/knee";
import { legDaysOf, weekPlan } from "@/lib/exercise/plan";

describe("catálogo de ejercicios", () => {
  it("más de 60, slugs únicos, regresiones válidas y 3 claves", () => {
    expect(EXERCISES.length).toBeGreaterThan(60);
    expect(new Set(EXERCISES.map((e) => e.slug)).size).toBe(EXERCISES.length);
    for (const e of EXERCISES) {
      expect(e.cues).toHaveLength(3);
      if (e.regressionSlug) expect(EXERCISE_BY_SLUG[e.regressionSlug], e.slug).toBeTruthy();
      if (e.progressionSlug) expect(EXERCISE_BY_SLUG[e.progressionSlug], e.slug).toBeTruthy();
      expect(e.easier && e.harder && e.safeRomText).toBeTruthy();
      expect(["none", "low"]).toContain(e.impact);
      expect(/salto|trote|burpee|zancada/i.test(e.name)).toBe(false);
    }
  });
  it("reglas clave de rodilla", () => {
    expect(EXERCISE_BY_SLUG["extension-cuadriceps-90-45"].blockedFor).toContain("patellofemoral");
    expect(EXERCISE_BY_SLUG["sentadilla-espanola-isometrica"].blockedFor).toContain("patellofemoral");
    expect(EXERCISE_BY_SLUG["step-up-cajon-bajo"].minPhase).toBe(2);
    expect(EXERCISE_BY_SLUG["peso-muerto-rumano-mancuernas"].minPhase).toBe(2);
    expect(romFor(EXERCISE_BY_SLUG["prensa-piernas-rango-protegido"], "meniscus")!.maxDeg).toBeLessThanOrEqual(60);
  });
});

describe("regla del dolor", () => {
  it("0–3 continúa, 4–5 reduce, ≥6 o hinchazón regresa", () => {
    expect(painAction(3)).toBe("continue");
    expect(painAction(4)).toBe("reduce");
    expect(painAction(5)).toBe("reduce");
    expect(painAction(6)).toBe("regress");
    expect(painAction(2, true)).toBe("regress");
  });
  it("recomienda especialista si el dolor alto persiste una semana", () => {
    const logs = [{ date: "2026-11-01", pain: 7, swelling: false }, { date: "2026-11-04", pain: 6, swelling: true }, { date: "2026-11-07", pain: 6, swelling: false }];
    expect(recommendSpecialist(logs, "2026-11-08")).toBe(true);
    expect(recommendSpecialist([{ date: "2026-11-07", pain: 6, swelling: false }], "2026-11-08")).toBe(false);
  });
});

describe("fases y disponibilidad", () => {
  const knee = { start_date: "2026-11-02", phase_override: null, diagnosis: "none" as const, ortho_clearance: false };
  it("fases 1 (sem. 1–4), 2 (5–8) y 3 (9+)", () => {
    expect(phaseFor(knee, "2026-11-02")).toBe(1);
    expect(phaseFor(knee, "2026-11-29")).toBe(1);
    expect(phaseFor(knee, "2026-11-30")).toBe(2);
    expect(phaseFor(knee, "2026-12-27")).toBe(2);
    expect(phaseFor(knee, "2026-12-28")).toBe(3);
  });
  it("step-up y PDR se habilitan en fase 2; extensión bloqueada con patelofemoral", () => {
    const k = { diagnosis: "none" as const, ortho_clearance: false };
    expect(availability(EXERCISE_BY_SLUG["step-up-cajon-bajo"], k, 1).available).toBe(false);
    expect(availability(EXERCISE_BY_SLUG["step-up-cajon-bajo"], k, 2).available).toBe(true);
    expect(availability(EXERCISE_BY_SLUG["extension-cuadriceps-90-45"], { ...k, diagnosis: "patellofemoral" }, 3).available).toBe(false);
    expect(availability(EXERCISE_BY_SLUG["extension-cuadriceps-90-45"], { ...k, diagnosis: "post_surgery" }, 3).available).toBe(false);
  });
  it("el trote exige fase 3, 4 semanas sin dolor > 3, IMC < 32 y aval", () => {
    expect(jogEligible({ phase: 3, weeksWithoutPainOver3: 4, bmi: 31, orthoClearance: true }).eligible).toBe(true);
    expect(jogEligible({ phase: 3, weeksWithoutPainOver3: 4, bmi: 33, orthoClearance: true }).eligible).toBe(false);
    expect(jogEligible({ phase: 2, weeksWithoutPainOver3: 8, bmi: 28, orthoClearance: true }).eligible).toBe(false);
    expect(weeksWithoutPainOver3([{ date: "2026-10-01", pain: 5 }, { date: "2026-10-20", pain: 2 }], "2026-11-08")).toBe(5);
  });
});

describe("doble progresión", () => {
  const ex = EXERCISE_BY_SLUG["prensa-piernas-rango-protegido"];
  const session = (w: number, reps: number, rpe: number, pain: number) => ({ date: "d", sets: Array.from({ length: ex.sets }, () => ({ weight_kg: w, reps, rpe, knee_pain: pain })) });
  it("sube carga tras 2 sesiones completas con RPE ≤ 7 y dolor ≤ 3", () => {
    const r = nextProgression(ex, [session(60, ex.repsMax, 7, 2), session(60, ex.repsMax, 6, 1)]);
    expect(r.action).toBe("increase");
    expect(r.nextWeightKg).toBeGreaterThan(60);
    expect(r.nextWeightKg!).toBeLessThanOrEqual(60 * 1.1 + 1.25);
  });
  it("no sube con una sola sesión ni con RPE alto", () => {
    expect(nextProgression(ex, [session(60, ex.repsMax, 7, 2)]).action).toBe("hold");
    expect(nextProgression(ex, [session(60, ex.repsMax, 9, 2), session(60, ex.repsMax, 9, 2)]).action).toBe("hold");
  });
  it("dolor 4–5 baja y ≥ 6 regresa", () => {
    expect(nextProgression(ex, [session(60, 10, 7, 4)]).action).toBe("reduce");
    expect(nextProgression(ex, [session(60, 10, 7, 6)]).action).toBe("regress");
  });
  it("pasos: +1.000 por semana hasta 10.000", () => {
    expect(stepGoal(4000, 0)).toBe(4000);
    expect(stepGoal(4000, 3)).toBe(7000);
    expect(stepGoal(4000, 20)).toBe(10000);
    expect(cardioWeeklyGoal(1)).toBe(150);
    expect(cardioWeeklyGoal(30)).toBe(250);
  });
});

describe("estructura semanal y sesiones", () => {
  it("por defecto: lun pierna A, mar sup. A, mié cardio, jue pierna B, vie sup. B, sáb cardio largo, dom movilidad", () => {
    const p = weekPlan([1, 2, 4, 5]);
    expect([p[1], p[2], p[3], p[4], p[5], p[6], p[0]]).toEqual(["leg_a", "upper_a", "cardio_knee", "leg_b", "upper_b", "cardio_long", "mobility"]);
    expect(legDaysOf([1, 2, 4, 5])).toEqual([1, 4]);
  });
  it("la sesión de pierna en fase 1 no incluye step-up ni PDR y sí bloque de rodilla y core", () => {
    const s = buildSession("leg_b", { diagnosis: "none", ortho_clearance: false }, 1);
    const slugs = s.map((x) => x.exercise.slug);
    expect(slugs).not.toContain("step-up-cajon-bajo");
    expect(slugs).not.toContain("peso-muerto-rumano-mancuernas");
    expect(s.some((x) => x.section === "Bloque de rodilla")).toBe(true);
    expect(s.some((x) => x.section === "Core")).toBe(true);
    expect(s.some((x) => x.section === "Estiramientos")).toBe(true);
    expect(buildSession("leg_b", { diagnosis: "none", ortho_clearance: false }, 2).map((x) => x.exercise.slug)).toContain("step-up-cajon-bajo");
  });
  it("tren superior lleva versión corta del bloque de rodilla", () => {
    const s = buildSession("upper_a", { diagnosis: "none", ortho_clearance: false }, 1);
    const kb = s.filter((x) => x.section === "Bloque de rodilla");
    expect(kb.length).toBeGreaterThan(0);
    expect(kb.length).toBeLessThan(buildSession("leg_a", { diagnosis: "none", ortho_clearance: false }, 1).filter((x) => x.section === "Bloque de rodilla").length);
  });
  it("con patelofemoral la extensión se sustituye o se omite", () => {
    const s = buildSession("leg_a", { diagnosis: "patellofemoral", ortho_clearance: false }, 3);
    expect(s.map((x) => x.exercise.slug)).not.toContain("extension-cuadriceps-90-45");
  });
});
