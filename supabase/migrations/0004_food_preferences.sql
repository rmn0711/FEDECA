-- Gustos de comida por persona: "no me gusta" saca el alimento del menú; "me gusta" lo prioriza.
create table if not exists public.food_preferences (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  food_key text not null,
  pref text not null check (pref in ('like', 'dislike')),
  unique (profile_id, food_key)
);

alter table public.food_preferences enable row level security;
create policy food_preferences_select on public.food_preferences for select to authenticated using (public.is_member(household_id));
create policy food_preferences_insert on public.food_preferences for insert to authenticated with check (public.is_member(household_id));
create policy food_preferences_update on public.food_preferences for update to authenticated using (public.is_member(household_id)) with check (public.is_member(household_id));
create policy food_preferences_delete on public.food_preferences for delete to authenticated using (public.is_member(household_id));
