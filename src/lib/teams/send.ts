import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { appUrl } from "@/lib/constants";
import { postTeamsAlert, validateWorkflowUrl, type TeamsAlert } from "./transport";

/** Mismos destinatarios que el aviso de Conecta; Teams los identifica por correo corporativo. */
export async function sendTeams(userIds: number[], alert: TeamsAlert) {
  if (process.env.TEAMS_ENABLED !== "true" || !process.env.TEAMS_WORKFLOW_URL) return;
  const endpoint = process.env.TEAMS_WORKFLOW_URL;
  try { validateWorkflowUrl(endpoint); } catch {
    console.error("[conecta] Revisa TEAMS_WORKFLOW_URL: debe ser un webhook HTTPS de Microsoft.");
    return;
  }
  const domains = (process.env.TEAMS_ALLOWED_DOMAINS || "acfcia.com").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
  const ids = [...new Set(userIds)].filter((id) => Number.isInteger(id) && id > 0);
  if (!ids.length || !domains.length) return;
  const db = await getDb();
  const rows = await db.select({ id: users.id, email: users.email }).from(users)
    .where(and(inArray(users.id, ids), eq(users.active, true)));
  const seen = new Set<string>();
  const people = rows.filter((person) => {
    person.email = person.email.trim().toLowerCase();
    if (!domains.includes(person.email.split("@")[1]) || seen.has(person.email)) return false;
    seen.add(person.email);
    return true;
  });
  for (let i = 0; i < people.length; i += 4) {
    await Promise.all(people.slice(i, i + 4).map(async (person) => {
      try {
        await postTeamsAlert(endpoint, person.email, alert, appUrl("/"));
      } catch {
        // Evita filtrar el webhook firmado, el contenido o las credenciales en errores de fetch.
        console.error(`[conecta] No se pudo enviar el aviso de Teams al usuario ${person.id}.`);
      }
    }));
  }
}
