# Fedeca

App web (PWA) de nutrición, ejercicio y seguimiento de peso para dos personas de un mismo hogar en Barranquilla:

- **Jose**: pérdida de grasa + fuerza con protección de rodilla + módulo de alcohol.
- **Esposa**: modo embarazo (solo alimentación, seguridad alimentaria, sin déficit ni ejercicio).

Stack: Next.js 16 (App Router) · TypeScript · Tailwind 4 · Supabase (auth, Postgres con RLS) · Vercel.

## Probar en local (modo demostración)

```bash
npm install
npm run dev      # http://localhost:3000
```

Sin variables de Supabase la app funciona en **modo demostración**: guarda todo en el `localStorage` del navegador (sin cuentas, sin sincronización, sin push).

## Scripts

| Comando | Qué hace |
|---|---|
| `npm test` | Tests unitarios (cálculo nutricional, embarazo, horario, alcohol, rodilla, progresión, catálogo, planificador, mercado) |
| `npm run typecheck` / `npm run lint` | Verificaciones estáticas |
| `npm run seed:generate` | Regenera `supabase/seed.sql` desde `src/data/*` |
| `npm run icons` | Regenera los íconos PWA (`public/icons`) |

## Despliegue: Supabase + Vercel

### 1. Supabase
1. Crea un proyecto en supabase.com.
2. En **SQL Editor** ejecuta, en orden: `supabase/migrations/0001_schema.sql`, `supabase/migrations/0002_rls.sql` y `supabase/seed.sql` (195 recetas y 66 ejercicios). Con la CLI: `supabase link` + `supabase db push`, y luego ejecuta el seed.
3. **Authentication → Providers**: deja Email habilitado. En **URL Configuration** añade la URL de Vercel como *Site URL* y *Redirect URL*.
4. Copia en **Project Settings → API**: URL, clave `anon` y `service_role`.

El primer usuario que inicia sesión crea el hogar (`bootstrap_household`) con los dos perfiles precargados (Jose: 123 kg y 1,78 m). La otra persona crea su cuenta y entra al mismo hogar con el **código de invitación** (Ajustes → Hogar). Todas las tablas tienen RLS por hogar; solo el service role (cron, seed) las escribe sin sesión.

### 2. Notificaciones push
```bash
npx web-push generate-vapid-keys
```
Guarda la pública en `NEXT_PUBLIC_VAPID_PUBLIC_KEY` y la privada en `VAPID_PRIVATE_KEY`. En iPhone las notificaciones solo funcionan tras **instalar la app** (Compartir → Añadir a pantalla de inicio).

### 3. Vercel
1. Importa el repositorio en vercel.com.
2. Define las variables de `.env.example` (Production y Preview).
3. Despliega.

### 4. Recordatorios 10 minutos antes de cada toma
`GET /api/cron/reminders` con `Authorization: Bearer $CRON_SECRET` debe invocarse **cada minuto** (usa horario de Bogotá, deduplica con `push_sent`). Opciones:

- **Supabase pg_cron + pg_net** (gratis, recomendado):
  ```sql
  create extension if not exists pg_cron; create extension if not exists pg_net;
  select cron.schedule('fedeca-reminders', '* * * * *', $$
    select net.http_get(url := 'https://TU-APP.vercel.app/api/cron/reminders',
      headers := jsonb_build_object('Authorization', 'Bearer TU_CRON_SECRET'));
  $$);
  ```
- Vercel Cron (cada minuto requiere plan Pro) o cualquier cron externo.

## Estructura

```
src/lib/nutrition   calc (TMB, proteína, grasa %, proyección), pregnancy (IOM), meals (horario), alcohol, safety, targets
src/lib/exercise    knee (regla del dolor, fases, progresión, sesiones), plan (semana)
src/lib/menu        core (macros/porciones), planner (rotación 28 días), shopping (mercado + meal prep)
src/lib/day.ts      estado del día: horario corrido, proteína redistribuida, alcohol
src/data            foods, recipes (195), exercises (66)
supabase/           migraciones, RLS y seed
tests/              vitest
```

## Decisiones y límites a tener en cuenta

- **Gustos de comida** (`/gustos`): "No me gusta" saca el alimento de desayunos, almuerzos, cenas, meriendas y lista de mercado; "Me gusta" lo prioriza. Como el menú es uno solo, la exclusión de cualquiera de los dos aplica a ambos. Si los gustos dejan menos de 7 opciones en una toma, se ignoran en esa toma y se avisa. Migración: `0004_food_preferences.sql`.
- **Meriendas de proteína**: la media mañana es comida real (cerdo, res, pollo, pavo, pescado, huevo en trozos) casi todos los días; la media tarde alterna con lácteos y batidos.
- **Bebé**: la comparación de tamaño por semana (`src/lib/nutrition/baby.ts`) usa promedios de referencia; evita alimentos excluidos del menú.

- **Reparto de proteína**: las seis tomas del plan (30/30/40/30/30/20 g) suman 180 g; con una meta de 175 g se usan esos gramos tal cual (tolerancia de 3 %), y con otras metas (la esposa) se escalan.
- **Calorías**: Mifflin-St Jeor × factor por días de entrenamiento − déficit 500–750 (según IMC); piso de 1.800 kcal en ambos perfiles. Los días de pierna suman +25 g de carbohidrato antes y después y se compensan en los demás días.
- **Recetas**: los macros se calculan desde `src/data/foods.ts` (valores aproximados tipo USDA/ICBF). Revísalos con tu nutricionista. Las exclusiones (tomate, pepino, papaya, brócoli, coliflor) se verifican por test sobre todo el texto de las recetas.
- **Catálogo en código**: las recetas y ejercicios viven en TypeScript (fuente de verdad) y se espejan a Supabase con el seed; los datos de usuario referencian recetas por `slug`.
- **Ilustraciones**: SVG propio (platos y figuras esquemáticas animadas); sin fotos de personas.
- **Bloqueos por rodilla**: la extensión de cuádriceps y la prensa a una pierna quedan bloqueadas en LCA/cirugía hasta marcar el aval del especialista (Progreso de rodilla).
- **Aviso**: la app es una guía; no reemplaza a médico, ginecólogo, ortopedista ni fisioterapeuta.
