import { deliverDueReminders } from "@/lib/followups/service";
import { deliverOverdueAlerts } from "@/lib/tickets/overdue";

/** Entrega los recordatorios de seguimiento vencidos (Vercel Cron cada 15 minutos). */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }
  const sent = await deliverDueReminders();
  const overdue = await deliverOverdueAlerts();
  return Response.json({ ok: true, sent, overdue });
}
