"use server";

import { audit } from "@/lib/audit";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { categories, settings, users } from "@/lib/db/schema";
import { requireRole, revokeSessions, startSession } from "@/lib/auth";
import { ROLES, type Role } from "@/lib/constants";
import { sendEmail, smtpConfigured } from "@/lib/email/send";
import { renderTicketEmail } from "@/lib/email/template";
import { appUrl } from "@/lib/constants";
import { splitEmails } from "@/lib/tickets/notifications";
import { validatePassword } from "@/lib/auth/password";
import { accessUrl, ensureAccessToken, newAccessToken, sendAccessLinkEmail } from "@/lib/auth/access";
import { normalizePhone } from "@/lib/whatsapp/send";
import type { FormState } from "./auth";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanEmails(value: string) {
  const list = splitEmails(value);
  const bad = list.find((e) => !EMAIL_RE.test(e));
  if (bad) throw new Error(`"${bad}" no es un correo válido.`);
  return list.join(", ") || null;
}

export async function updateCategoryAction(_: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireRole("admin");
  const slug = String(formData.get("slug") ?? "");
  const responsible = String(formData.get("responsibleId") ?? "");
  let ccEmails: string | null;
  try {
    ccEmails = cleanEmails(String(formData.get("ccEmails") ?? ""));
  } catch (e) {
    return { error: (e as Error).message };
  }
  const db = await getDb();
  const responsibleId = responsible && responsible !== "none" ? Number(responsible) : null;
  if (responsibleId) {
    const [u] = await db.select().from(users).where(eq(users.id, responsibleId));
    if (!u || u.role === "user") return { error: "El responsable debe tener rol Responsable o Administrador." };
  }
  await db
    .update(categories)
    .set({ responsibleId, ccEmails, active: formData.get("active") === "on" })
    .where(eq(categories.slug, slug));
  const [resp] = responsibleId ? await db.select({ name: users.name }).from(users).where(eq(users.id, responsibleId)) : [];
  await audit(admin.id, "actualizar", "categoria", slug, `Categoría ${slug}: responsable ${resp?.name ?? "ninguno"}${formData.get("active") === "on" ? "" : " (desactivada)"}`, {
    responsibleId,
    ccEmails,
  });
  revalidatePath("/admin/categorias");
  revalidatePath("/solicitudes/nueva");
  return { error: null, ok: "Categoría actualizada." };
}

export async function saveUserAction(_: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireRole("admin");
  const id = Number(formData.get("id")) || null;
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "user") as Role;
  const department = String(formData.get("department") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const active = formData.get("active") !== "off";
  const waRaw = String(formData.get("whatsappPhone") ?? "").trim();
  const whatsappPhone = waRaw ? normalizePhone(waRaw) : null;
  if (waRaw && !whatsappPhone) return { error: "El celular de WhatsApp no es válido (ej. 300 123 4567)." };
  const whatsappOptIn = formData.get("whatsappOptIn") === "on" && Boolean(whatsappPhone);
  const password = String(formData.get("password") ?? "");

  if (name.length < 3) return { error: "Escribe el nombre completo." };
  if (!EMAIL_RE.test(email)) return { error: "Correo no válido." };
  if (!ROLES.includes(role)) return { error: "Rol no válido." };
  if (id === admin.id && (role !== "admin" || !active)) {
    return { error: "No puedes quitarte el rol de administrador ni desactivar tu propia cuenta." };
  }

  const db = await getDb();
  const [dup] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (dup && dup.id !== id) return { error: "Ya existe un usuario con ese correo." };

  if (id) {
    const patch: Partial<typeof users.$inferInsert> = { name, email, role, department, phone, active, whatsappPhone, whatsappOptIn };
    if (password) {
      const pwError = validatePassword(password);
      if (pwError) return { error: pwError };
      patch.passwordHash = await bcrypt.hash(password, 10);
    }
    const [before] = await db.select().from(users).where(eq(users.id, id));
    await db.update(users).set(patch).where(eq(users.id, id));
    if (password) {
      await revokeSessions(id);
      if (id === admin.id) await startSession(id);
    }
    const changes: string[] = [];
    if (before && before.role !== role) changes.push(`rol ${before.role} → ${role}`);
    if (before && before.active !== active) changes.push(active ? "activado" : "desactivado");
    if (before && before.email !== email) changes.push(`correo ${before.email} → ${email}`);
    if (password) changes.push("contraseña restablecida");
    await audit(admin.id, "actualizar", "usuario", id, `Usuario ${name}${changes.length ? `: ${changes.join(", ")}` : " actualizado"}`, { role, active });
    if (role === "user") await db.update(categories).set({ responsibleId: null }).where(eq(categories.responsibleId, id));
  } else {
    // Sin contraseña: la persona la crea al abrir su enlace de acceso.
    if (password) {
      const pwError = validatePassword(password);
      if (pwError) return { error: pwError };
    }
    const [created] = await db
      .insert(users)
      .values({ name, email, role, department, phone, active, whatsappPhone, whatsappOptIn, passwordHash: password ? await bcrypt.hash(password, 10) : "", accessToken: newAccessToken() })
      .returning();
    await audit(admin.id, "crear", "usuario", created.id, `Usuario creado: ${name} (${email}) con rol ${role}`);

    if (formData.get("sendWelcome") === "on" && !password) {
      await sendAccessLinkEmail(created);
    } else if (formData.get("sendWelcome") === "on") {
      const { html, text } = renderTicketEmail({
        preheader: "Ya tienes acceso a Conecta ACF",
        eyebrow: "¡Bienvenido!",
        heading: `${name.split(" ")[0]}, ya eres parte de Conecta ACF 🎉`,
        intro:
          "Aquí pides lo que necesites a Diseño gráfico, IA, Cotizador, CRM, Redes sociales, Sistemas y Sinco Soft, y ves en todo momento cómo va tu solicitud.\n\nEntra con estos datos y cambia la contraseña temporal en Mi perfil.",
        code: "Tu usuario",
        title: email,
        pills: [],
        details: [
          ["Usuario", email],
          ["Contraseña temporal", password],
        ],
        ctaLabel: "Ingresar a Conecta ACF",
        ctaUrl: appUrl("/login"),
      });
      await sendEmail({ kind: "welcome", to: [email], subject: "Tu acceso a Conecta ACF", html, text });
    }
  }
  revalidatePath("/admin/usuarios");
  return { error: null, ok: id ? "Usuario actualizado." : "Usuario creado." };
}

export async function saveSettingsAction(_: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireRole("admin");
  let notify: string | null;
  try {
    notify = cleanEmails(String(formData.get("notifyEmails") ?? ""));
  } catch (e) {
    return { error: (e as Error).message };
  }
  const db = await getDb();
  await db
    .insert(settings)
    .values({ key: "notify_emails", value: notify ?? "" })
    .onConflictDoUpdate({ target: settings.key, set: { value: notify ?? "" } });
  await audit(admin.id, "actualizar", "configuracion", "notify_emails", `Correos de la mesa de ayuda: ${notify || "administradores"}`);
  revalidatePath("/admin/configuracion");
  return { error: null, ok: "Configuración guardada." };
}

export async function sendTestEmailAction(_: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireRole("admin");
  const to = String(formData.get("to") ?? admin.email).trim();
  const { html, text } = renderTicketEmail({
    preheader: "Correo de prueba de Conecta ACF",
    eyebrow: "Correo de prueba",
    heading: "¡Funciona! El correo de Conecta ACF está listo ✅",
    intro: "Si estás leyendo esto, Conecta ACF ya puede enviar avisos de solicitudes, respuestas, recordatorios y accesos.",
    code: "HD-00000",
    title: "Correo de prueba",
    pills: [{ label: "Prueba", color: "#ffffff", bg: "#19191b" }],
    details: [["Enviado por", admin.name]],
    compact: true,
    signoff: { name: admin.name, role: "Conecta ACF" },
    ctaLabel: "Abrir Conecta ACF",
    ctaUrl: appUrl("/dashboard"),
  });
  await sendEmail({ kind: "test", to: [to], subject: "Prueba · Conecta ACF", html, text });
  revalidatePath("/admin/correos");
  return smtpConfigured()
    ? { error: null, ok: `Correo de prueba enviado a ${to}. Revisa el registro de correos.` }
    : { error: null, ok: "SMTP no configurado: el correo quedó registrado como simulado." };
}

// ── Enlaces personales de acceso ──

export async function getAccessLinkAction(userId: number) {
  await requireRole("admin");
  return accessUrl(await ensureAccessToken(userId));
}

export async function sendAccessLinkAction(userId: number) {
  const admin = await requireRole("admin");
  const db = await getDb();
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  if (!u || !u.active) return { ok: false as const, error: "Usuario no encontrado o inactivo." };
  await sendAccessLinkEmail(u);
  await audit(admin.id, "enviar_enlace", "usuario", u.id, `Enlace de acceso enviado a ${u.name} (${u.email})`);
  return { ok: true as const };
}

export async function regenerateAccessLinkAction(userId: number) {
  const admin = await requireRole("admin");
  const db = await getDb();
  const [u] = await db.update(users).set({ accessToken: newAccessToken() }).where(eq(users.id, userId)).returning();
  if (!u) return { ok: false as const, error: "Usuario no encontrado." };
  await audit(admin.id, "regenerar_enlace", "usuario", u.id, `Enlace de acceso regenerado para ${u.name} (el anterior dejó de funcionar)`);
  return { ok: true as const, data: accessUrl(u.accessToken!) };
}

/** Envía el enlace a todos los solicitantes activos que nunca han ingresado. */
export async function sendAccessLinksToNewRequestersAction() {
  const admin = await requireRole("admin");
  const db = await getDb();
  const pending = (await db.select().from(users).where(eq(users.active, true))).filter((u) => u.role === "user" && !u.lastLoginAt);
  for (const u of pending) await sendAccessLinkEmail(u);
  await audit(admin.id, "enviar_enlace", "usuario", null, `Enlace de acceso enviado a ${pending.length} solicitante(s) sin ingreso`);
  return { ok: true as const, data: pending.length };
}
