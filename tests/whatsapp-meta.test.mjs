import assert from "node:assert/strict";
import test from "node:test";
import { createHmac } from "node:crypto";
import { MetaSendError, sendMetaMessage, templateParam, templatePayload, textPayload } from "../src/lib/whatsapp/meta-transport.ts";
import { parseMetaWebhook, validMetaSignature } from "../src/lib/whatsapp/meta-webhook.ts";

const cfg = { token: "SECRET-TOKEN-123", phoneNumberId: "1234567890", template: "conecta_aviso", templateLang: "es", apiVersion: "v23.0" };
const ok = (id) => new Response(JSON.stringify({ messages: [{ id }] }), { status: 200 });
const fail = (status, code, details) => new Response(JSON.stringify({ error: { code, message: "err", error_data: { details } } }), { status });

test("las variables de plantilla quedan en una sola línea, sin tabs ni 4+ espacios", () => {
  const p = templateParam("🔔 *Nueva solicitud HD-00005*\n\n*Sistemas*\tde Mateo     Herrera\n👉 https://x/solicitudes/5");
  assert.doesNotMatch(p, /[\n\t]| {4,}/);
  assert.match(p, /Nueva solicitud HD-00005\* · \*Sistemas\* de Mateo   Herrera · 👉 https:\/\/x\/solicitudes\/5/);
  assert.ok(templateParam("x".repeat(2000)).length <= 900);
  assert.equal(templateParam("   "), "-");
});

test("payloads de texto y de plantilla", () => {
  assert.equal(textPayload("573001234567", "hola").type, "text");
  const t = templatePayload("573001234567", cfg, "José", "línea 1\nlínea 2");
  assert.equal(t.template.name, "conecta_aviso");
  assert.deepEqual(t.template.components[0].parameters.map((x) => x.text), ["José", "línea 1 · línea 2"]);
});

test("con ventana abierta envía texto; fuera de ventana usa la plantilla", async () => {
  const sent = [];
  const req = async (url, init) => { sent.push(JSON.parse(init.body).type); assert.match(String(url), /graph\.facebook\.com\/v23\.0\/1234567890\/messages$/); assert.equal(init.headers.Authorization, "Bearer SECRET-TOKEN-123"); return ok("wamid.1"); };
  assert.deepEqual(await sendMetaMessage(cfg, { to: "57300", body: "hola", firstName: "Ana", windowOpen: true }, req), { id: "wamid.1", mode: "texto" });
  assert.deepEqual(await sendMetaMessage(cfg, { to: "57300", body: "hola", firstName: "Ana", windowOpen: false }, req), { id: "wamid.1", mode: "plantilla" });
  assert.deepEqual(sent, ["text", "template"]);
});

test("si Meta dice que la ventana se cerró (131047), reintenta con la plantilla", async () => {
  const sent = [];
  const req = async (_u, init) => { const type = JSON.parse(init.body).type; sent.push(type); return type === "text" ? fail(400, 131047, "Re-engagement message") : ok("wamid.2"); };
  assert.equal((await sendMetaMessage(cfg, { to: "57300", body: "hola", firstName: "", windowOpen: true }, req)).mode, "plantilla");
  assert.deepEqual(sent, ["text", "template"]);
});

test("errores: 500 se reintenta, 400 no; el token nunca aparece en el mensaje", async () => {
  await assert.rejects(sendMetaMessage(cfg, { to: "57300", body: "x", firstName: "", windowOpen: false }, async () => fail(500, 131000, "boom")), (e) => e instanceof MetaSendError && e.retryable && !e.message.includes("SECRET"));
  await assert.rejects(sendMetaMessage(cfg, { to: "57300", body: "x", firstName: "", windowOpen: false }, async () => fail(400, 132001, "Template name does not exist")), (e) => e instanceof MetaSendError && !e.retryable && /132001/.test(e.message));
  await assert.rejects(sendMetaMessage(cfg, { to: "57300", body: "x", firstName: "", windowOpen: false }, async () => { throw new Error("SECRET-TOKEN-123 in url"); }), (e) => e.retryable && !e.message.includes("SECRET"));
});

test("firma del webhook: solo acepta lo firmado con el App Secret", () => {
  const raw = JSON.stringify({ a: 1 });
  const sig = "sha256=" + createHmac("sha256", "app-secret").update(raw).digest("hex");
  assert.equal(validMetaSignature(raw, sig, "app-secret"), true);
  assert.equal(validMetaSignature(raw + " ", sig, "app-secret"), false);
  assert.equal(validMetaSignature(raw, sig, "otro"), false);
  assert.equal(validMetaSignature(raw, null, "app-secret"), false);
  assert.equal(validMetaSignature(raw, sig, undefined), false);
});

test("lee mensajes (con el mensaje citado) y estados del webhook", () => {
  const { messages, statuses } = parseMetaWebhook({ entry: [{ changes: [{ value: {
    messages: [{ id: "wamid.in", from: "573001234567", type: "text", text: { body: "Ya lo reviso" }, context: { id: "wamid.out" } }, { id: "x", from: "57", type: "image" }],
    statuses: [{ id: "wamid.out", status: "failed", errors: [{ title: "Undeliverable", error_data: { details: "Número no tiene WhatsApp" } }] }],
  } }] }] });
  assert.deepEqual(messages, [{ from: "573001234567", text: "Ya lo reviso", quotedId: "wamid.out", messageId: "wamid.in" }]);
  assert.deepEqual(statuses, [{ id: "wamid.out", status: "failed", errorText: "Número no tiene WhatsApp" }]);
});
