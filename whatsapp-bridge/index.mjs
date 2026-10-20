/**
 * Puente de WhatsApp de la plataforma.
 *
 * Se vincula al WhatsApp del líder como un dispositivo más (igual que WhatsApp Web) y:
 *  1. Toma de la plataforma las alertas pendientes y las envía con pausas y límites.
 *  2. Reenvía a la plataforma SOLO las respuestas a esas alertas (mensajes que citan una
 *     alerta o traen un código HD-xxxxx). El resto de tus chats nunca sale de este equipo.
 *
 * Toda la comunicación con la plataforma va por HTTPS con el token WHATSAPP_BRIDGE_TOKEN.
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pino from "pino";
import QRCode from "qrcode";
import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, Browsers } from "@whiskeysockets/baileys";


const DIR = path.dirname(fileURLToPath(import.meta.url));
const PLATFORM = (process.env.PLATFORM_URL || "").replace(/\/$/, "");
const TOKEN = process.env.WHATSAPP_BRIDGE_TOKEN || "";
const MAX_PER_HOUR = Number(process.env.MAX_PER_HOUR || 40);
const MAX_PER_DAY = Number(process.env.MAX_PER_DAY || 200);
const MIN_DELAY = Number(process.env.MIN_DELAY || 6) * 1000;
const MAX_DELAY = Number(process.env.MAX_DELAY || 15) * 1000;
const FROM_HOUR = Number(process.env.SEND_FROM_HOUR || 6);
const TO_HOUR = Number(process.env.SEND_TO_HOUR || 21);
const VERSION = "1.0.0";

if (!PLATFORM.startsWith("https://") && !PLATFORM.startsWith("http://localhost")) {
  console.error("PLATFORM_URL debe ser https:// (o http://localhost para pruebas).");
  process.exit(1);
}
if (TOKEN.length < 24) {
  console.error("Falta WHATSAPP_BRIDGE_TOKEN (mínimo 24 caracteres) en el archivo .env");
  process.exit(1);
}

const log = pino({ level: "warn" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const say = (...a) => console.log(new Date().toLocaleString("es-CO"), "·", ...a);

// Ids de las alertas enviadas: solo se reenvían respuestas que citan una de ellas.
const SENT_FILE = path.join(DIR, "sent-ids.json");
const sentIds = new Set(fs.existsSync(SENT_FILE) ? JSON.parse(fs.readFileSync(SENT_FILE, "utf8")).slice(-5000) : []);
const saveSent = () => fs.writeFileSync(SENT_FILE, JSON.stringify([...sentIds].slice(-5000)));

async function api(pathname, options = {}) {
  const res = await fetch(`${PLATFORM}${pathname}`, {
    ...options,
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json", ...(options.headers || {}) },
  });
  if (res.status === 401) throw new Error("Token rechazado por la plataforma (revisa WHATSAPP_BRIDGE_TOKEN).");
  if (!res.ok) throw new Error(`La plataforma respondió ${res.status}`);
  return res.json();
}

const report = (body) => api("/api/whatsapp/bridge/estado", { method: "POST", body: JSON.stringify({ version: VERSION, ...body }) }).catch((e) => say("No se pudo informar el estado:", e.message));

// Límites de envío
const sentLog = [];
function canSend() {
  const now = Date.now();
  while (sentLog.length && now - sentLog[0] > 86_400_000) sentLog.shift();
  const lastHour = sentLog.filter((t) => now - t < 3_600_000).length;
  const hour = new Date().getHours();
  return lastHour < MAX_PER_HOUR && sentLog.length < MAX_PER_DAY && hour >= FROM_HOUR && hour < TO_HOUR;
}

let sock = null;
let connected = false;
let me = null;

function textOf(msg) {
  const m = msg.message || {};
  return m.conversation || m.extendedTextMessage?.text || m.imageMessage?.caption || m.videoMessage?.caption || "";
}

function quotedIdOf(msg) {
  const m = msg.message || {};
  return m.extendedTextMessage?.contextInfo?.stanzaId || m.imageMessage?.contextInfo?.stanzaId || null;
}

/** Número del remitente (formato 573001234567), también cuando WhatsApp usa identificadores @lid. */
function phoneOf(msg) {
  const k = msg.key || {};
  const candidates = [k.senderPn, k.remoteJidAlt, k.participantPn, k.remoteJid];
  const jid = candidates.find((j) => typeof j === "string" && j.endsWith("@s.whatsapp.net"));
  return jid ? jid.split("@")[0].split(":")[0] : null;
}

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState(path.join(DIR, "auth"));
  const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: undefined }));
  sock = makeWASocket({
    version,
    auth: state,
    logger: log,
    browser: Browsers.appropriate("Mesa de Ayuda ACF"),
    markOnlineOnConnect: false,
    syncFullHistory: false,
  });
  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      connected = false;
      say("Escanea el código QR desde la plataforma (Configuración → WhatsApp).");
      const dataUrl = await QRCode.toDataURL(qr, { margin: 1, width: 320 });
      await report({ state: "qr", qr: dataUrl });
    }
    if (connection === "open") {
      connected = true;
      me = (sock.user?.id || "").split(":")[0].split("@")[0];
      say(`Conectado como +${me}`);
      await report({ state: "conectado", me });
    }
    if (connection === "close") {
      connected = false;
      const code = lastDisconnect?.error?.output?.statusCode;
      if (code === DisconnectReason.loggedOut) {
        say("La sesión se cerró desde el teléfono. Borrando la sesión local; vuelve a escanear el QR.");
        fs.rmSync(path.join(DIR, "auth"), { recursive: true, force: true });
      } else {
        say("Conexión cerrada, reconectando…", code ?? "");
      }
      await report({ state: "desconectado" });
      setTimeout(start, 5000);
    }
  });

  // Solo se reenvían respuestas a alertas: tus demás conversaciones no salen de este equipo.
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    for (const msg of messages) {
      if (msg.key.fromMe || msg.key.remoteJid?.endsWith("@g.us") || msg.key.remoteJid === "status@broadcast") continue;
      const text = textOf(msg).trim();
      const quotedId = quotedIdOf(msg);
      const isReply = quotedId && sentIds.has(quotedId);
      const hasCode = /\bHD-\d{1,9}\b/i.test(text);
      const isOptOut = /^\s*(baja|stop)\s*[.!]*\s*$/i.test(text);
      if (!text || !(isReply || hasCode || isOptOut)) continue;
      const from = phoneOf(msg);
      if (!from) continue;
      try {
        await api("/api/whatsapp/bridge/entrante", { method: "POST", body: JSON.stringify({ from, text, quotedId, messageId: msg.key.id }) });
        say(`Respuesta de +${from} enviada a la plataforma.`);
      } catch (e) {
        say("No se pudo reenviar la respuesta:", e.message);
      }
    }
  });
}

async function sendLoop() {
  for (;;) {
    try {
      await report({ state: connected ? "conectado" : "desconectado", me });
      if (connected && canSend()) {
        const { messages } = await api("/api/whatsapp/bridge/outbox?limit=5");
        for (const m of messages) {
          if (!connected || !canSend()) break;
          try {
            const jid = `${String(m.phone).replace(/\D/g, "")}@s.whatsapp.net`;
            const [exists] = await sock.onWhatsApp(jid);
            if (!exists?.exists) throw new Error("El número no tiene WhatsApp");
            await sock.sendPresenceUpdate("composing", exists.jid);
            await sleep(1500 + Math.random() * 2000);
            const sent = await sock.sendMessage(exists.jid, { text: m.body });
            sentIds.add(sent.key.id);
            saveSent();
            sentLog.push(Date.now());
            await api("/api/whatsapp/bridge/resultado", { method: "POST", body: JSON.stringify({ id: m.id, ok: true, waMessageId: sent.key.id }) });
            say(`Enviado a +${m.phone}`);
          } catch (e) {
            await api("/api/whatsapp/bridge/resultado", { method: "POST", body: JSON.stringify({ id: m.id, ok: false, error: e.message }) }).catch(() => {});
            say(`No se pudo enviar a +${m.phone}:`, e.message);
          }
          await sleep(MIN_DELAY + Math.random() * (MAX_DELAY - MIN_DELAY));
        }
      }
    } catch (e) {
      say("Error consultando la plataforma:", e.message);
    }
    await sleep(20_000);
  }
}

say(`Puente de WhatsApp v${VERSION} → ${PLATFORM}`);
await start();
sendLoop();
