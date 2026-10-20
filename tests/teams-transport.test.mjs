import assert from "node:assert/strict";
import test from "node:test";
import { postTeamsAlert, validateWorkflowUrl, workflowPayload } from "../src/lib/teams/transport.ts";

const workflow = "https://default.example.environment.api.powerplatform.com/powerautomate/automations/direct/workflows/flow/triggers/manual/paths/invoke?sig=private";
const alert = { title: "Te asignaron HD-00125", body: "Revisar <script> & confirmar", url: "/solicitudes/125" };

test("bloquea destinos ajenos a Microsoft y enlaces de notificación externos", () => {
  for (const url of ["http://default.example.environment.api.powerplatform.com/invoke", "https://logic.azure.com.attacker.test/invoke", "https://127.0.0.1/invoke", "https://evil@west.logic.azure.com/invoke"]) {
    assert.throws(() => validateWorkflowUrl(url));
  }
  assert.throws(() => workflowPayload("a@acfcia.com", { ...alert, url: "//attacker.test" }, "https://conecta-acf-hd.vercel.app"));
});

test("usa el correo exacto y escapa texto antes de enviarlo al chat", () => {
  const payload = workflowPayload("ELIAS@acfcia.com", alert, "https://conecta-acf-hd.vercel.app");
  assert.equal(payload.recipient, "elias@acfcia.com");
  assert.match(payload.message, /&lt;script&gt; &amp;/);
  assert.doesNotMatch(payload.message, /<script>/);
  assert.equal(payload.attachments[0].content.actions[0].url, "https://conecta-acf-hd.vercel.app/solicitudes/125");
});

test("envía una sola vez y trata 202 como aceptación, sin seguir redirecciones", async () => {
  let calls = 0;
  const request = async (url, init) => {
    calls++;
    assert.equal(String(url), workflow);
    assert.equal(init?.redirect, "error");
    assert.equal(init?.method, "POST");
    assert.equal(JSON.parse(String(init?.body)).recipient, "elias@acfcia.com");
    return new Response(null, { status: 202 });
  };
  assert.deepEqual(await postTeamsAlert(workflow, "elias@acfcia.com", alert, "https://conecta-acf-hd.vercel.app", request), { accepted: true });
  assert.equal(calls, 1);
});

test("un fallo de envío no revela la firma y no se reintenta", async () => {
  let calls = 0;
  const request = async () => { calls++; return new Response("sig=private", { status: 429 }); };
  await assert.rejects(postTeamsAlert(workflow, "elias@acfcia.com", alert, "https://conecta-acf-hd.vercel.app", request), { message: "Teams rechazó el aviso (HTTP 429)." });
  assert.equal(calls, 1);
});
