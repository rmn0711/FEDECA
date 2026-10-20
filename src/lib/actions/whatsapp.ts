"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { users, whatsappLog } from "@/lib/db/schema";
import { requireRole, requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { enqueueWhatsapp, normalizePhone } from "@/lib/whatsapp/send";
import { WA_PREF_LABELS, waMessage, type WaPref } from "@/lib/whatsapp/templates";
import type { FormState } from "./auth";

export async function saveMyWhatsappAction(_: FormState, formData: FormData): Promise<FormState> {
  const me = await requireUser();
  const raw = String(formData.get("phone") ?? "").trim();
  const optIn = formData.get("optIn") === "on";
  const phone = raw ? normalizePhone(raw) : null;
  if (raw && !phone) return { error: "Escribe un celular válido, por ejemplo 300 123 4567." };
  if (optIn && !phone) return { error: "Para recibir alertas por WhatsApp escribe tu celular." };
  const prefs = Object.fromEntries((Object.keys(WA_PREF_LABELS) as WaPref[]).map((k) => [k, formData.get(`pref_${k}`) === "on"]));
  const db = await getDb();
  const [before] = await db.select({ optIn: users.whatsappOptIn }).from(users).where(eq(users.id, me.id));
  await db.update(users).set({ whatsappPhone: phone, whatsappOptIn: optIn, whatsappPrefs: prefs }).where(eq(users.id, me.id));
  if (before && before.optIn !== optIn) {
    await audit(me.id, optIn ? "alta_whatsapp" : "baja_whatsapp", "usuario", me.id, `${me.name} ${optIn ? "activó" : "desactivó"} las alertas por WhatsApp`);
  }
  if (optIn && phone && !before?.optIn) {
    await enqueueWhatsapp({
      userId: me.id,
      phone,
      kind: "bienvenida",
      body: waMessage([`👋 Hola ${me.name.split(" ")[0]}, desde ahora recibirás aquí las alertas de *Conecta ACF*.`]),
    });
  }
  revalidatePath("/perfil");
  return { error: null, ok: optIn ? "Listo: recibirás alertas por WhatsApp." : "Preferencias guardadas." };
}

/** El líder envió el mensaje a mano desde su WhatsApp (botón «Enviar por WhatsApp»). */
export async function markManualSentAction(id: number) {
  const me = await requireRole("admin");
  const db = await getDb();
  await db
    .update(whatsappLog)
    .set({ status: "enviado_manual", statusAt: new Date(), error: null })
    .where(and(eq(whatsappLog.id, id), inArray(whatsappLog.status, ["pendiente", "fallido", "enviando"])));
  await audit(me.id, "enviar_manual", "configuracion", id, `Alerta de WhatsApp #${id} enviada a mano`);
  revalidatePath("/admin/whatsapp");
  return { ok: true as const };
}

export async function discardWhatsappAction(id: number) {
  await requireRole("admin");
  const db = await getDb();
  await db.update(whatsappLog).set({ status: "descartado", statusAt: new Date() }).where(and(eq(whatsappLog.id, id), inArray(whatsappLog.status, ["pendiente", "fallido"])));
  revalidatePath("/admin/whatsapp");
  return { ok: true as const };
}

export async function retryWhatsappAction(id: number) {
  await requireRole("admin");
  const db = await getDb();
  await db.update(whatsappLog).set({ status: "pendiente", attempts: 0, error: null }).where(and(eq(whatsappLog.id, id), eq(whatsappLog.status, "fallido")));
  revalidatePath("/admin/whatsapp");
  return { ok: true as const };
}

export async function sendTestWhatsappAction() {
  const me = await requireRole("admin");
  const db = await getDb();
  const [u] = await db.select().from(users).where(eq(users.id, me.id));
  if (!u?.whatsappPhone) return { ok: false as const, error: "Primero registra tu celular en Mi perfil." };
  await enqueueWhatsapp({ userId: me.id, phone: u.whatsappPhone, kind: "prueba", body: "✅ Prueba de Conecta ACF: los mensajes por WhatsApp funcionan." });
  revalidatePath("/admin/whatsapp");
  return { ok: true as const };
}
