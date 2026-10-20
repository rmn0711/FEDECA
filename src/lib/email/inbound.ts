import { REPLY_MARKER } from "./template";

/** Extrae la dirección de correo de "Nombre <correo@dominio>". */
export function extractAddress(from: string) {
  const m = /<([^>]+)>/.exec(from);
  return (m ? m[1] : from).trim().toLowerCase();
}

/**
 * Deja solo el texto nuevo de una respuesta por correo, quitando el
 * historial citado que agregan Outlook, Gmail y otros clientes.
 */
export function stripQuotedReply(text: string) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const cutPatterns = [
    /##- Escrib[ae] (su|tu) respuesta/i,
    /^-{2,}\s*(Original Message|Mensaje original)\s*-{2,}/i,
    /^_{5,}/,
    /^(De|From):\s.+/i,
    /^El .+ escribió:\s*$/i,
    /^On .+ wrote:\s*$/i,
    /^Enviado desde mi /i,
    /^Sent from my /i,
  ];
  const out: string[] = [];
  for (const line of lines) {
    if (line.includes(REPLY_MARKER) || cutPatterns.some((p) => p.test(line.trim()))) break;
    if (line.trim().startsWith(">")) continue;
    out.push(line);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
