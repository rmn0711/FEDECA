"use server";

import { and, eq, max } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { reviewComments, reviews, tasks, users } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth";
import { MAX_FILE_BYTES } from "@/lib/constants";
import { audit } from "@/lib/audit";
import { adminIds, notifyUsers } from "@/lib/notify";
import { canDecide, getReviewDetail, getTaskReviews, type ReviewSummary } from "@/lib/reviews/queries";
import { updateTaskAction } from "./workspace";

type Result<T = null> = { ok: true; data: T } | { ok: false; error: string };
const fail = (error: string) => ({ ok: false as const, error });

const staff = () => requireRole("admin", "agent");
const ALLOWED = /^(image\/(png|jpe?g|gif|webp)|application\/pdf|video\/mp4)$/;

export async function listTaskReviewsAction(taskId: number): Promise<Result<ReviewSummary[]>> {
  await staff();
  return { ok: true, data: await getTaskReviews(taskId) };
}

export async function submitReviewAction(formData: FormData): Promise<Result<{ id: number }>> {
  const me = await staff();
  const taskId = Number(formData.get("taskId"));
  const file = formData.get("file");
  const note = String(formData.get("note") ?? "").trim().slice(0, 2000) || null;
  if (!(file instanceof File) || file.size === 0) return fail("Adjunta la pieza (imagen, PDF o video MP4).");
  if (!ALLOWED.test(file.type)) return fail("Formato no soportado: usa PNG, JPG, WEBP, GIF, PDF o MP4.");
  if (file.size > MAX_FILE_BYTES * 2) return fail("La pieza supera 20 MB.");
  const db = await getDb();
  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
  if (!task) return fail("La tarea no existe.");
  const [{ value }] = await db.select({ value: max(reviews.version) }).from(reviews).where(eq(reviews.taskId, taskId));
  const version = (value ?? 0) + 1;
  const [r] = await db
    .insert(reviews)
    .values({
      taskId,
      version,
      note,
      filename: file.name.slice(0, 200),
      mime: file.type,
      size: file.size,
      data: Buffer.from(await file.arrayBuffer()),
      submittedBy: me.id,
    })
    .returning({ id: reviews.id });
  if (task.status !== "en_revision") await updateTaskAction(taskId, { status: "en_revision" });
  const approvers = (task.createdBy && task.createdBy !== me.id ? [task.createdBy] : []).concat(await adminIds()).filter((id) => id !== me.id);
  notifyUsers({
    userIds: approvers,
    title: `Pieza para aprobar (v${version})`,
    body: `${me.name}: ${task.title}`,
    url: `/equipo/revisiones/${r.id}`,
    whatsapp: { pref: "tareas", kind: "pieza", lines: [`🎨 *${me.name} subió una pieza para tu aprobación* (versión ${version})`, `*${task.title}*`, note ? `«${note}»` : ""].filter(Boolean) },
    email: {
      kind: "review",
      subject: `Para aprobar: ${task.title} (versión ${version})`,
      preheader: `${me.name} subió la versión ${version} para tu aprobación`,
      eyebrow: "Aprobación de piezas",
      heading: `${me.name.split(" ")[0]} te comparte una pieza para aprobar 🎨`,
      intro: `Es la versión ${version} de "${task.title}". Échale un ojo: puedes comentar directo sobre la imagen y aprobarla o pedir ajustes.`,
      code: `Versión ${version}`,
      title: task.title,
      pills: [{ label: "Pendiente de aprobación", color: "#b84f22", bg: "#fdebe2" }],
      details: [["Archivo", file.name]],
      message: note ? { author: me.name, body: note, label: "Nota" } : null,
      ctaLabel: "Revisar la pieza",
    },
  });
  await audit(me.id, "enviar", "aprobacion", r.id, `Versión ${version} enviada a aprobación: ${task.title}`);
  revalidatePath("/equipo", "layout");
  return { ok: true, data: { id: r.id } };
}

export async function addReviewCommentAction(reviewId: number, body: string, x: number | null, y: number | null): Promise<Result> {
  const me = await staff();
  const text = body.trim();
  if (!text) return fail("Escribe el comentario.");
  const pos = (v: number | null) => (v === null || !Number.isFinite(v) ? null : Math.min(100, Math.max(0, v)));
  const db = await getDb();
  const detail = await getReviewDetail(reviewId);
  if (!detail) return fail("La revisión no existe.");
  await db.insert(reviewComments).values({ reviewId, authorId: me.id, body: text.slice(0, 2000), x: pos(x), y: pos(y) });
  // Avisa a quien subió la pieza (si comenta otra persona).
  if (detail.submittedBy && detail.submittedBy !== me.id) {
    notifyUsers({ userIds: [detail.submittedBy], title: `Comentario en v${detail.version}`, body: `${me.name}: ${text.slice(0, 120)}`, url: `/equipo/revisiones/${reviewId}` });
  }
  revalidatePath(`/equipo/revisiones/${reviewId}`);
  return { ok: true, data: null };
}

export async function toggleReviewCommentAction(commentId: number): Promise<Result> {
  await staff();
  const db = await getDb();
  const [c] = await db.select().from(reviewComments).where(eq(reviewComments.id, commentId));
  if (!c) return fail("El comentario no existe.");
  await db.update(reviewComments).set({ resolved: !c.resolved }).where(eq(reviewComments.id, commentId));
  revalidatePath(`/equipo/revisiones/${c.reviewId}`);
  return { ok: true, data: null };
}

export async function decideReviewAction(reviewId: number, decision: "aprobada" | "cambios", comment: string): Promise<Result> {
  const me = await staff();
  const detail = await getReviewDetail(reviewId);
  if (!detail) return fail("La revisión no existe.");
  if (!canDecide(me, detail)) return fail("Solo el líder o quien pidió la tarea puede aprobar o pedir cambios.");
  if (detail.status !== "pendiente") return fail("Esta versión ya tiene una decisión.");
  if (decision === "cambios" && !comment.trim()) return fail("Indica qué cambios se necesitan.");
  const latest = detail.versions.at(-1);
  if (latest && latest.id !== reviewId) return fail("Hay una versión más reciente; decide sobre la última.");
  const db = await getDb();
  await db
    .update(reviews)
    .set({ status: decision, decidedBy: me.id, decidedAt: new Date(), decisionComment: comment.trim() || null })
    .where(and(eq(reviews.id, reviewId), eq(reviews.status, "pendiente")));
  // Aprobada → tarea hecha; cambios → vuelve a "en curso".
  await updateTaskAction(detail.taskId, { status: decision === "aprobada" ? "hecho" : "en_curso" });
  const [assignee] = detail.taskAssigneeId ? await db.select({ id: users.id }).from(users).where(eq(users.id, detail.taskAssigneeId)) : [];
  const recipients = [detail.submittedBy, assignee?.id].filter((v): v is number => Boolean(v) && v !== me.id);
  const approved = decision === "aprobada";
  notifyUsers({
    userIds: recipients,
    title: approved ? `✅ Aprobada: v${detail.version}` : `✏️ Cambios en v${detail.version}`,
    body: `${detail.taskTitle}${comment.trim() ? ` · ${comment.trim().slice(0, 100)}` : ""}`,
    url: `/equipo/revisiones/${reviewId}`,
    whatsapp: {
      pref: "tareas",
      kind: "pieza",
      lines: [approved ? `✅ *Pieza aprobada* (versión ${detail.version})` : `✏️ *Cambios en la pieza* (versión ${detail.version})`, `*${detail.taskTitle}*`, comment.trim() ? `«${comment.trim()}»` : ""].filter(Boolean),
    },
    email: {
      kind: "review",
      subject: `${approved ? "Aprobada" : "Requiere cambios"}: ${detail.taskTitle} (versión ${detail.version})`,
      preheader: approved ? "Tu pieza fue aprobada" : "Tu pieza necesita cambios",
      eyebrow: "Aprobación de piezas",
      heading: approved ? "¡Aprobada! Buen trabajo 🙌" : "Casi lista: hay algunos ajustes",
      intro: approved
        ? `${me.name.split(" ")[0]} aprobó la versión ${detail.version} de "${detail.taskTitle}" y la tarea quedó como hecha.`
        : `${me.name.split(" ")[0]} revisó la versión ${detail.version} de "${detail.taskTitle}" y dejó comentarios sobre la imagen. Ajústala y sube la nueva versión cuando esté.`,
      code: `Versión ${detail.version}`,
      title: detail.taskTitle,
      pills: [approved ? { label: "Aprobada", color: "#0f8a5f", bg: "#dff5ec" } : { label: "Requiere cambios", color: "#b3261e", bg: "#fbe5e3" }],
      details: [["Comentarios sobre la pieza", String(detail.comments.filter((c) => !c.resolved).length)]],
      message: comment.trim() ? { author: me.name, body: comment.trim() } : null,
      ctaLabel: "Ver la revisión",
    },
  });
  await audit(me.id, approved ? "aprobar" : "pedir_cambios", "aprobacion", reviewId, `${approved ? "Aprobada" : "Cambios pedidos en"} versión ${detail.version}: ${detail.taskTitle}`);
  revalidatePath(`/equipo/revisiones/${reviewId}`);
  return { ok: true, data: null };
}
