"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { categories, settings, users } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth";
import { ROLES, type Role } from "@/lib/constants";
import { sendEmail, smtpConfigured } from "@/lib/email/send";
import { renderTicketEmail } from "@/lib/email/template";
import { appUrl } from "@/lib/constants";
import { splitEmails } from "@/lib/tickets/notifications";
import { validatePassword } from "@/lib/auth/password";
import type { FormState } from "./auth";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanEmails(value: string) {
  const list = splitEmails(value);
  const bad = list.find((e) => !EMAIL_RE.test(e));
  if (bad) throw new Error(`"${bad}" no es un correo válido.`);
  return list.join(", ") || null;
}

export async function updateCategoryAction(_: FormState, formData: FormData): Promise<FormState> {
  await requireRole("admin");
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
    const patch: Partial<typeof users.$inferInsert> = { name, email, role, department, phone, active };
    if (password) {
      const pwError = validatePassword(password);
      if (pwError) return { error: pwError };
      patch.passwordHash = await bcrypt.hash(password, 10);
    }
    await db.update(users).set(patch).where(eq(users.id, id));
    if (role === "user") await db.update(categories).set({ responsibleId: null }).where(eq(categories.responsibleId, id));
  } else {
    const pwError = validatePassword(password);
    if (pwError) return { error: pwError };
    await db.insert(users).values({ name, email, role, department, phone, active, passwordHash: await bcrypt.hash(password, 10) });

    if (formData.get("sendWelcome") === "on") {
      const { html, text } = renderTicketEmail({
        preheader: "Ya tienes acceso a la Mesa de Ayuda ACF",
        eyebrow: "Bienvenida",
        heading: `Hola ${name.split(" ")[0]}, ya tienes acceso a la Mesa de Ayuda`,
        intro:
          "Desde la plataforma puedes registrar solicitudes de Diseño gráfico, IA, Cotizador, Redes sociales, Sistemas y Sinco Soft, y hacer seguimiento hasta su solución.",
        code: "Tu usuario",
        title: email,
        pills: [],
        details: [
          ["Usuario", email],
          ["Contraseña temporal", password],
        ],
        ctaLabel: "Ingresar a la Mesa de Ayuda",
        ctaUrl: appUrl("/login"),
      });
      await sendEmail({ kind: "welcome", to: [email], subject: "Tu acceso a la Mesa de Ayuda ACF", html, text });
    }
  }
  revalidatePath("/admin/usuarios");
  return { error: null, ok: id ? "Usuario actualizado." : "Usuario creado." };
}

export async function saveSettingsAction(_: FormState, formData: FormData): Promise<FormState> {
  await requireRole("admin");
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
  revalidatePath("/admin/configuracion");
  return { error: null, ok: "Configuración guardada." };
}

export async function sendTestEmailAction(_: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireRole("admin");
  const to = String(formData.get("to") ?? admin.email).trim();
  const { html, text } = renderTicketEmail({
    preheader: "Correo de prueba de la Mesa de Ayuda",
    eyebrow: "Prueba",
    heading: "La configuración de correo funciona",
    intro: "Si recibiste este mensaje, la Mesa de Ayuda puede enviar notificaciones.",
    code: "HD-00000",
    title: "Correo de prueba",
    pills: [{ label: "Prueba", color: "#ffffff", bg: "#19191b" }],
    details: [["Enviado por", admin.name]],
    ctaLabel: "Abrir la Mesa de Ayuda",
    ctaUrl: appUrl("/dashboard"),
  });
  await sendEmail({ kind: "test", to: [to], subject: "Prueba · Mesa de Ayuda ACF", html, text });
  revalidatePath("/admin/correos");
  return smtpConfigured()
    ? { error: null, ok: `Correo de prueba enviado a ${to}. Revisa el registro de correos.` }
    : { error: null, ok: "SMTP no configurado: el correo quedó registrado como simulado." };
}
