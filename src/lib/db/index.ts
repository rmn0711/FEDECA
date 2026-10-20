import "server-only";
import { drizzle as drizzlePostgres, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";
import * as schema from "./schema";
import { SCHEMA_SQL } from "./migrate";
import { CATEGORIES } from "@/lib/categories";
import { seedDefaultTeam } from "./team";
import { seedWorkspace } from "./workspace-seed";
import { seedChat } from "./chat-seed";
import { seedKnowledgeBase } from "./kb-seed";

export type DB = PostgresJsDatabase<typeof schema>;

// La conexión se guarda en globalThis para que el recargado en caliente de
// `next dev` no abra una conexión nueva en cada cambio.
const globalForDb = globalThis as unknown as { __hdDb?: Promise<DB> };

/**
 * DATABASE_URL, o POSTGRES_URL si la base se conectó desde Vercel → Storage → Supabase.
 * Se quitan parámetros propios de la integración (p. ej. "supa") que postgres-js enviaría al servidor.
 */
function databaseUrl() {
  const raw = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!raw) return null;
  try {
    const u = new URL(raw);
    for (const key of Array.from(u.searchParams.keys())) if (key !== "sslmode") u.searchParams.delete(key);
    return u.toString();
  } catch {
    return raw;
  }
}

async function connect(): Promise<DB> {
  const url = databaseUrl();
  if (!url && process.env.VERCEL) {
    throw new Error("Falta la base de datos: conecta Supabase en Vercel → Storage o define DATABASE_URL.");
  }
  let db: DB;
  let run: (statement: string) => Promise<unknown>;

  if (url) {
    // prepare:false → compatible con el pooler de Supabase (modo transacción).
    const client = postgres(url, { prepare: false, max: 5 });
    db = drizzlePostgres(client, { schema });
    run = (statement) => client.unsafe(statement);
  } else {
    // Sin DATABASE_URL se usa PostgreSQL embebido (PGlite) en ./.data — solo para desarrollo.
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle: drizzlePglite } = await import("drizzle-orm/pglite");
    const client = new PGlite(process.env.PGLITE_DIR || "./.data/helpdesk");
    db = drizzlePglite(client, { schema }) as unknown as DB;
    run = (statement) => client.exec(statement);
  }

  for (const statement of SCHEMA_SQL) await run(statement);
  await seed(db);
  return db;
}

export function getDb(): Promise<DB> {
  if (!globalForDb.__hdDb) {
    globalForDb.__hdDb = connect().catch((error) => {
      globalForDb.__hdDb = undefined;
      throw error;
    });
  }
  return globalForDb.__hdDb;
}

async function seed(db: DB) {
  // Categorías: se crean una sola vez; después se administran desde la plataforma.
  for (const [i, c] of CATEGORIES.entries()) {
    await db.insert(schema.categories).values({ slug: c.slug, name: c.name, sort: i }).onConflictDoNothing();
  }

  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(schema.users);
  if (count === 0) await createInitialUsers(db);
  await seedDefaultTeam(db);
  await seedWorkspace(db);
  await seedChat(db);
  await seedKnowledgeBase(db);
}

async function createInitialUsers(db: DB) {
  const email = (process.env.ADMIN_EMAIL || "jromano@acfcia.com").toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD || (process.env.NODE_ENV === "production" ? "" : "Admin123*");
  // En producción no hay clave por defecto: sin ADMIN_PASSWORD fuerte no se crea el administrador.
  if (process.env.NODE_ENV === "production" && (password.length < 12 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password))) {
    throw new Error("Configura ADMIN_PASSWORD (mínimo 12 caracteres, con mayúsculas, minúsculas y números) para crear el administrador inicial.");
  }
  await db.insert(schema.users).values({
    name: process.env.ADMIN_NAME || "José Romano",
    email,
    passwordHash: await bcrypt.hash(password, 10),
    role: "admin",
    department: "Mesa de Ayuda",
  });
  console.info(`[conecta] Administrador inicial creado: ${email}`);

  if (process.env.SEED_DEMO === "true") {
    const { seedDemo } = await import("./demo");
    await seedDemo(db);
  }
}
