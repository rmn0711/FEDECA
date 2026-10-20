import "server-only";
import { asc, desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb } from "@/lib/db";
import { projects, reviewComments, reviews, tasks, users } from "@/lib/db/schema";

const submitter = alias(users, "submitter");
const decider = alias(users, "decider");

const reviewColumns = {
  id: reviews.id,
  taskId: reviews.taskId,
  version: reviews.version,
  note: reviews.note,
  status: reviews.status,
  filename: reviews.filename,
  mime: reviews.mime,
  size: reviews.size,
  submittedBy: reviews.submittedBy,
  submittedByName: submitter.name,
  submittedAt: reviews.submittedAt,
  decidedByName: decider.name,
  decidedAt: reviews.decidedAt,
  decisionComment: reviews.decisionComment,
};

export async function getTaskReviews(taskId: number) {
  const db = await getDb();
  return db
    .select(reviewColumns)
    .from(reviews)
    .leftJoin(submitter, eq(submitter.id, reviews.submittedBy))
    .leftJoin(decider, eq(decider.id, reviews.decidedBy))
    .where(eq(reviews.taskId, taskId))
    .orderBy(desc(reviews.version));
}

export type ReviewSummary = Awaited<ReturnType<typeof getTaskReviews>>[number];

export async function getReviewDetail(id: number) {
  const db = await getDb();
  const [row] = await db
    .select({ ...reviewColumns, taskTitle: tasks.title, taskCreatedBy: tasks.createdBy, taskAssigneeId: tasks.assigneeId, projectId: tasks.projectId, projectName: projects.name, projectIcon: projects.icon })
    .from(reviews)
    .innerJoin(tasks, eq(tasks.id, reviews.taskId))
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .leftJoin(submitter, eq(submitter.id, reviews.submittedBy))
    .leftJoin(decider, eq(decider.id, reviews.decidedBy))
    .where(eq(reviews.id, id));
  if (!row) return null;
  const author = alias(users, "author");
  const [comments, versions] = await Promise.all([
    db
      .select({
        id: reviewComments.id,
        body: reviewComments.body,
        x: reviewComments.x,
        y: reviewComments.y,
        resolved: reviewComments.resolved,
        createdAt: reviewComments.createdAt,
        authorId: reviewComments.authorId,
        authorName: author.name,
      })
      .from(reviewComments)
      .leftJoin(author, eq(author.id, reviewComments.authorId))
      .where(eq(reviewComments.reviewId, id))
      .orderBy(asc(reviewComments.createdAt)),
    db
      .select({ id: reviews.id, version: reviews.version, status: reviews.status })
      .from(reviews)
      .where(eq(reviews.taskId, row.taskId))
      .orderBy(asc(reviews.version)),
  ]);
  return { ...row, comments, versions };
}

export type ReviewDetail = NonNullable<Awaited<ReturnType<typeof getReviewDetail>>>;

export async function getReviewFile(id: number) {
  const db = await getDb();
  const [row] = await db.select({ filename: reviews.filename, mime: reviews.mime, size: reviews.size, data: reviews.data }).from(reviews).where(eq(reviews.id, id));
  return row ?? null;
}

/** ¿Quién aprueba? El líder (admin) o quien creó la tarea, siempre que no sea quien subió la pieza. */
export function canDecide(user: { id: number; role: string }, r: { submittedBy: number | null; taskCreatedBy: number | null }) {
  if (user.role === "admin") return true;
  return r.taskCreatedBy === user.id && r.submittedBy !== user.id;
}
