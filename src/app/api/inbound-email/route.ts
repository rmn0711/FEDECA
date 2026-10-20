import { timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { parseTicketCode } from "@/lib/constants";
import { extractAddress, stripQuotedReply } from "@/lib/email/inbound";
import { addComment } from "@/lib/tickets/service";
import { TicketError } from "@/lib/tickets/access";

/**
 * Recibe respuestas por correo y las agrega al seguimiento de la solicitud.
 *
 * Lo puede invocar Power Automate (Microsoft 365), SendGrid Inbound Parse,
 * Mailgun, Postmark, etc. Acepta JSON o formulario con:
 *   from | sender            → remitente
 *   subject                  → debe contener el código [HD-00012]
 *   text | body-plain | stripped-text | TextBody → cuerpo en texto plano
 * Autenticación: ?secret=INBOUND_EMAIL_SECRET o cabecera x-inbound-secret.
 */
export async function POST(request: Request) {
  const expected = process.env.INBOUND_EMAIL_SECRET;
  if (!expected) return Response.json({ error: "Webhook deshabilitado" }, { status: 404 });
  const given = new URL(request.url).searchParams.get("secret") ?? request.headers.get("x-inbound-secret") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return Response.json({ error: "No autorizado" }, { status: 401 });

  let data: Record<string, unknown> = {};
  const type = request.headers.get("content-type") ?? "";
  if (type.includes("application/json")) data = await request.json();
  else Object.assign(data, Object.fromEntries((await request.formData()).entries()));

  const pick = (...keys: string[]) => {
    for (const k of keys) if (typeof data[k] === "string" && data[k]) return data[k] as string;
    return "";
  };
  const from = extractAddress(pick("from", "sender", "From", "Sender"));
  const subject = pick("subject", "Subject");
  const rawBody = pick("stripped-text", "text", "body-plain", "TextBody", "body", "Body");

  const ticketId = parseTicketCode(subject);
  if (!ticketId) return Response.json({ ignored: "El asunto no contiene un código HD-" }, { status: 202 });
  const body = stripQuotedReply(rawBody);
  if (!body) return Response.json({ ignored: "Respuesta vacía" }, { status: 202 });

  const db = await getDb();
  const [user] = await db.select().from(users).where(eq(users.email, from));
  if (!user || !user.active) return Response.json({ ignored: "Remitente no registrado" }, { status: 202 });

  try {
    await addComment(user, ticketId, { body, source: "email" });
  } catch (e) {
    if (e instanceof TicketError) return Response.json({ ignored: e.message }, { status: 202 });
    throw e;
  }
  return Response.json({ ok: true, ticketId });
}
