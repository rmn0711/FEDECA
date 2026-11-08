// Genera supabase/seed.sql (recetas + ejercicios) a partir del catálogo TypeScript.
// Uso: npm run seed:generate
import { writeFileSync } from "node:fs";
import { RECIPES } from "../src/data/recipes";
import { EXERCISES } from "../src/data/exercises";

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const arr = (a: string[]) => (a.length ? `array[${a.map(q).join(",")}]::text[]` : "'{}'::text[]");
const json = (o: unknown) => `${q(JSON.stringify(o))}::jsonb`;
const n = (v: number) => (Math.round(v * 10) / 10).toString();

let sql = "-- Generado por scripts/generate-seed.ts — no editar a mano.\nbegin;\n\n";
sql += "-- Recetas\n";
for (const r of RECIPES) {
  sql += `insert into public.recipes (slug,name,kind,family,art,time_min,kcal,protein_g,carbs_g,fat_g,fiber_g,lines,steps,tags,caffeine_mg,preg_note) values (${[
    q(r.slug), q(r.name), q(r.kind), q(r.family), q(r.art), r.timeMin, n(r.macros.kcal), n(r.macros.p), n(r.macros.c), n(r.macros.f), n(r.macros.fiber),
    json(r.lines), json(r.steps), arr(r.tags), r.caffeineMg ?? 0, r.pregNote ? q(r.pregNote) : "null",
  ].join(",")}) on conflict (slug) do update set name=excluded.name, kind=excluded.kind, family=excluded.family, art=excluded.art, time_min=excluded.time_min, kcal=excluded.kcal, protein_g=excluded.protein_g, carbs_g=excluded.carbs_g, fat_g=excluded.fat_g, fiber_g=excluded.fiber_g, lines=excluded.lines, steps=excluded.steps, tags=excluded.tags, caffeine_mg=excluded.caffeine_mg, preg_note=excluded.preg_note;\n`;
}
sql += "\n-- Ejercicios\n";
for (const e of EXERCISES) {
  sql += `insert into public.exercises (slug,name,groups,min_phase,blocked_for,data) values (${[q(e.slug), q(e.name), arr(e.groups), e.minPhase, arr(e.blockedFor), json(e)].join(",")}) on conflict (slug) do update set name=excluded.name, groups=excluded.groups, min_phase=excluded.min_phase, blocked_for=excluded.blocked_for, data=excluded.data;\n`;
}
sql += "\ncommit;\n";
writeFileSync(new URL("../supabase/seed.sql", import.meta.url), sql);
console.log(`seed.sql: ${RECIPES.length} recetas, ${EXERCISES.length} ejercicios`);
