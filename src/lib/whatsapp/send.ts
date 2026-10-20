import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { after } from "next/server";
import { getDb } from "@/lib/db";
import { settings, users, whatsappLog } from "@/lib/db/schema";
import type { WaPref } from "./templates";

/**
 * Bandeja de salida de WhatsApp. No usa la API de Meta: los mensajes quedan "pendientes" y
 * los envía el servicio vinculado al WhatsApp del líder (carpeta whatsapp-bridge) o el líder
 * a mano con el botón «Enviar por WhatsApp».
 */

/** "300 123 4567" / "+57 300…" → "573001234567". Celulares colombianos de 10 dígitos reciben el 57. */
export function normalizePhone(input: string | null | undefined) {
  const digits = (input ?? "").replace(/\D/g, "");
  if (!digits) return null;
  const full = digits.length === 10 && digits.startsWith("3") ? `57${digits}` : digits;
  return full.length >= 11 && full.length <= 15 ? full : null;
}

export function waLink(phone: string, text: string) {
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

export async function enqueueWhatsapp(entry: { userId: number | null; phone: string; kind: string; body: string; ticketId?: number | null }) {
  const db = await getDb();
  await db.insert(whatsappLog).values({
    direction: "out",
    userId: entry.userId,
    phone: entry.phone,
    kind: entry.kind,
    body: entry.body.slice(0, 4000),
    ticketId: entry.ticketId ?? null,
    status: "pendiente",
  });
}

export function wantsWhatsapp(u: { whatsappOptIn: boolean; whatsappPhone: string | null; whatsappPrefs: Record<string, boolean>; active: boolean }, pref: WaPref) {
  return u.active && u.whatsappOptIn && Boolean(u.whatsappPhone) && u.whatsappPrefs[pref] !== false;
}

export type WaPerson = { id: number; name: string; firstName: string; role: string; accessToken: string | null };

/** Pone en la bandeja un mensaje para cada persona con WhatsApp activo y esa alerta habilitada. */
export async function whatsappUsers(
  userIds: number[],
  pref: WaPref,
  kind: string,
  message: (u: WaPerson) => string,
  meta: { ticketId?: number | null } = {}
) {
  const ids = Array.from(new Set(userIds)).filter(Boolean);
  if (ids.length === 0) return;
  const db = await getDb();
  const people = await db.select().from(users).where(and(inArray(users.id, ids), eq(users.whatsappOptIn, true)));
  for (const u of people) {
    if (!wantsWhatsapp(u, pref)) continue;
    await enqueueWhatsapp({
      userId: u.id,
      phone: u.whatsappPhone!,
      kind,
      ticketId: meta.ticketId ?? null,
      body: message({ id: u.id, name: u.name, firstName: u.name.split(" ")[0], role: u.role, accessToken: u.accessToken }),
    });
  }
}

/** Igual que whatsappUsers, sin bloquear la respuesta al usuario. */
export function queueWhatsapp(...args: Parameters<typeof whatsappUsers>) {
  const run = () => whatsappUsers(...args).catch((e) => console.error("[mesa-de-ayuda] Error en WhatsApp:", e));
  try {
    after(run);
  } catch {
    void run();
  }
}

export type BridgeState = { state: "desconocido" | "qr" | "conectado" | "desconectado"; qr?: string | null; me?: string | null; seenAt?: string | null; version?: string | null };

export async function getBridgeState(): Promise<BridgeState> {
  const db = await getDb();
  const [row] = await db.select().from(settings).where(eq(settings.key, "wa_bridge_state"));
  if (!row) return { state: "desconocido" };
  try {
    const s = JSON.parse(row.value) as BridgeState;
    // Sin noticias del servicio en 3 minutos = desconectado.
    if (s.seenAt && Date.now() - new Date(s.seenAt).getTime() > 3 * 60_000) return { ...s, state: "desconectado", qr: null };
    return s;
  } catch {
    return { state: "desconocido" };
  }
}

export async function setBridgeState(patch: Partial<BridgeState>) {
  const current = await getBridgeState();
  const next = { ...current, ...patch, seenAt: new Date().toISOString() };
  const db = await getDb();
  await db
    .insert(settings)
    .values({ key: "wa_bridge_state", value: JSON.stringify(next) })
    .onConflictDoUpdate({ target: settings.key, set: { value: JSON.stringify(next) } });
}
