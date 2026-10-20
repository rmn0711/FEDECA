"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getCategory } from "@/lib/categories";
import { TicketError } from "@/lib/tickets/access";
import {
  addComment,
  assignTicket,
  changeCategory,
  changeStatus,
  changeUrgency,
  createTicket,
  rateTicket,
} from "@/lib/tickets/service";
import type { FormState } from "./auth";

function files(formData: FormData) {
  return formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
}

async function run(fn: () => Promise<unknown>, ok: string, ticketId?: number): Promise<FormState> {
  try {
    await fn();
  } catch (e) {
    if (e instanceof TicketError) return { error: e.message };
    console.error(e);
    return { error: "Ocurrió un error inesperado. Intenta de nuevo." };
  }
  if (ticketId) revalidatePath(`/solicitudes/${ticketId}`);
  revalidatePath("/solicitudes");
  revalidatePath("/dashboard");
  return { error: null, ok };
}

export async function createTicketAction(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const slug = String(formData.get("category") ?? "");
  const def = getCategory(slug);
  const fields: Record<string, string | string[]> = {};
  for (const f of def?.fields ?? []) {
    fields[f.key] = f.type === "multiselect" ? formData.getAll(`f_${f.key}`).map(String) : String(formData.get(`f_${f.key}`) ?? "");
  }
  let id: number;
  try {
    const ticket = await createTicket(
      user,
      {
        categorySlug: slug,
        title: String(formData.get("title") ?? ""),
        description: String(formData.get("description") ?? ""),
        urgency: String(formData.get("urgency") ?? ""),
        fields,
        ccEmails: String(formData.get("cc") ?? ""),
      },
      files(formData)
    );
    id = ticket.id;
  } catch (e) {
    if (e instanceof TicketError) return { error: e.message };
    console.error(e);
    return { error: "No se pudo registrar la solicitud. Intenta de nuevo." };
  }
  revalidatePath("/solicitudes");
  redirect(`/solicitudes/${id}?creada=1`);
}

export async function commentAction(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const id = Number(formData.get("ticketId"));
  const internal = formData.get("internal") === "1";
  return run(
    () => addComment(user, id, { body: String(formData.get("body") ?? ""), internal }, files(formData)),
    internal ? "Nota interna guardada." : "Respuesta enviada por la plataforma y por correo.",
    id
  );
}

export async function statusAction(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const id = Number(formData.get("ticketId"));
  return run(
    () => changeStatus(user, id, String(formData.get("status") ?? ""), String(formData.get("comment") ?? "")),
    "Estado actualizado y notificado por correo.",
    id
  );
}

export async function assignAction(ticketId: number, assigneeId: number | null): Promise<FormState> {
  const user = await requireUser();
  return run(() => assignTicket(user, ticketId, assigneeId), "Responsable actualizado.", ticketId);
}

export async function urgencyAction(ticketId: number, urgency: string): Promise<FormState> {
  const user = await requireUser();
  return run(() => changeUrgency(user, ticketId, urgency), "Prioridad y tiempos de respuesta actualizados.", ticketId);
}

export async function categoryAction(ticketId: number, slug: string): Promise<FormState> {
  const user = await requireUser();
  return run(() => changeCategory(user, ticketId, slug), "Categoría actualizada.", ticketId);
}

export async function rateAction(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const id = Number(formData.get("ticketId"));
  return run(
    () => rateTicket(user, id, Number(formData.get("rating")), String(formData.get("comment") ?? "")),
    "¡Gracias por calificar la atención!",
    id
  );
}

/** Cambio rápido de estado desde el pipeline (arrastrar): solo entre estados abiertos, sin comentario. */
export async function quickTicketStatusAction(ticketId: number, status: string): Promise<FormState> {
  const user = await requireUser();
  if (!["abierto", "en_progreso", "en_espera"].includes(status)) {
    return { error: "Para resolver o cerrar, abre la solicitud y describe la solución." };
  }
  return run(() => changeStatus(user, ticketId, status, null), "Estado actualizado y notificado por correo.", ticketId);
}
