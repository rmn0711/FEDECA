-- FEDECA · esquema principal. Ejecutar en el SQL Editor de Supabase o con `supabase db push`.

-- ───────────── Hogar y membresía ─────────────
create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Mi hogar',
  invite_code text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index on public.household_members (user_id);

-- ───────────── Perfiles ─────────────
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  slug text not null check (slug in ('jose', 'esposa')),
  name text not null,
  mode text not null check (mode in ('fat_loss', 'pregnancy')),
  sex text not null check (sex in ('male', 'female')),
  age int check (age between 14 and 90),
  height_cm numeric(5,1) not null,
  start_weight_kg numeric(5,1),
  current_weight_kg numeric(5,1),
  goal_weight_kg numeric(5,1),
  pre_pregnancy_weight_kg numeric(5,1),
  due_date date,
  waist_cm numeric(5,1),
  hip_cm numeric(5,1),
  neck_cm numeric(5,1),
  training_time text,
  training_days int[] not null default '{}',
  training_place text check (training_place in ('gym', 'home')),
  uses_glp1 boolean not null default false,
  protein_anchor_weight_kg numeric(5,1),
  meal_times text[] not null default array['07:00','10:00','13:00','16:00','19:00','22:00'],
  onboarding_done boolean not null default false,
  medical_ack boolean not null default false,
  created_at timestamptz not null default now(),
  unique (household_id, slug)
);

create table public.knee_profiles (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  side text not null default 'right' check (side in ('right', 'left', 'both')),
  diagnosis text not null default 'none' check (diagnosis in ('none','undiagnosed_pain','meniscus','acl','mcl','patellofemoral','osteoarthritis','patellar_tendinitis','post_surgery')),
  surgery_type text,
  surgery_months_ago int,
  pain_rest int not null default 0 check (pain_rest between 0 and 10),
  pain_stairs int not null default 0 check (pain_stairs between 0 and 10),
  pain_chair int not null default 0 check (pain_chair between 0 and 10),
  ortho_clearance boolean not null default false,
  start_date date not null default current_date,
  phase_override int check (phase_override in (1, 2, 3))
);

-- ───────────── Catálogo (solo lectura para usuarios) ─────────────
create table public.recipes (
  slug text primary key,
  name text not null,
  kind text not null check (kind in ('breakfast','snack','lunch','dinner','postdinner')),
  family text not null,
  art text,
  time_min int not null,
  kcal numeric(7,1) not null,
  protein_g numeric(6,1) not null,
  carbs_g numeric(6,1) not null,
  fat_g numeric(6,1) not null,
  fiber_g numeric(6,1) not null,
  lines jsonb not null,           -- [{food, g, role, label}]
  steps jsonb not null,
  tags text[] not null default '{}',
  caffeine_mg int not null default 0,
  preg_note text
);
create index on public.recipes (kind);

create table public.exercises (
  slug text primary key,
  name text not null,
  groups text[] not null,
  min_phase int not null default 1,
  blocked_for text[] not null default '{}',
  data jsonb not null            -- ejercicio completo (series, reps, claves, rangos, regresiones…)
);

-- ───────────── Menú y comidas ─────────────
create table public.menu_overrides (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  date date not null,
  slot int not null check (slot between 0 and 5),
  recipe_slug text not null references public.recipes(slug),
  reason text,
  unique (household_id, date, slot)
);

create table public.meal_logs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  slot int not null check (slot between 0 and 5),
  recipe_slug text not null,
  status text not null check (status in ('eaten', 'skipped')),
  eaten_at text,
  protein_g numeric(6,1) not null default 0,
  kcal numeric(7,1) not null default 0,
  portion_factor numeric(4,2) not null default 1,
  unique (profile_id, date, slot)
);
create index on public.meal_logs (profile_id, date);

-- ───────────── Seguimiento ─────────────
create table public.weight_logs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  weight_kg numeric(5,1) not null check (weight_kg between 30 and 300),
  unique (profile_id, date)
);

create table public.measurements (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  waist_cm numeric(5,1),
  hip_cm numeric(5,1),
  neck_cm numeric(5,1),
  arm_cm numeric(5,1),
  thigh_cm numeric(5,1),
  unique (profile_id, date)
);

create table public.daily_checks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  water_ml int not null default 0,
  steps int,
  sleep_h numeric(3,1),
  trained boolean not null default false,
  notes text,
  unique (profile_id, date)
);

create table public.symptom_notes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  note text not null
);

-- ───────────── Ejercicio y rodilla ─────────────
create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  kind text not null,
  phase int not null check (phase in (1, 2, 3)),
  started_at timestamptz,
  ended_at timestamptz,
  pain_before int check (pain_before between 0 and 10),
  pain_after int check (pain_after between 0 and 10),
  pain_next_day int check (pain_next_day between 0 and 10),
  swelling_next_day boolean,
  notes text
);
create index on public.workout_sessions (profile_id, date);

create table public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  session_id uuid not null references public.workout_sessions(id) on delete cascade,
  date date not null,
  exercise_slug text not null references public.exercises(slug),
  set_no int not null,
  weight_kg numeric(6,2),
  reps int,
  rpe numeric(3,1) check (rpe between 1 and 10),
  knee_pain int check (knee_pain between 0 and 10)
);
create index on public.workout_sets (profile_id, exercise_slug, date);

create table public.knee_pain_logs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  context text not null check (context in ('rest','stairs','chair','before','during','next_day')),
  pain int not null check (pain between 0 and 10),
  swelling boolean not null default false,
  alarm text,
  session_id uuid references public.workout_sessions(id) on delete set null
);
create index on public.knee_pain_logs (profile_id, date);

create table public.alcohol_logs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  drink_key text not null,
  mixer_key text,
  qty numeric(4,1) not null default 1,
  kcal numeric(6,1) not null,
  std_drinks numeric(4,1) not null
);
create index on public.alcohol_logs (profile_id, date);

-- ───────────── Notificaciones push ─────────────
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

-- Evita enviar dos veces el mismo recordatorio.
create table public.push_sent (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  slot int not null,
  sent_at timestamptz not null default now(),
  primary key (profile_id, date, slot)
);
