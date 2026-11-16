-- Plan del nutricionista (ciclo de 3 días) para el perfil de pérdida de grasa.
alter table public.profiles add column if not exists diet_plan text not null default 'ciclo3' check (diet_plan in ('app', 'ciclo3'));
alter table public.profiles add column if not exists plan_weigh text not null default 'cocido' check (plan_weigh in ('cocido', 'crudo'));

-- Los cambios de plato del plan se guardan en las tomas 10–15 (no tocan el menú de la casa)
-- y usan recetas generadas ("plan-…") que no están en el catálogo.
alter table public.menu_overrides drop constraint if exists menu_overrides_slot_check;
alter table public.menu_overrides add constraint menu_overrides_slot_check check (slot between 0 and 15);
alter table public.menu_overrides drop constraint if exists menu_overrides_recipe_slug_fkey;
