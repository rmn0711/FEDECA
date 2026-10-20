import { APP_NAME, ORG_NAME, appUrl } from "@/lib/constants";

/** Marca que separa la respuesta nueva del historial cuando se responde por correo. */
export const REPLY_MARKER = "##- Escriba su respuesta por encima de esta línea -##";

export function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function nl2br(text: string) {
  return escapeHtml(text).replace(/\r?\n/g, "<br>");
}

export type EmailPill = { label: string; color: string; bg: string };

export type TicketEmailInput = {
  preheader: string;
  /** Texto pequeño arriba del título (p. ej. "Nueva solicitud") */
  eyebrow: string;
  heading: string;
  intro: string;
  code: string;
  title: string;
  pills: EmailPill[];
  details: Array<[string, string]>;
  message?: { author: string; body: string; label?: string } | null;
  ctaLabel: string;
  ctaUrl: string;
  allowReply?: boolean;
};

// Paleta de marca ACF (igual al cotizador): carbón #19191b, rojo #d9342c.
export function renderTicketEmail(input: TicketEmailInput) {
  const logo = appUrl("/logo-acf-pdf.png");
  const pills = input.pills
    .map(
      (p) =>
        `<span style="display:inline-block;margin:0 6px 6px 0;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:600;color:${p.color};background:${p.bg};">${escapeHtml(p.label)}</span>`
    )
    .join("");
  const details = input.details
    .filter(([, v]) => v)
    .map(
      ([k, v]) =>
        `<tr><td style="padding:7px 0;color:#6b6b6e;font-size:13px;width:42%;vertical-align:top;">${escapeHtml(k)}</td><td style="padding:7px 0;color:#19191b;font-size:13px;font-weight:500;vertical-align:top;">${nl2br(v)}</td></tr>`
    )
    .join("");
  const message = input.message
    ? `<tr><td style="padding:0 32px 8px;">
        <div style="border-left:3px solid #d9342c;background:#f6f6f7;border-radius:10px;padding:16px 18px;">
          <div style="font-size:12px;color:#6b6b6e;margin-bottom:6px;"><strong style="color:#19191b;">${escapeHtml(input.message.author)}</strong>${input.message.label ? ` · ${escapeHtml(input.message.label)}` : ""}</div>
          <div style="font-size:14px;line-height:1.6;color:#19191b;">${nl2br(input.message.body)}</div>
        </div>
      </td></tr>`
    : "";

  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(input.heading)}</title></head>
<body style="margin:0;padding:0;background:#f1f1f2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
${input.allowReply ? `<div style="color:#9a9a9d;font-size:11px;padding:10px 0 0;text-align:center;">${REPLY_MARKER}</div>` : ""}
<div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(input.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f1f2;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.08);">
  <tr><td style="background:#19191b;padding:22px 32px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="vertical-align:middle;"><span style="display:inline-block;background:#ffffff;border-radius:12px;padding:6px;"><img src="${logo}" width="40" height="40" alt="ACF" style="display:block;border:0;"></span></td>
      <td style="vertical-align:middle;text-align:right;color:#ffffff;font-size:14px;font-weight:600;letter-spacing:.3px;">${escapeHtml(APP_NAME)} <span style="color:#ff5a50;">ACF</span></td>
    </tr></table>
  </td></tr>
  <tr><td style="height:4px;background:#d9342c;line-height:4px;font-size:0;">&nbsp;</td></tr>
  <tr><td style="padding:28px 32px 6px;">
    <div style="font-size:12px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:#d9342c;">${escapeHtml(input.eyebrow)}</div>
    <h1 style="margin:6px 0 10px;font-size:22px;line-height:1.3;color:#19191b;">${escapeHtml(input.heading)}</h1>
    <p style="margin:0;font-size:14px;line-height:1.6;color:#4a4a4d;">${nl2br(input.intro)}</p>
  </td></tr>
  <tr><td style="padding:18px 32px 8px;">
    <div style="border:1px solid #e7e7e8;border-radius:14px;padding:18px 20px;">
      <div style="font-size:12px;font-weight:700;color:#6b6b6e;letter-spacing:.5px;">${escapeHtml(input.code)}</div>
      <div style="font-size:16px;font-weight:600;color:#19191b;margin:4px 0 12px;">${escapeHtml(input.title)}</div>
      <div>${pills}</div>
      ${details ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;border-top:1px solid #efefef;">${details}</table>` : ""}
    </div>
  </td></tr>
  ${message}
  <tr><td style="padding:18px 32px 30px;" align="left">
    <a href="${input.ctaUrl}" style="display:inline-block;background:#d9342c;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:10px;box-shadow:0 6px 20px rgba(217,52,44,0.35);">${escapeHtml(input.ctaLabel)}</a>
    ${input.allowReply ? `<p style="margin:14px 0 0;font-size:12px;color:#6b6b6e;">También puede responder directamente a este correo: su respuesta quedará registrada en la solicitud.</p>` : ""}
  </td></tr>
  <tr><td style="background:#fafafa;border-top:1px solid #efefef;padding:16px 32px;font-size:11px;line-height:1.6;color:#9a9a9d;">
    ${escapeHtml(ORG_NAME)} · ${escapeHtml(APP_NAME)}<br>Mensaje automático. Conserve el código <strong>${escapeHtml(input.code)}</strong> en el asunto para que su respuesta se asocie a la solicitud.
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

  const text = [
    input.allowReply ? REPLY_MARKER : null,
    `${input.eyebrow.toUpperCase()} — ${input.heading}`,
    input.intro,
    `${input.code} · ${input.title}`,
    input.pills.map((p) => p.label).join(" · "),
    input.details
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n"),
    input.message ? `${input.message.author}:\n${input.message.body}` : null,
    `${input.ctaLabel}: ${input.ctaUrl}`,
    `${ORG_NAME} · ${APP_NAME}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  return { html, text };
}
