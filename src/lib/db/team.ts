import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import type { DB } from "./index";
import { categories, settings, users } from "./schema";
import type { Role } from "@/lib/constants";

/** Equipo responsable por defecto. Se puede ajustar después en Administración → Usuarios. */
const TEAM: Array<{ name: string; email: string; role: Role; department: string; categories: string[] }> = [
  { name: "José Romano", email: "jromano@acfcia.com", role: "admin", department: "Sistemas", categories: ["sistemas", "sinco", "ia", "cotizador"] },
  { name: "Elías Saad", email: "esaad@acfcia.com", role: "agent", department: "CRM", categories: ["crm"] },
  { name: "Mario Hernández", email: "disenografico@acfcia.com", role: "agent", department: "Diseño gráfico", categories: ["diseno"] },
  { name: "Claribel Marchena", email: "cmarchena@acfcia.com", role: "agent", department: "Redes sociales", categories: ["redes"] },
];

const FLAG = "default_team_v1";

/** Se ejecuta una sola vez por base de datos; después los responsables se administran desde la plataforma. */
export async function seedDefaultTeam(db: DB) {
  const [done] = await db.select().from(settings).where(eq(settings.key, FLAG));
  if (done) return;

  // Contraseña inicial de los responsables (TEAM_INITIAL_PASSWORD) o una aleatoria que se muestra en el log.
  const generated = `Acf${Math.random().toString(36).slice(2, 8)}*${Math.floor(10 + Math.random() * 90)}`;
  const teamPassword = process.env.TEAM_INITIAL_PASSWORD || generated;
  let created = false;

  for (const member of TEAM) {
    let [user] = await db.select().from(users).where(eq(users.email, member.email));
    if (!user) {
      const password = member.role === "admin" && process.env.ADMIN_PASSWORD ? process.env.ADMIN_PASSWORD : teamPassword;
      [user] = await db
        .insert(users)
        .values({
          name: member.name,
          email: member.email,
          role: member.role,
          department: member.department,
          passwordHash: await bcrypt.hash(password, 10),
        })
        .returning();
      created = true;
    }
    for (const slug of member.categories) {
      await db.update(categories).set({ responsibleId: user.id }).where(eq(categories.slug, slug));
    }
  }
  await db.insert(settings).values({ key: FLAG, value: new Date().toISOString() }).onConflictDoNothing();
  if (created && !process.env.TEAM_INITIAL_PASSWORD) {
    console.info(`[conecta] Contraseña inicial de los responsables: ${teamPassword} (pídales cambiarla en Mi perfil)`);
  }
}
