import { secretMatches } from "@/lib/secure";
import { deliverDueReminders } from "@/lib/followups/service";
import { deliverOverdueAlerts } from "@/lib/tickets/overdue";

/** Entrega los recordatorios de seguimiento vencidos (Vercel Cron diario; también al abrir la plataforma y cuando consulta el servicio de WhatsApp). */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secretMatches(request.headers.get("authorization"), secret ? `Bearer ${secret}` : null)) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }
  const sent = await deliverDueReminders();
  const overdue = await deliverOverdueAlerts();
  return Response.json({ ok: true, sent, overdue });
}
