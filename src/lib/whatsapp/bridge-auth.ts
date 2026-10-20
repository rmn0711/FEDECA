import { timingSafeEqual } from "node:crypto";

/** El servicio vinculado se autentica con "Authorization: Bearer WHATSAPP_BRIDGE_TOKEN". */
export function bridgeAuthorized(request: Request) {
  const token = process.env.WHATSAPP_BRIDGE_TOKEN;
  const given = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token || token.length < 24 || given.length !== token.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(token));
}

export const unauthorized = () => Response.json({ error: "No autorizado" }, { status: 401 });
