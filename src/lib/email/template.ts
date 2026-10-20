import { APP_NAME, ORG_NAME, appUrl } from "@/lib/constants";

/** Marca que separa la respuesta nueva del historial cuando se responde por correo. */
export const REPLY_MARKER = "##- Escribe tu respuesta por encima de esta línea -##";

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
  /** Etiqueta pequeña arriba del título (p. ej. "Nueva solicitud") */
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
  /** Avance de la solicitud: 0 recibida, 1 en curso, 2 resuelta. `waiting` marca el paso actual como "En espera". */
  progress?: { step: 0 | 1 | 2; waiting?: boolean } | null;
  /** Firma humana al final ("Quedamos atentos, Mario Hernández · Diseño gráfico"). */
  signoff?: { name: string; role?: string } | null;
  /** Sin la tarjeta de resumen (correos de acceso, prueba, etc.). */
  compact?: boolean;
  /** Detalles como lista (una fila por elemento) en vez de cuadrícula de dos columnas. */
  listDetails?: boolean;
};

const RED = "#d9342c";
const INK = "#19191b";
const MUTED = "#6b6b70";
const AVATAR_COLORS = ["#d9342c", "#2a78d6", "#0f8a5f", "#b84f22", "#7c4dce", "#1c7c8c"];

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

function avatarColor(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function avatar(name: string, size = 40) {
  return `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td width="${size}" height="${size}" align="center" valign="middle" style="width:${size}px;height:${size}px;border-radius:50%;background:${avatarColor(name)};color:#ffffff;font-size:${Math.round(size * 0.38)}px;font-weight:700;line-height:${size}px;">${escapeHtml(initials(name))}</td></tr></table>`;
}

function progressBar(p: NonNullable<TicketEmailInput["progress"]>) {
  const labels = ["Recibida", p.waiting ? "En espera" : "En curso", "Resuelta"];
  const cells = labels
    .map((label, i) => {
      const done = i < p.step || (i === p.step && i === 2);
      const current = i === p.step && i !== 2;
      const dotBg = done ? RED : current ? "#ffffff" : "#e4e4e7";
      const dotBorder = done || current ? RED : "#e4e4e7";
      const mark = done ? "✓" : "";
      const line = (side: "l" | "r") => {
        if ((side === "l" && i === 0) || (side === "r" && i === 2)) return `<td style="width:50%;"></td>`;
        const filled = side === "l" ? i <= p.step : i < p.step;
        return `<td style="width:50%;"><div style="height:3px;background:${filled ? RED : "#e4e4e7"};font-size:0;line-height:0;">&nbsp;</div></td>`;
      };
      return `<td width="33%" align="center" valign="top" style="padding:0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          ${line("l")}
          <td width="24" align="center" valign="middle"><div style="width:20px;height:20px;border-radius:50%;background:${dotBg};border:2px solid ${dotBorder};color:#ffffff;font-size:12px;font-weight:700;line-height:20px;text-align:center;">${mark}</div></td>
          ${line("r")}
        </tr></table>
        <div style="margin-top:6px;font-size:12px;font-weight:${current || done ? 700 : 500};color:${current || done ? INK : "#9a9a9e"};">${label}</div>
      </td>`;
    })
    .join("");
  return `<tr><td class="px" style="padding:4px 36px 6px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf8f6;border-radius:14px;"><tr><td style="padding:16px 8px 14px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${cells}</tr></table>
    </td></tr></table>
  </td></tr>`;
}

/** Plantilla de todos los correos de Conecta ACF: cercana, clara y con la marca ACF (carbón #19191b, rojo #d9342c). */
export function renderTicketEmail(input: TicketEmailInput) {
  const logo = appUrl("/logo-acf-pdf.png");
  const pills = input.pills
    .map(
      (p) =>
        `<span style="display:inline-block;margin:0 6px 6px 0;padding:4px 11px;border-radius:999px;font-size:12px;font-weight:600;color:${p.color};background:${p.bg};">${escapeHtml(p.label)}</span>`
    )
    .join("");

  // Detalles en dos columnas (etiqueta pequeña arriba, valor abajo).
  const filled = input.details.filter(([, v]) => v);
  const rows: string[] = [];
  if (input.listDetails) {
    for (const [k, v] of filled) {
      rows.push(`<tr><td style="padding:11px 0;border-bottom:1px solid #f3f1ee;"><div style="font-size:14px;font-weight:600;line-height:1.4;color:${INK};">${escapeHtml(k)}</div><div style="margin-top:2px;font-size:13px;color:${MUTED};">${nl2br(v)}</div></td></tr>`);
    }
  }
  for (let i = 0; !input.listDetails && i < filled.length; i += 2) {
    const cell = (d?: [string, string]) =>
      d
        ? `<td class="col" width="50%" valign="top" style="padding:10px 12px 10px 0;"><div style="font-size:11px;font-weight:600;letter-spacing:.4px;text-transform:uppercase;color:#9a9a9e;">${escapeHtml(d[0])}</div><div style="margin-top:3px;font-size:14px;line-height:1.45;color:${INK};">${nl2br(d[1])}</div></td>`
        : `<td class="col" width="50%"></td>`;
    rows.push(`<tr>${cell(filled[i])}${cell(filled[i + 1])}</tr>`);
  }
  const details = rows.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;border-top:1px solid #efedea;">${rows.join("")}</table>`
    : "";

  const message = input.message
    ? `<tr><td class="px" style="padding:10px 36px 6px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td width="48" valign="top" style="padding-top:2px;">${avatar(input.message.author)}</td>
          <td valign="top">
            <div style="font-size:13px;color:${MUTED};margin:0 0 6px;"><strong style="color:${INK};font-size:14px;">${escapeHtml(input.message.author)}</strong>${input.message.label ? ` &nbsp;·&nbsp; ${escapeHtml(input.message.label)}` : ""}</div>
            <div style="background:#f6f4f2;border-radius:4px 16px 16px 16px;padding:14px 16px;font-size:15px;line-height:1.65;color:${INK};">${nl2br(input.message.body)}</div>
          </td>
        </tr></table>
      </td></tr>`
    : "";

  const summary = input.compact
    ? ""
    : `<tr><td class="px" style="padding:14px 36px 6px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #ebe8e4;border-radius:16px;"><tr><td style="padding:18px 20px 12px;">
          <div style="font-size:12px;font-weight:700;color:${RED};letter-spacing:.6px;">${escapeHtml(input.code)}</div>
          <div style="font-size:17px;font-weight:700;line-height:1.35;color:${INK};margin:4px 0 12px;">${escapeHtml(input.title)}</div>
          <div>${pills}</div>
          ${details}
        </td></tr></table>
      </td></tr>`;

  // Botón compatible con Outlook (tabla con fondo, no solo un enlace con estilos).
  const button = `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td align="center" bgcolor="${RED}" style="border-radius:12px;background:${RED};">
    <a href="${input.ctaUrl}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px;">${escapeHtml(input.ctaLabel)} &rarr;</a>
  </td></tr></table>`;

  const signoff = input.signoff
    ? `<tr><td class="px" style="padding:22px 36px 0;">
        <p style="margin:0;font-size:15px;line-height:1.6;color:#3f3f46;">Quedamos atentos,</p>
        <p style="margin:2px 0 0;font-size:15px;font-weight:700;color:${INK};">${escapeHtml(input.signoff.name)}</p>
        ${input.signoff.role ? `<p style="margin:0;font-size:13px;color:${MUTED};">${escapeHtml(input.signoff.role)}</p>` : ""}
      </td></tr>`
    : "";

  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>${escapeHtml(input.heading)}</title>
<style>
  @media (max-width: 520px) {
    .px { padding-left: 20px !important; padding-right: 20px !important; }
    .col { display: block !important; width: 100% !important; }
    h1 { font-size: 22px !important; }
  }
</style></head>
<body style="margin:0;padding:0;background:#f4f1ee;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
${input.allowReply ? `<div style="color:#a8a8ab;font-size:11px;padding:10px 0 0;text-align:center;">${REPLY_MARKER}</div>` : ""}
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(input.preheader)}&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ee;">
<tr><td align="center" style="padding:28px 12px 36px;">

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
    <tr><td align="left" style="padding:0 6px 16px;">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td valign="middle" style="padding-right:10px;"><img src="${logo}" width="36" height="36" alt="ACF" style="display:block;border:0;border-radius:9px;"></td>
        <td valign="middle" style="font-size:16px;font-weight:700;color:${INK};letter-spacing:.2px;">${escapeHtml(APP_NAME)} <span style="color:${RED};">ACF</span></td>
      </tr></table>
    </td></tr>
  </table>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:22px;overflow:hidden;border:1px solid #ebe8e4;">
    <tr><td style="height:5px;background:${RED};line-height:5px;font-size:0;">&nbsp;</td></tr>
    <tr><td class="px" style="padding:30px 36px 8px;">
      <span style="display:inline-block;padding:5px 12px;border-radius:999px;background:#fdecea;color:${RED};font-size:12px;font-weight:700;letter-spacing:.3px;">${escapeHtml(input.eyebrow)}</span>
      <h1 style="margin:14px 0 10px;font-size:25px;line-height:1.28;font-weight:800;color:${INK};">${escapeHtml(input.heading)}</h1>
      <p style="margin:0;font-size:16px;line-height:1.65;color:#3f3f46;">${nl2br(input.intro)}</p>
    </td></tr>
    ${input.progress ? progressBar(input.progress) : ""}
    ${message}
    ${summary}
    <tr><td class="px" style="padding:22px 36px 6px;">${button}</td></tr>
    ${input.allowReply ? `<tr><td class="px" style="padding:6px 36px 0;"><p style="margin:0;font-size:13px;line-height:1.55;color:${MUTED};">💬 ¿Quieres agregar algo? Responde este correo y tu mensaje queda en la solicitud.</p></td></tr>` : ""}
    ${signoff}
    <tr><td style="height:30px;line-height:30px;font-size:0;">&nbsp;</td></tr>
  </table>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
    <tr><td align="center" style="padding:20px 24px 0;font-size:12px;line-height:1.7;color:#8e8e93;">
      <strong style="color:#5a5a5f;">${escapeHtml(APP_NAME)} ACF</strong> · Marketing digital y generación de demanda · ${escapeHtml(ORG_NAME)}<br>
      ${input.allowReply ? `Para que tu respuesta llegue a la solicitud, conserva <strong>${escapeHtml(input.code)}</strong> en el asunto.` : "Este es un mensaje automático de Conecta ACF."}
    </td></tr>
  </table>

</td></tr></table>
</body></html>`;

  const text = [
    input.allowReply ? REPLY_MARKER : null,
    input.heading,
    input.intro,
    input.message ? `${input.message.author}${input.message.label ? ` (${input.message.label})` : ""}:\n${input.message.body}` : null,
    input.compact ? null : `${input.code} · ${input.title}`,
    input.compact ? null : input.pills.map((p) => p.label).join(" · "),
    input.compact
      ? null
      : input.details
          .filter(([, v]) => v)
          .map(([k, v]) => `${k}: ${v}`)
          .join("\n"),
    `${input.ctaLabel}: ${input.ctaUrl}`,
    input.allowReply ? "¿Quieres agregar algo? Responde este correo y tu mensaje queda en la solicitud." : null,
    input.signoff ? `Quedamos atentos,\n${input.signoff.name}${input.signoff.role ? `\n${input.signoff.role}` : ""}` : null,
    `${APP_NAME} ACF · ${ORG_NAME}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  return { html, text };
}
