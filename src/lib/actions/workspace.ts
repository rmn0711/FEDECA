"use server";

import { audit } from "@/lib/audit";
import { and, asc, desc, eq, gt, inArray, lt, max } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { getDb } from "@/lib/db";
import { categories, pages, projects, taskComments, tasks, tickets, users } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth";
import { URGENCIES, URGENCY_META, appUrl, ticketCode, type Urgency } from "@/lib/constants";
import {
  RECURRENCES,
  TASK_STATUSES,
  TASK_STATUS_META,
  addDaysISO,
  formatShortDate,
  nextOccurrence,
  type ChecklistItem,
  type Recurrence,
  type TaskStatus,
} from "@/lib/workspace/constants";
import { getTaskDetail, type TaskDetail } from "@/lib/workspace/queries";
import { getTemplate } from "@/lib/workspace/templates";
import { canManageTicket } from "@/lib/tickets/access";
import { sendEmail } from "@/lib/email/send";
import { sendPush } from "@/lib/push";
import { renderTicketEmail } from "@/lib/email/template";
import type { FormState } from "./auth";

type Result<T = null> = { ok: true; data: T } | { ok: false; error: string };
const fail = (error: string) => ({ ok: false as const, error });
const okr = <T,>(data: T) => ({ ok: true as const, data });

const staff = () => requireRole("admin", "agent");
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function refreshWorkspace(projectId?: number) {
  revalidatePath("/equipo", "layout");
  if (projectId) revalidatePath(`/equipo/proyectos/${projectId}`);
}

// ── Proyectos ──────────────────────────────────────────────

export async function saveProjectAction(_: FormState, formData: FormData): Promise<FormState> {
  const me = await requireRole("admin");
  const id = Number(formData.get("id")) || null;
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const icon = String(formData.get("icon") ?? "📁").slice(0, 8) || "📁";
  const color = /^#[0-9a-f]{6}$/i.test(String(formData.get("color"))) ? String(formData.get("color")) : "#d9342c";
  if (name.length < 2) return { error: "Escribe el nombre del proyecto." };
  const db = await getDb();
  if (id) {
    await db.update(projects).set({ name, description, icon, color }).where(eq(projects.id, id));
    await audit(me.id, "actualizar", "proyecto", id, `Proyecto actualizado: ${icon} ${name}`);
  } else {
    const [{ value }] = await db.select({ value: max(projects.sort) }).from(projects);
    const [p] = await db.insert(projects).values({ name, description, icon, color, sort: (value ?? 0) + 1, createdBy: me.id }).returning();
    await audit(me.id, "crear", "proyecto", p.id, `Proyecto creado: ${icon} ${name}`);
  }
  refreshWorkspace(id ?? undefined);
  return { error: null, ok: id ? "Proyecto actualizado." : "Proyecto creado." };
}

export async function archiveProjectAction(id: number, archived: boolean): Promise<Result> {
  const me = await requireRole("admin");
  const db = await getDb();
  const [p] = await db.update(projects).set({ archived }).where(eq(projects.id, id)).returning();
  if (p) await audit(me.id, archived ? "archivar" : "restaurar", "proyecto", id, `Proyecto ${archived ? "archivado" : "restaurado"}: ${p.name}`);
  refreshWorkspace(id);
  return okr(null);
}

// ── Tareas ─────────────────────────────────────────────────

async function notifyAssignment(taskId: number, actorId: number) {
  const detail = await getTaskDetail(taskId);
  if (!detail?.task.assigneeId || detail.task.assigneeId === actorId) return;
  const db = await getDb();
  const [[assignee], [actor]] = await Promise.all([
    db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, detail.task.assigneeId)),
    db.select({ name: users.name }).from(users).where(eq(users.id, actorId)),
  ]);
  if (!assignee) return;
  const t = detail.task;
  const { html, text } = renderTicketEmail({
    preheader: `${actor?.name ?? "El líder"} te asignó una tarea en ${detail.projectName}`,
    eyebrow: "Espacio de equipo · tarea asignada",
    heading: `${assignee.name.split(" ")[0]}, tienes una nueva tarea`,
    intro: `${actor?.name ?? "Tu líder"} te asignó esta tarea en el proyecto ${detail.projectIcon} ${detail.projectName}.`,
    code: `Tarea #${t.id}`,
    title: t.title,
    pills: [
      { label: TASK_STATUS_META[t.status].label, color: "#ffffff", bg: "#19191b" },
      { label: `Prioridad ${URGENCY_META[t.priority].label}`, color: "#b84f22", bg: "#fdebe2" },
      ...t.tags.slice(0, 4).map((tag) => ({ label: tag, color: "#4a4a4d", bg: "#efeff0" })),
    ],
    details: [
      ["Proyecto", `${detail.projectIcon} ${detail.projectName}`],
      ["Fecha de entrega", t.dueDate ? formatShortDate(t.dueDate) : "Sin fecha"],
    ],
    message: t.description ? { author: actor?.name ?? "", body: t.description.slice(0, 1500), label: "Descripción" } : null,
    ctaLabel: "Abrir la tarea",
    ctaUrl: appUrl(`/equipo/proyectos/${t.projectId}?tarea=${t.id}`),
  });
  await sendEmail({ kind: "task", to: [assignee.email], subject: `Tarea asignada: ${t.title}`, html, text });
  await sendPush([t.assigneeId!], {
    title: `Nueva tarea · ${detail.projectName}`,
    body: `${actor?.name ?? ""}: ${t.title}`,
    url: `/equipo/proyectos/${t.projectId}?tarea=${t.id}`,
  });
}

function queue(fn: () => Promise<unknown>) {
  const task = () => fn().catch((e) => console.error("[mesa-de-ayuda] Error en notificación de tarea:", e));
  try {
    after(task);
  } catch {
    void task();
  }
}

/**
 * Al completar una tarea recurrente se crea la siguiente, con las fechas corridas
 * y el checklist reiniciado. La serie continúa en la nueva tarea.
 */
async function spawnNextOccurrence(taskId: number, actorId: number) {
  const db = await getDb();
  const [t] = await db.select().from(tasks).where(eq(tasks.id, taskId));
  if (!t || t.recurrence === "none" || !t.dueDate) return null;
  const due = nextOccurrence(t.dueDate, t.recurrence);
  const start = t.startDate ? nextOccurrence(t.startDate, t.recurrence) : null;
  const [next] = await db
    .insert(tasks)
    .values({
      projectId: t.projectId,
      title: t.title,
      description: t.description,
      priority: t.priority,
      assigneeId: t.assigneeId,
      tags: t.tags,
      checklist: t.checklist.map((c) => ({ ...c, done: false })),
      startDate: start,
      dueDate: due,
      recurrence: t.recurrence,
      status: "por_hacer",
      sort: await nextSort(t.projectId, "por_hacer"),
      createdBy: actorId,
    })
    .returning();
  await db.update(tasks).set({ recurrence: "none" }).where(eq(tasks.id, taskId));
  return next;
}

async function nextSort(projectId: number, status: TaskStatus) {
  const db = await getDb();
  const [{ value }] = await db
    .select({ value: max(tasks.sort) })
    .from(tasks)
    .where(and(eq(tasks.projectId, projectId), eq(tasks.status, status)));
  return (value ?? 0) + 1024;
}

export async function createTaskAction(input: {
  projectId: number;
  title: string;
  status?: string;
  dueDate?: string | null;
  assigneeId?: number | null;
}): Promise<Result<{ id: number }>> {
  const me = await staff();
  const title = input.title.trim();
  if (!title) return fail("Escribe el nombre de la tarea.");
  if (title.length > 200) return fail("El nombre es demasiado largo.");
  const status = (TASK_STATUSES.includes(input.status as TaskStatus) ? input.status : "por_hacer") as TaskStatus;
  const dueDate = input.dueDate && DATE_RE.test(input.dueDate) ? input.dueDate : null;
  const db = await getDb();
  const [project] = await db.select().from(projects).where(eq(projects.id, input.projectId));
  if (!project) return fail("El proyecto no existe.");
  const [task] = await db
    .insert(tasks)
    .values({
      projectId: project.id,
      title,
      status,
      dueDate,
      assigneeId: input.assigneeId ?? null,
      sort: await nextSort(project.id, status),
      createdBy: me.id,
      completedAt: status === "hecho" ? new Date() : null,
    })
    .returning();
  if (task.assigneeId) queue(() => notifyAssignment(task.id, me.id));
  refreshWorkspace(project.id);
  return okr({ id: task.id });
}

export type TaskPatch = Partial<{
  title: string;
  description: string;
  status: string;
  priority: string;
  assigneeId: number | null;
  startDate: string | null;
  dueDate: string | null;
  tags: string[];
  checklist: ChecklistItem[];
  projectId: number;
  recurrence: string;
}>;

export async function updateTaskAction(id: number, patch: TaskPatch): Promise<Result> {
  const me = await staff();
  const db = await getDb();
  const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
  if (!task) return fail("La tarea no existe.");
  const set: Partial<typeof tasks.$inferInsert> = { updatedAt: new Date() };

  if (patch.title !== undefined) {
    const t = patch.title.trim();
    if (!t) return fail("La tarea necesita un nombre.");
    set.title = t.slice(0, 200);
  }
  if (patch.description !== undefined) set.description = patch.description.slice(0, 50_000);
  if (patch.status !== undefined) {
    if (!TASK_STATUSES.includes(patch.status as TaskStatus)) return fail("Estado no válido.");
    set.status = patch.status as TaskStatus;
    if (patch.status !== task.status) {
      set.completedAt = patch.status === "hecho" ? new Date() : null;
      set.sort = await nextSort(task.projectId, patch.status as TaskStatus);
    }
  }
  if (patch.priority !== undefined) {
    if (!URGENCIES.includes(patch.priority as Urgency)) return fail("Prioridad no válida.");
    set.priority = patch.priority as Urgency;
  }
  if (patch.assigneeId !== undefined) {
    if (patch.assigneeId !== null) {
      const [u] = await db.select().from(users).where(eq(users.id, patch.assigneeId));
      if (!u || !u.active || u.role === "user") return fail("Solo se puede asignar a miembros activos del equipo.");
    }
    set.assigneeId = patch.assigneeId;
  }
  for (const key of ["startDate", "dueDate"] as const) {
    const v = patch[key];
    if (v !== undefined) {
      if (v !== null && v !== "" && !DATE_RE.test(v)) return fail("Fecha no válida.");
      set[key] = v || null;
    }
  }
  if (patch.tags !== undefined) {
    set.tags = Array.from(new Set(patch.tags.map((t) => t.trim()).filter(Boolean))).slice(0, 12).map((t) => t.slice(0, 40));
  }
  if (patch.checklist !== undefined) {
    set.checklist = patch.checklist
      .slice(0, 50)
      .map((c) => ({ id: String(c.id).slice(0, 40), text: String(c.text).slice(0, 300), done: Boolean(c.done) }))
      .filter((c) => c.text.trim());
  }
  if (patch.recurrence !== undefined) {
    if (!RECURRENCES.includes(patch.recurrence as Recurrence)) return fail("Repetición no válida.");
    if (patch.recurrence !== "none" && !(patch.dueDate ?? task.dueDate)) return fail("Para repetir la tarea, primero ponle fecha de entrega.");
    set.recurrence = patch.recurrence as Recurrence;
  }
  if (patch.projectId !== undefined && patch.projectId !== task.projectId) {
    const [p] = await db.select().from(projects).where(eq(projects.id, patch.projectId));
    if (!p) return fail("Proyecto no válido.");
    set.projectId = p.id;
    set.sort = await nextSort(p.id, (set.status ?? task.status) as TaskStatus);
  }

  await db.update(tasks).set(set).where(eq(tasks.id, id));
  if (set.assigneeId && set.assigneeId !== task.assigneeId) queue(() => notifyAssignment(id, me.id));
  if (set.status === "hecho" && task.status !== "hecho") await spawnNextOccurrence(id, me.id);
  refreshWorkspace(task.projectId);
  if (set.projectId) refreshWorkspace(set.projectId);
  return okr(null);
}

/** Mueve una tarea a una columna y la ubica entre dos tarjetas (orden fraccionario). */
export async function moveTaskAction(id: number, status: string, beforeId: number | null, afterId: number | null): Promise<Result> {
  const me = await staff();
  if (!TASK_STATUSES.includes(status as TaskStatus)) return fail("Estado no válido.");
  const db = await getDb();
  const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
  if (!task) return fail("La tarea no existe.");
  const sortOf = async (tid: number | null) => {
    if (!tid) return null;
    const [r] = await db.select({ sort: tasks.sort }).from(tasks).where(eq(tasks.id, tid));
    return r?.sort ?? null;
  };
  const [before, afterSort] = await Promise.all([sortOf(beforeId), sortOf(afterId)]);
  let sort: number;
  if (before !== null && afterSort !== null) sort = (before + afterSort) / 2;
  else if (before !== null) {
    const [next] = await db
      .select({ sort: tasks.sort })
      .from(tasks)
      .where(and(eq(tasks.projectId, task.projectId), eq(tasks.status, status as TaskStatus), gt(tasks.sort, before)))
      .orderBy(asc(tasks.sort))
      .limit(1);
    sort = next ? (before + next.sort) / 2 : before + 1024;
  } else if (afterSort !== null) {
    const [prev] = await db
      .select({ sort: tasks.sort })
      .from(tasks)
      .where(and(eq(tasks.projectId, task.projectId), eq(tasks.status, status as TaskStatus), lt(tasks.sort, afterSort)))
      .orderBy(desc(tasks.sort))
      .limit(1);
    sort = prev ? (prev.sort + afterSort) / 2 : afterSort - 1024;
  } else sort = await nextSort(task.projectId, status as TaskStatus);

  await db
    .update(tasks)
    .set({
      status: status as TaskStatus,
      sort,
      updatedAt: new Date(),
      completedAt: status === "hecho" ? (task.completedAt ?? new Date()) : null,
    })
    .where(eq(tasks.id, id));
  if (status === "hecho" && task.status !== "hecho") await spawnNextOccurrence(id, me.id);
  refreshWorkspace(task.projectId);
  return okr(null);
}

export async function deleteTaskAction(id: number): Promise<Result> {
  const me = await staff();
  const db = await getDb();
  const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
  if (!task) return okr(null);
  if (me.role !== "admin" && task.createdBy !== me.id) return fail("Solo quien creó la tarea o el líder puede eliminarla.");
  await db.delete(tasks).where(eq(tasks.id, id));
  await audit(me.id, "eliminar", "tarea", id, `Tarea eliminada: ${task.title}`);
  refreshWorkspace(task.projectId);
  return okr(null);
}

export async function getTaskAction(id: number): Promise<Result<TaskDetail>> {
  await staff();
  const detail = await getTaskDetail(id);
  return detail ? okr(detail) : fail("La tarea no existe.");
}

export async function addTaskCommentAction(id: number, body: string): Promise<Result> {
  const me = await staff();
  const text = body.trim();
  if (!text) return fail("Escribe un comentario.");
  const db = await getDb();
  const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
  if (!task) return fail("La tarea no existe.");
  await db.insert(taskComments).values({ taskId: id, authorId: me.id, body: text.slice(0, 10_000) });
  await db.update(tasks).set({ updatedAt: new Date() }).where(eq(tasks.id, id));
  refreshWorkspace(task.projectId);
  return okr(null);
}

/** Crea una tarea del espacio de equipo a partir de una solicitud de la mesa de ayuda. */
export async function createTaskFromTicketAction(ticketId: number, projectId: number): Promise<Result<{ id: number; projectId: number }>> {
  const me = await staff();
  const db = await getDb();
  const [row] = await db
    .select({ ticket: tickets, responsibleId: categories.responsibleId, categoryName: categories.name })
    .from(tickets)
    .innerJoin(categories, eq(categories.slug, tickets.categorySlug))
    .where(eq(tickets.id, ticketId));
  if (!row) return fail("La solicitud no existe.");
  if (!canManageTicket(me, row.ticket, row.responsibleId)) return fail("No tienes permiso sobre esta solicitud.");
  const [existing] = await db.select({ id: tasks.id, projectId: tasks.projectId }).from(tasks).where(eq(tasks.ticketId, ticketId));
  if (existing) return okr(existing);
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!project) return fail("Proyecto no válido.");
  const t = row.ticket;
  const due = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Bogota" }).format(t.dueAt);
  const [task] = await db
    .insert(tasks)
    .values({
      projectId,
      title: t.title,
      description: `Solicitud **${ticketCode(t.id)}** (${row.categoryName}) de la mesa de ayuda.\n\n${t.description}`,
      priority: t.urgency,
      assigneeId: t.assigneeId,
      dueDate: due,
      tags: [row.categoryName],
      ticketId: t.id,
      sort: await nextSort(projectId, "por_hacer"),
      createdBy: me.id,
    })
    .returning();
  if (task.assigneeId) queue(() => notifyAssignment(task.id, me.id));
  refreshWorkspace(projectId);
  revalidatePath(`/solicitudes/${ticketId}`);
  return okr({ id: task.id, projectId });
}

// ── Páginas ────────────────────────────────────────────────

export async function createPageAction(input: { parentId?: number | null; projectId?: number | null; title?: string }): Promise<Result<{ id: number }>> {
  const me = await staff();
  const db = await getDb();
  let projectId = input.projectId ?? null;
  if (input.parentId) {
    const [parent] = await db.select().from(pages).where(eq(pages.id, input.parentId));
    if (!parent) return fail("La página superior no existe.");
    projectId = projectId ?? parent.projectId;
  }
  const [{ value }] = await db.select({ value: max(pages.sort) }).from(pages);
  const [page] = await db
    .insert(pages)
    .values({
      parentId: input.parentId ?? null,
      projectId,
      title: input.title?.trim() || "Sin título",
      sort: (value ?? 0) + 1,
      createdBy: me.id,
      updatedBy: me.id,
    })
    .returning();
  revalidatePath("/equipo", "layout");
  return okr({ id: page.id });
}

export async function updatePageAction(id: number, patch: { title?: string; icon?: string; content?: string }): Promise<Result<{ updatedAt: string }>> {
  const me = await staff();
  const db = await getDb();
  const set: Partial<typeof pages.$inferInsert> = { updatedAt: new Date(), updatedBy: me.id };
  if (patch.title !== undefined) set.title = patch.title.trim().slice(0, 200) || "Sin título";
  if (patch.icon !== undefined) set.icon = patch.icon.slice(0, 8) || "📄";
  if (patch.content !== undefined) {
    if (patch.content.length > 300_000) return fail("La página es demasiado larga.");
    set.content = patch.content;
  }
  const [row] = await db.update(pages).set(set).where(eq(pages.id, id)).returning({ updatedAt: pages.updatedAt });
  if (!row) return fail("La página no existe.");
  if (patch.title !== undefined || patch.icon !== undefined) revalidatePath("/equipo", "layout");
  return okr({ updatedAt: row.updatedAt.toISOString() });
}

export async function deletePageAction(id: number): Promise<Result<{ parentId: number | null }>> {
  const me = await staff();
  const db = await getDb();
  const [page] = await db.select().from(pages).where(eq(pages.id, id));
  if (!page) return okr({ parentId: null });
  if (me.role !== "admin" && page.createdBy !== me.id) return fail("Solo quien creó la página o el líder puede eliminarla.");
  await db.delete(pages).where(eq(pages.id, id));
  await audit(me.id, "eliminar", "pagina", id, `Página eliminada: ${page.icon} ${page.title}`);
  revalidatePath("/equipo", "layout");
  return okr({ parentId: page.parentId });
}

// ── Plantillas de campaña ──────────────────────────────────

/** Responsables por rol de plantilla (según los responsables de cada categoría). */
export async function templateAssigneesAction(): Promise<Record<string, { id: number; name: string } | null>> {
  const me = await staff();
  const db = await getDb();
  const rows = await db
    .select({ slug: categories.slug, id: users.id, name: users.name })
    .from(categories)
    .leftJoin(users, eq(users.id, categories.responsibleId))
    .where(inArray(categories.slug, ["diseno", "redes", "crm", "ia"]));
  const map: Record<string, { id: number; name: string } | null> = { lider: { id: me.id, name: me.name } };
  for (const r of rows) map[r.slug] = r.id && r.name ? { id: r.id, name: r.name } : null;
  return map;
}

export async function applyTemplateAction(input: { projectId: number; templateId: string; keyDate: string; prefix?: string }): Promise<Result<{ created: number }>> {
  const me = await staff();
  const template = getTemplate(input.templateId);
  if (!template) return fail("Plantilla no válida.");
  if (!DATE_RE.test(input.keyDate)) return fail(`Indica la ${template.keyDateLabel.toLowerCase()}.`);
  const db = await getDb();
  const [project] = await db.select().from(projects).where(eq(projects.id, input.projectId));
  if (!project) return fail("El proyecto no existe.");
  const assignees = await templateAssigneesAction();
  const prefix = input.prefix?.trim();
  let sort = await nextSort(project.id, "por_hacer");
  const createdIds: number[] = [];
  for (const t of template.tasks) {
    const [task] = await db
      .insert(tasks)
      .values({
        projectId: project.id,
        title: (prefix ? `${prefix} · ${t.title}` : t.title).slice(0, 200),
        description: t.description ?? `Creada con la plantilla **${template.name}** (${template.keyDateLabel.toLowerCase()}: ${formatShortDate(input.keyDate)}).`,
        priority: t.priority ?? "media",
        assigneeId: assignees[t.role]?.id ?? null,
        dueDate: addDaysISO(input.keyDate, t.offset),
        tags: t.tags ?? [],
        checklist: (t.checklist ?? []).map((text) => ({ id: crypto.randomUUID(), text, done: false })),
        sort: (sort += 1024),
        createdBy: me.id,
      })
      .returning({ id: tasks.id, assigneeId: tasks.assigneeId });
    createdIds.push(task.id);
    if (task.assigneeId && task.assigneeId !== me.id) queue(() => notifyAssignment(task.id, me.id));
  }
  await audit(me.id, "aplicar", "plantilla", template.id, `Plantilla "${template.name}" aplicada en ${project.name}${prefix ? ` (${prefix})` : ""}: ${createdIds.length} tareas`);
  refreshWorkspace(project.id);
  return okr({ created: createdIds.length });
}
