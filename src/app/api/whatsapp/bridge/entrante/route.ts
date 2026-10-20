import { handleInbound } from "@/lib/whatsapp/inbound";
import { bridgeAuthorized, unauthorized } from "@/lib/whatsapp/bridge-auth";

/** Mensaje recibido en el WhatsApp del líder que responde a una alerta (lo reenvía el servicio). */
export async function POST(request: Request) {
  if (!bridgeAuthorized(request)) return unauthorized();
  const b = (await request.json().catch(() => ({}))) as { from?: string; text?: string; quotedId?: string; messageId?: string };
  if (!b.from || !b.text) return Response.json({ error: "Faltan datos" }, { status: 400 });
  const result = await handleInbound({ from: b.from, text: b.text, quotedId: b.quotedId ?? null, messageId: b.messageId ?? null });
  return Response.json(result);
}
