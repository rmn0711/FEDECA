import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getAlerts } from "@/lib/alerts";
import { sendEmail } from "@/lib/email/send";
import { renderTicketEmail } from "@/lib/email/template";
import { appUrl } from "@/lib/constants";

/**
 * Resumen diario de alertas por correo (lo vencido y lo que vence hoy).
 * Vercel Cron lo invoca con "Authorization: Bearer CRON_SECRET" (ver vercel.json).
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }
  const db = await getDb();
  const team = await db
    .select({ id: users.id, name: users.name, email: users.email, role: users.role })
    .from(users)
    .where(and(eq(users.active, true), inArray(users.role, ["admin", "agent"])));

  let sent = 0;
  for (const person of team) {
    const { alerts } = await getAlerts(person);
    const urgent = alerts.filter((a) => a.severity !== "review" && a.category !== "chat");
    if (urgent.length === 0) continue;
    const overdue = urgent.filter((a) => a.severity === "overdue").length;
    const { html, text } = renderTicketEmail({
      preheader: `${urgent.length} pendiente(s): ${overdue} vencido(s)`,
      eyebrow: "Resumen del día",
      heading: `${person.name.split(" ")[0]}, tienes ${urgent.length} pendiente(s) para hoy`,
      intro: `${overdue} vencido(s) y ${urgent.length - overdue} que vencen hoy entre solicitudes del helpdesk y tareas del equipo.`,
      code: "Alertas",
      title: "Lo que requiere tu atención",
      pills: [
        { label: `${overdue} vencido(s)`, color: "#b3261e", bg: "#fbe5e3" },
        { label: `${urgent.length - overdue} para hoy`, color: "#b84f22", bg: "#fdebe2" },
      ],
      details: urgent.slice(0, 25).map((a) => [`${a.severity === "overdue" ? "🔴" : "🟠"} ${a.title}`, a.detail] as [string, string]),
      ctaLabel: "Abrir mi pipeline",
      ctaUrl: appUrl("/equipo/pipeline"),
    });
    await sendEmail({ kind: "digest", to: [person.email], subject: `Resumen del día · ${urgent.length} pendiente(s)`, html, text });
    sent++;
  }
  return Response.json({ ok: true, sent });
}
