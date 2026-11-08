-- Ejercicios que el usuario quita de su rutina porque le molestan la rodilla.
alter table public.knee_profiles add column if not exists excluded_exercises text[] not null default '{}';

-- El perfil de la esposa se llama Yanina.
update public.profiles set name = 'Yanina' where slug = 'esposa' and name = 'Esposa';

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
