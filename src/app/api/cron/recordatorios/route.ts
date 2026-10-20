import { deliverDueReminders } from "@/lib/followups/service";

/** Entrega los recordatorios de seguimiento vencidos (Vercel Cron cada 15 minutos). */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }
  const sent = await deliverDueReminders();
  return Response.json({ ok: true, sent });
}
