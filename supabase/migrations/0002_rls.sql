-- FEDECA · Row Level Security. Cada usuario solo ve los datos de los hogares a los que pertenece.

create or replace function public.is_member(hid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.household_members m where m.household_id = hid and m.user_id = auth.uid());
$$;

alter table public.households enable row level security;
alter table public.household_members enable row level security;

create policy households_select on public.households for select to authenticated using (public.is_member(id));
create policy households_update on public.households for update to authenticated using (public.is_member(id)) with check (public.is_member(id));
create policy members_select on public.household_members for select to authenticated using (user_id = auth.uid() or public.is_member(household_id));

-- Tablas por hogar: acceso completo a miembros.
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','knee_profiles','menu_overrides','meal_logs','weight_logs','measurements','daily_checks',
    'symptom_notes','workout_sessions','workout_sets','knee_pain_logs','alcohol_logs'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_member(household_id))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.is_member(household_id))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.is_member(household_id)) with check (public.is_member(household_id))', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.is_member(household_id))', t || '_delete', t);
  end loop;
end $$;

-- Suscripciones push: cada usuario gestiona las suyas dentro de su hogar.
alter table public.push_subscriptions enable row level security;
create policy push_select on public.push_subscriptions for select to authenticated using (user_id = auth.uid());
create policy push_insert on public.push_subscriptions for insert to authenticated with check (user_id = auth.uid() and public.is_member(household_id));
create policy push_update on public.push_subscriptions for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy push_delete on public.push_subscriptions for delete to authenticated using (user_id = auth.uid());

-- push_sent: solo el servidor (service role) escribe; sin políticas = sin acceso para clientes.
alter table public.push_sent enable row level security;

-- Catálogo: lectura para usuarios autenticados, escritura solo con service role (seed).
alter table public.recipes enable row level security;
alter table public.exercises enable row level security;
create policy recipes_read on public.recipes for select to authenticated using (true);
create policy exercises_read on public.exercises for select to authenticated using (true);

-- ───────────── Funciones de alta ─────────────

-- Crea el hogar del usuario con los dos perfiles precargados (Jose y su esposa).
create or replace function public.bootstrap_household(jose_name text default 'Jose', spouse_name text default 'Yanina')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare hid uuid;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  select household_id into hid from public.household_members where user_id = auth.uid() limit 1;
  if hid is not null then return hid; end if;

  insert into public.households (name) values ('Hogar de ' || jose_name) returning id into hid;
  insert into public.household_members (household_id, user_id, role) values (hid, auth.uid(), 'owner');

  insert into public.profiles (household_id, slug, name, mode, sex, age, height_cm, start_weight_kg, current_weight_kg, protein_anchor_weight_kg, training_days)
  values (hid, 'jose', jose_name, 'fat_loss', 'male', null, 178, 123, 123, 123, array[1,2,4,5]);

  insert into public.profiles (household_id, slug, name, mode, sex, age, height_cm, due_date)
  values (hid, 'esposa', spouse_name, 'pregnancy', 'female', null, 160, date '2027-04-15');

  insert into public.knee_profiles (household_id, profile_id)
  select hid, id from public.profiles where household_id = hid and slug = 'jose';

  return hid;
end $$;

-- Permite que la pareja entre al mismo hogar con su propia cuenta (código de invitación).
create or replace function public.join_household(code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare hid uuid;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  select id into hid from public.households where invite_code = lower(trim(code));
  if hid is null then raise exception 'Código inválido'; end if;
  insert into public.household_members (household_id, user_id, role) values (hid, auth.uid(), 'member') on conflict do nothing;
  return hid;
end $$;

revoke all on function public.bootstrap_household(text, text) from public;
revoke all on function public.join_household(text) from public;
grant execute on function public.bootstrap_household(text, text) to authenticated;
grant execute on function public.join_household(text) to authenticated;
revoke all on function public.is_member(uuid) from public;
grant execute on function public.is_member(uuid) to authenticated;
