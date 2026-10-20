import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { whatsappLog } from "@/lib/db/schema";
import { bridgeAuthorized, unauthorized } from "@/lib/whatsapp/bridge-auth";

/** El servicio informa si pudo enviar el mensaje (y su id en WhatsApp, para reconocer respuestas). */
export async function POST(request: Request) {
  if (!bridgeAuthorized(request)) return unauthorized();
  const b = (await request.json().catch(() => ({}))) as { id?: number; ok?: boolean; waMessageId?: string; error?: string };
  if (!Number(b.id)) return Response.json({ error: "Falta id" }, { status: 400 });
  const db = await getDb();
  const [row] = await db.select().from(whatsappLog).where(eq(whatsappLog.id, Number(b.id)));
  if (!row) return Response.json({ error: "No existe" }, { status: 404 });
  const failedForGood = !b.ok && row.attempts >= 3;
  await db
    .update(whatsappLog)
    .set({
      status: b.ok ? "enviado" : failedForGood ? "fallido" : "pendiente",
      waMessageId: b.waMessageId?.slice(0, 200) ?? null,
      error: b.ok ? null : (b.error ?? "Error desconocido").slice(0, 500),
      statusAt: new Date(),
    })
    .where(and(eq(whatsappLog.id, row.id), eq(whatsappLog.status, "enviando")));
  return Response.json({ ok: true });
}
