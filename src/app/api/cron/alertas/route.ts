import { secretMatches } from "@/lib/secure";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getAlerts } from "@/lib/alerts";
import { sendEmail } from "@/lib/email/send";
import { renderTicketEmail } from "@/lib/email/template";
import { appUrl } from "@/lib/constants";
import { whatsappUsers } from "@/lib/whatsapp/send";
import { waMessage } from "@/lib/whatsapp/templates";

/**
 * Resumen diario de alertas por correo (lo vencido y lo que vence hoy).
 * Vercel Cron lo invoca con "Authorization: Bearer CRON_SECRET" (ver vercel.json).
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secretMatches(request.headers.get("authorization"), secret ? `Bearer ${secret}` : null)) {
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
      heading: `Buenos días, ${person.name.split(" ")[0]} ☀️`,
      intro: `Para arrancar el día: tienes ${urgent.length} pendiente${urgent.length === 1 ? "" : "s"} que necesitan tu atención${overdue ? `, ${overdue} ya vencido${overdue === 1 ? "" : "s"}` : ""}. Empieza por los rojos.`,
      code: "Alertas",
      title: "Lo que requiere tu atención",
      pills: [
        { label: `${overdue} vencido(s)`, color: "#b3261e", bg: "#fbe5e3" },
        { label: `${urgent.length - overdue} para hoy`, color: "#b84f22", bg: "#fdebe2" },
      ],
      details: urgent.slice(0, 25).map((a) => [`${a.severity === "overdue" ? "🔴" : "🟠"} ${a.title}`, a.detail] as [string, string]),
      listDetails: true,
      ctaLabel: "Abrir mi pipeline",
      ctaUrl: appUrl("/equipo/pipeline"),
    });
    await sendEmail({ kind: "digest", to: [person.email], subject: `Resumen del día · ${urgent.length} pendiente(s)`, html, text });
    await whatsappUsers([person.id], "resumen", "resumen", () =>
      waMessage(
        [
          `☀️ *Buenos días, ${person.name.split(" ")[0]}*`,
          `Tienes *${urgent.length}* pendiente(s): ${overdue} vencido(s) y ${urgent.length - overdue} para hoy.`,
          "",
          ...urgent.slice(0, 8).map((a) => `${a.severity === "overdue" ? "🔴" : "🟠"} ${a.title} — _${a.detail}_`),
          urgent.length > 8 ? `…y ${urgent.length - 8} más.` : null,
          "",
          `👉 ${appUrl("/equipo/pipeline")}`,
        ],
        false
      )
    );
    sent++;
  }
  return Response.json({ ok: true, sent });
}
