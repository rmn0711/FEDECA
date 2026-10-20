import { and, eq, inArray } from "drizzle-orm";
import type { DB } from "./index";
import { conversationMembers, conversations, messages, settings, users } from "./schema";

const FLAG = "chat_v1";

const CHANNELS = [
  { name: "general", description: "Anuncios y conversación de todo el equipo." },
  { name: "marketing-digital", description: "Redes, contenido, pauta y diseño." },
  { name: "generacion-de-demanda", description: "Campañas, leads, embudo y CRM." },
];

/** Canales de arranque del chat (una sola vez). */
export async function seedChat(db: DB) {
  const [done] = await db.select().from(settings).where(eq(settings.key, FLAG));
  if (done) return;
  const team = await db.select({ id: users.id, role: users.role }).from(users).where(and(eq(users.active, true), inArray(users.role, ["admin", "agent"])));
  const owner = team.find((u) => u.role === "admin")?.id ?? null;
  for (const c of CHANNELS) {
    const [conv] = await db
      .insert(conversations)
      .values({ kind: "channel", name: c.name, description: c.description, createdBy: owner })
      .returning();
    if (team.length) {
      await db
        .insert(conversationMembers)
        .values(team.map((u) => ({ conversationId: conv.id, userId: u.id })))
        .onConflictDoNothing();
    }
    if (c.name === "general" && owner) {
      await db.insert(messages).values({
        conversationId: conv.id,
        authorId: owner,
        body: "¡Bienvenidos al chat del equipo! 👋 Usen los canales para cada frente y los mensajes directos para temas puntuales.",
      });
    }
  }
  await db.insert(settings).values({ key: FLAG, value: new Date().toISOString() }).onConflictDoNothing();
}
