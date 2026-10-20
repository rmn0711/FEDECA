import { createHmac, timingSafeEqual } from "node:crypto";

/** Firma de Meta: X-Hub-Signature-256 = "sha256=" + HMAC-SHA256(cuerpo crudo, App Secret). */
export function validMetaSignature(rawBody: string, header: string | null, appSecret: string | undefined) {
  if (!appSecret || !header?.startsWith("sha256=")) return false;
  const expected = Buffer.from(`sha256=${createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex")}`);
  const given = Buffer.from(header);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

type MetaWebhook = {
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: Array<{
          id: string;
          from: string;
          type: string;
          text?: { body?: string };
          button?: { text?: string };
          interactive?: { button_reply?: { title?: string }; list_reply?: { title?: string } };
          context?: { id?: string };
        }>;
        statuses?: Array<{ id: string; status: string; errors?: Array<{ title?: string; message?: string; error_data?: { details?: string } }> }>;
      };
    }>;
  }>;
};

/** Extrae mensajes de texto entrantes y estados de entrega del cuerpo del webhook. */
export function parseMetaWebhook(body: unknown) {
  const data = (body ?? {}) as MetaWebhook;
  const messages: Array<{ from: string; text: string; quotedId: string | null; messageId: string }> = [];
  const statuses: Array<{ id: string; status: string; errorText: string | null }> = [];
  for (const entry of data.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const m of change.value?.messages ?? []) {
        const text = m.text?.body ?? m.button?.text ?? m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? "";
        if (m.from && text.trim()) messages.push({ from: m.from, text, quotedId: m.context?.id ?? null, messageId: m.id });
      }
      for (const s of change.value?.statuses ?? []) {
        const e = s.errors?.[0];
        statuses.push({ id: s.id, status: s.status, errorText: e ? e.error_data?.details || e.message || e.title || null : null });
      }
    }
  }
  return { messages, statuses };
}
