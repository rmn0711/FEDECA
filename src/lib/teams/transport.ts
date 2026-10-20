export type TeamsAlert = { title: string; body: string; url: string };

/** La URL incluye una firma secreta: nunca debe aparecer en logs ni en el cliente. */
export function validateWorkflowUrl(value: string): URL {
  const url = new URL(value);
  const hosts = [".environment.api.powerplatform.com", ".logic.azure.com", ".api.powerautomate.com"];
  if (url.protocol !== "https:" || url.username || url.password || url.port ||
      !hosts.some((suffix) => url.hostname.endsWith(suffix)) || !url.pathname.endsWith("/invoke")) {
    throw new Error("URL de Workflow de Teams no válida.");
  }
  return url;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function workflowPayload(recipient: string, alert: TeamsAlert, origin: string) {
  const base = new URL(origin);
  const link = new URL(alert.url, base);
  if (base.protocol !== "https:" || link.origin !== base.origin || link.username || link.password) {
    throw new Error("El enlace del aviso debe pertenecer a Conecta ACF.");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) throw new Error("Destinatario de Teams no válido.");
  const title = alert.title.slice(0, 250);
  const body = alert.body.slice(0, 2000);
  const message = `<p><strong>${escapeHtml(title)}</strong></p><p>${escapeHtml(body).replace(/\n/g, "<br>")}</p><p><a href="${escapeHtml(link.href)}">Abrir en Conecta ACF</a></p>`;
  return {
    type: "message",
    source: "conecta-acf",
    recipient: recipient.trim().toLowerCase(),
    message,
    attachments: [{
      contentType: "application/vnd.microsoft.card.adaptive",
      contentUrl: null,
      content: {
        $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
        type: "AdaptiveCard", version: "1.4",
        body: [{ type: "TextBlock", text: title, weight: "Bolder", wrap: true }, { type: "TextBlock", text: body, wrap: true }],
        actions: [{ type: "Action.OpenUrl", title: "Abrir en Conecta ACF", url: link.href }],
      },
    }],
  };
}

export async function postTeamsAlert(workflowUrl: string, recipient: string, alert: TeamsAlert, origin: string, request: typeof fetch = fetch) {
  const endpoint = validateWorkflowUrl(workflowUrl);
  const payload = workflowPayload(recipient, alert, origin);
  // No reintentar un timeout: el flujo podría haber aceptado el mensaje y se duplicaría.
  const response = await request(endpoint, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload), redirect: "error", signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Teams rechazó el aviso (HTTP ${response.status}).`);
  // Un 202 confirma aceptación del flujo, no entrega del chat al usuario.
  return { accepted: true as const };
}
