/**
 * Transporte de la API oficial de WhatsApp (Meta Cloud API). Sin dependencias del servidor
 * para poder probarlo aislado: recibe la configuración y `fetch` como parámetros.
 */
export type MetaConfig = {
  token: string;
  phoneNumberId: string;
  template: string;
  templateLang: string;
  apiVersion: string;
};

export class MetaSendError extends Error {
  readonly code: number | null;
  readonly retryable: boolean;
  constructor(message: string, code: number | null, retryable: boolean) {
    super(message);
    this.code = code;
    this.retryable = retryable;
  }
}

/** Fuera de la ventana de 24 h Meta exige plantilla (código 131047). */
export const OUTSIDE_WINDOW_CODES = new Set([131047]);

/** Texto libre: solo dentro de las 24 h siguientes al último mensaje de la persona. */
export function textPayload(to: string, body: string) {
  return { messaging_product: "whatsapp", recipient_type: "individual", to, type: "text", text: { body: body.slice(0, 4096), preview_url: true } };
}

/**
 * Las variables de una plantilla no admiten saltos de línea, tabulaciones ni más de 4 espacios
 * seguidos: el aviso se aplana en una línea («· » separa lo que eran renglones).
 */
export function templateParam(text: string, max = 900) {
  const flat = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .join(" · ")
    .replace(/\t/g, " ")
    .replace(/ {4,}/g, "   ");
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat || "-";
}

/** Plantilla «conecta_aviso»: Hola {{1}}, tienes una novedad en Conecta ACF: {{2}} … */
export function templatePayload(to: string, cfg: Pick<MetaConfig, "template" | "templateLang">, firstName: string, body: string) {
  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "template",
    template: {
      name: cfg.template,
      language: { code: cfg.templateLang },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: templateParam(firstName || "equipo", 60) },
            { type: "text", text: templateParam(body) },
          ],
        },
      ],
    },
  };
}

export async function postMeta(cfg: MetaConfig, payload: object, request: typeof fetch = fetch): Promise<string> {
  const url = `https://graph.facebook.com/${cfg.apiVersion}/${encodeURIComponent(cfg.phoneNumberId)}/messages`;
  let res: Response;
  try {
    res = await request(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new MetaSendError("No hubo respuesta de WhatsApp (red o tiempo de espera).", null, true);
  }
  const json = (await res.json().catch(() => ({}))) as { messages?: Array<{ id: string }>; error?: { message?: string; code?: number; error_data?: { details?: string } } };
  if (!res.ok || !json.messages?.[0]?.id) {
    const code = json.error?.code ?? null;
    // Nunca se incluye el token en el mensaje de error.
    const detail = json.error?.error_data?.details || json.error?.message || `HTTP ${res.status}`;
    throw new MetaSendError(`WhatsApp rechazó el mensaje${code ? ` (${code})` : ""}: ${detail}`.slice(0, 480), code, res.status >= 500 || res.status === 429);
  }
  return json.messages[0].id;
}

/** Envía texto si la ventana de 24 h está abierta; si no (o Meta la da por cerrada), la plantilla. */
export async function sendMetaMessage(
  cfg: MetaConfig,
  msg: { to: string; body: string; firstName: string; windowOpen: boolean },
  request: typeof fetch = fetch
): Promise<{ id: string; mode: "texto" | "plantilla" }> {
  if (msg.windowOpen) {
    try {
      return { id: await postMeta(cfg, textPayload(msg.to, msg.body), request), mode: "texto" };
    } catch (e) {
      if (!(e instanceof MetaSendError) || e.code === null || !OUTSIDE_WINDOW_CODES.has(e.code)) throw e;
    }
  }
  return { id: await postMeta(cfg, templatePayload(msg.to, cfg, msg.firstName, msg.body), request), mode: "plantilla" };
}
