import { setBridgeState } from "@/lib/whatsapp/send";
import { bridgeAuthorized, unauthorized } from "@/lib/whatsapp/bridge-auth";

/** Estado del servicio vinculado: código QR para vincular, conectado o desconectado. */
export async function POST(request: Request) {
  if (!bridgeAuthorized(request)) return unauthorized();
  const b = (await request.json().catch(() => ({}))) as { state?: string; qr?: string | null; me?: string | null; version?: string };
  const state = b.state === "qr" || b.state === "conectado" || b.state === "desconectado" ? b.state : "conectado";
  const qr = state === "qr" && typeof b.qr === "string" && b.qr.startsWith("data:image/png;base64,") && b.qr.length < 60_000 ? b.qr : null;
  await setBridgeState({ state, qr, me: b.me?.replace(/\D/g, "").slice(0, 15) ?? null, version: b.version?.slice(0, 20) ?? null });
  return Response.json({ ok: true });
}
