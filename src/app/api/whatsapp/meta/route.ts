import { secretMatches } from "@/lib/secure";
import { handleInbound } from "@/lib/whatsapp/inbound";
import { applyMetaStatus } from "@/lib/whatsapp/meta";
import { parseMetaWebhook, validMetaSignature } from "@/lib/whatsapp/meta-webhook";

/** Verificación del webhook en el panel de Meta (hub.challenge). */
export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const ok = p.get("hub.mode") === "subscribe" && secretMatches(p.get("hub.verify_token"), process.env.WHATSAPP_META_VERIFY_TOKEN);
  if (!ok) return new Response("No autorizado", { status: 403 });
  return new Response(p.get("hub.challenge") ?? "", { headers: { "Content-Type": "text/plain" } });
}

/** Respuestas de las personas y estados de entrega. Solo se acepta lo firmado por Meta. */
export async function POST(request: Request) {
  const raw = await request.text();
  if (!validMetaSignature(raw, request.headers.get("x-hub-signature-256"), process.env.WHATSAPP_META_APP_SECRET)) {
    return new Response("Firma no válida", { status: 401 });
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response("JSON no válido", { status: 400 });
  }
  const { messages, statuses } = parseMetaWebhook(body);
  for (const m of messages) {
    await handleInbound({ from: m.from, text: m.text, quotedId: m.quotedId, messageId: m.messageId }).catch((e) =>
      console.error("[conecta] Error procesando WhatsApp entrante:", e instanceof Error ? e.message : e)
    );
  }
  for (const s of statuses) await applyMetaStatus(s).catch(() => undefined);
  // Meta reintenta si no recibe 200: siempre se confirma una vez validada la firma.
  return Response.json({ ok: true });
}
