"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { followups, tickets, users } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth";
import { toRemindAt } from "@/lib/followups/parse";
import { createTaskAction, updateTaskAction } from "./workspace";

type Result<T = null> = { ok: true; data: T } | { ok: false; error: string };
const fail = (error: string) => ({ ok: false as const, error });
const staff = () => requireRole("admin", "agent");
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

export type CaptureInput = {
  title: string;
  notes?: string;
  date: string | null;
  time: string | null;
  /** "recordatorio" = solo para mí; "tarea" = se crea una tarea asignada en un proyecto */
  kind: "recordatorio" | "tarea";
  personId?: number | null;
  projectId?: number | null;
  ticketId?: number | null;
  /** Para tareas: además recordarme revisar ese día */
  remindMe?: boolean;
};

export async function captureAction(input: CaptureInput): Promise<Result<{ kind: string; taskId?: number; projectId?: number }>> {
  const me = await staff();
  const title = input.title.trim();
  if (title.length < 3) return fail("Escribe qué debes hacer o a qué hacerle seguimiento.");
  if (input.date && !DATE_RE.test(input.date)) return fail("Fecha no válida.");
  if (input.time && !TIME_RE.test(input.time)) return fail("Hora no válida.");
  const db = await getDb();
  if (input.ticketId) {
    const [t] = await db.select({ id: tickets.id }).from(tickets).where(eq(tickets.id, input.ticketId));
    if (!t) return fail("La solicitud no existe.");
  }
  if (input.personId) {
    const [p] = await db.select({ id: users.id }).from(users).where(eq(users.id, input.personId));
    if (!p) return fail("Persona no válida.");
  }
  const remindAt = input.date ? toRemindAt(input.date, input.time) : null;

  if (input.kind === "tarea") {
    if (!input.projectId) return fail("Elige el proyecto donde se crea la tarea.");
    const r = await createTaskAction({ projectId: input.projectId, title, dueDate: input.date, assigneeId: input.personId ?? null });
    if (!r.ok) return r;
    if (input.notes?.trim()) await updateTaskAction(r.data.id, { description: input.notes.trim() });
    if (input.remindMe !== false && remindAt) {
      await db.insert(followups).values({
        ownerId: me.id,
        title: `Revisar: ${title}`,
        notes: input.notes?.trim() || null,
        remindAt,
        personId: input.personId ?? null,
        taskId: r.data.id,
        ticketId: input.ticketId ?? null,
      });
    }
    revalidatePath("/equipo/seguimientos");
    return { ok: true, data: { kind: "tarea", taskId: r.data.id, projectId: input.projectId } };
  }

  await db.insert(followups).values({
    ownerId: me.id,
    title: title.slice(0, 300),
    notes: input.notes?.trim().slice(0, 4000) || null,
    remindAt,
    personId: input.personId ?? null,
    ticketId: input.ticketId ?? null,
  });
  revalidatePath("/equipo/seguimientos");
  return { ok: true, data: { kind: "recordatorio" } };
}

async function own(id: number, userId: number) {
  const db = await getDb();
  const [f] = await db.select().from(followups).where(and(eq(followups.id, id), eq(followups.ownerId, userId)));
  return f ?? null;
}

export async function toggleFollowupAction(id: number): Promise<Result> {
  const me = await staff();
  const f = await own(id, me.id);
  if (!f) return fail("No encontrado.");
  const db = await getDb();
  const done = f.status !== "hecho";
  await db.update(followups).set({ status: done ? "hecho" : "pendiente", doneAt: done ? new Date() : null }).where(eq(followups.id, id));
  revalidatePath("/equipo/seguimientos");
  return { ok: true, data: null };
}

/** Posponer: nueva fecha/hora y se vuelve a avisar. */
export async function snoozeFollowupAction(id: number, date: string, time: string): Promise<Result> {
  const me = await staff();
  if (!DATE_RE.test(date) || !TIME_RE.test(time)) return fail("Fecha no válida.");
  const f = await own(id, me.id);
  if (!f) return fail("No encontrado.");
  const db = await getDb();
  await db.update(followups).set({ remindAt: toRemindAt(date, time), notifiedAt: null, status: "pendiente", doneAt: null }).where(eq(followups.id, id));
  revalidatePath("/equipo/seguimientos");
  return { ok: true, data: null };
}

export async function updateFollowupAction(id: number, patch: { title?: string; notes?: string }): Promise<Result> {
  const me = await staff();
  const f = await own(id, me.id);
  if (!f) return fail("No encontrado.");
  const db = await getDb();
  await db
    .update(followups)
    .set({
      ...(patch.title !== undefined ? { title: patch.title.trim().slice(0, 300) || f.title } : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes.trim().slice(0, 4000) || null } : {}),
    })
    .where(eq(followups.id, id));
  revalidatePath("/equipo/seguimientos");
  return { ok: true, data: null };
}

export async function deleteFollowupAction(id: number): Promise<Result> {
  const me = await staff();
  const db = await getDb();
  await db.delete(followups).where(and(eq(followups.id, id), eq(followups.ownerId, me.id)));
  revalidatePath("/equipo/seguimientos");
  return { ok: true, data: null };
}
