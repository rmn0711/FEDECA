import "server-only";
import { and, asc, desc, eq, gte, inArray, isNotNull, lte, ne, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb } from "@/lib/db";
import { pages, projects, taskComments, tasks, users } from "@/lib/db/schema";
import { todayISO } from "./constants";

const assignee = alias(users, "assignee");

const taskColumns = {
  id: tasks.id,
  projectId: tasks.projectId,
  title: tasks.title,
  status: tasks.status,
  priority: tasks.priority,
  assigneeId: tasks.assigneeId,
  assigneeName: assignee.name,
  startDate: tasks.startDate,
  dueDate: tasks.dueDate,
  tags: tasks.tags,
  checklist: tasks.checklist,
  sort: tasks.sort,
  ticketId: tasks.ticketId,
  updatedAt: tasks.updatedAt,
  hasDescription: sql<boolean>`length(${tasks.description}) > 0`,
  comments: sql<number>`(select count(*)::int from hd_task_comments c where c.task_id = ${tasks.id})`,
};

export type TaskCard = {
  id: number;
  projectId: number;
  title: string;
  status: "por_hacer" | "en_curso" | "en_revision" | "hecho";
  priority: "alta" | "media" | "baja";
  assigneeId: number | null;
  assigneeName: string | null;
  startDate: string | null;
  dueDate: string | null;
  tags: string[];
  checklist: { id: string; text: string; done: boolean }[];
  sort: number;
  ticketId: number | null;
  updatedAt: Date;
  hasDescription: boolean;
  comments: number;
  projectName?: string;
  projectIcon?: string;
  projectColor?: string;
};

export async function getProjects({ includeArchived = false } = {}) {
  const db = await getDb();
  const today = todayISO();
  return db
    .select({
      id: projects.id,
      name: projects.name,
      description: projects.description,
      icon: projects.icon,
      color: projects.color,
      archived: projects.archived,
      sort: projects.sort,
      total: sql<number>`(select count(*)::int from hd_tasks t where t.project_id = ${projects.id})`,
      done: sql<number>`(select count(*)::int from hd_tasks t where t.project_id = ${projects.id} and t.status = 'hecho')`,
      overdue: sql<number>`(select count(*)::int from hd_tasks t where t.project_id = ${projects.id} and t.status <> 'hecho' and t.due_date < ${today})`,
    })
    .from(projects)
    .where(includeArchived ? undefined : eq(projects.archived, false))
    .orderBy(asc(projects.sort), asc(projects.id));
}

export type ProjectSummary = Awaited<ReturnType<typeof getProjects>>[number];

export async function getProject(id: number) {
  const db = await getDb();
  const [p] = await db.select().from(projects).where(eq(projects.id, id));
  return p ?? null;
}

export async function getProjectTasks(projectId: number): Promise<TaskCard[]> {
  const db = await getDb();
  return db
    .select(taskColumns)
    .from(tasks)
    .leftJoin(assignee, eq(assignee.id, tasks.assigneeId))
    .where(eq(tasks.projectId, projectId))
    .orderBy(asc(tasks.sort), asc(tasks.id));
}

const withProject = {
  ...taskColumns,
  projectName: projects.name,
  projectIcon: projects.icon,
  projectColor: projects.color,
};

export async function getMyTasks(userId: number): Promise<TaskCard[]> {
  const db = await getDb();
  return db
    .select(withProject)
    .from(tasks)
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .leftJoin(assignee, eq(assignee.id, tasks.assigneeId))
    .where(and(eq(tasks.assigneeId, userId), eq(projects.archived, false)))
    .orderBy(sql`case when ${tasks.status} = 'hecho' then 1 else 0 end`, sql`${tasks.dueDate} asc nulls last`, desc(tasks.updatedAt));
}

/** Tareas con fecha de entrega entre dos fechas (AAAA-MM-DD), para el calendario. */
export async function getTasksBetween(from: string, to: string, projectId?: number): Promise<TaskCard[]> {
  const db = await getDb();
  return db
    .select(withProject)
    .from(tasks)
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .leftJoin(assignee, eq(assignee.id, tasks.assigneeId))
    .where(
      and(
        isNotNull(tasks.dueDate),
        gte(tasks.dueDate, from),
        lte(tasks.dueDate, to),
        eq(projects.archived, false),
        projectId ? eq(tasks.projectId, projectId) : undefined
      )
    )
    .orderBy(asc(tasks.dueDate), asc(tasks.sort));
}

export async function getUpcomingTasks(days = 7): Promise<TaskCard[]> {
  const today = todayISO();
  const end = new Date(`${today}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + days);
  const db = await getDb();
  return db
    .select(withProject)
    .from(tasks)
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .leftJoin(assignee, eq(assignee.id, tasks.assigneeId))
    .where(
      and(
        ne(tasks.status, "hecho"),
        isNotNull(tasks.dueDate),
        lte(tasks.dueDate, end.toISOString().slice(0, 10)),
        eq(projects.archived, false)
      )
    )
    .orderBy(asc(tasks.dueDate))
    .limit(12);
}

/** Tareas abiertas por persona del equipo. */
export async function getWorkload() {
  const db = await getDb();
  const today = todayISO();
  return db
    .select({
      id: users.id,
      name: users.name,
      open: sql<number>`count(${tasks.id}) filter (where ${tasks.status} <> 'hecho')::int`,
      overdue: sql<number>`count(${tasks.id}) filter (where ${tasks.status} <> 'hecho' and ${tasks.dueDate} < ${today})::int`,
      review: sql<number>`count(${tasks.id}) filter (where ${tasks.status} = 'en_revision')::int`,
    })
    .from(users)
    .leftJoin(tasks, eq(tasks.assigneeId, users.id))
    .where(and(eq(users.active, true), inArray(users.role, ["admin", "agent"])))
    .groupBy(users.id, users.name)
    .orderBy(asc(users.name));
}

export async function getTaskDetail(id: number) {
  const db = await getDb();
  const [row] = await db
    .select({
      task: tasks,
      projectName: projects.name,
      projectIcon: projects.icon,
      assigneeName: assignee.name,
    })
    .from(tasks)
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .leftJoin(assignee, eq(assignee.id, tasks.assigneeId))
    .where(eq(tasks.id, id));
  if (!row) return null;
  const author = alias(users, "author");
  const creator = alias(users, "creator");
  const [comments, [createdByRow]] = await Promise.all([
    db
      .select({
        id: taskComments.id,
        body: taskComments.body,
        createdAt: taskComments.createdAt,
        authorId: taskComments.authorId,
        authorName: author.name,
      })
      .from(taskComments)
      .leftJoin(author, eq(author.id, taskComments.authorId))
      .where(eq(taskComments.taskId, id))
      .orderBy(asc(taskComments.createdAt)),
    db
      .select({ name: creator.name })
      .from(tasks)
      .leftJoin(creator, eq(creator.id, tasks.createdBy))
      .where(eq(tasks.id, id)),
  ]);
  return { ...row, comments, createdByName: createdByRow?.name ?? null };
}

export type TaskDetail = NonNullable<Awaited<ReturnType<typeof getTaskDetail>>>;

export async function getPageTree() {
  const db = await getDb();
  return db
    .select({ id: pages.id, parentId: pages.parentId, title: pages.title, icon: pages.icon, sort: pages.sort, projectId: pages.projectId })
    .from(pages)
    .orderBy(asc(pages.sort), asc(pages.id));
}

export type PageNode = Awaited<ReturnType<typeof getPageTree>>[number];

export async function getPage(id: number) {
  const db = await getDb();
  const editor = alias(users, "editor");
  const [row] = await db
    .select({ page: pages, updatedByName: editor.name, projectName: projects.name, projectIcon: projects.icon })
    .from(pages)
    .leftJoin(editor, eq(editor.id, pages.updatedBy))
    .leftJoin(projects, eq(projects.id, pages.projectId))
    .where(eq(pages.id, id));
  return row ?? null;
}

export async function getRecentPages(limit = 6) {
  const db = await getDb();
  const editor = alias(users, "editor");
  return db
    .select({ id: pages.id, title: pages.title, icon: pages.icon, updatedAt: pages.updatedAt, updatedByName: editor.name })
    .from(pages)
    .leftJoin(editor, eq(editor.id, pages.updatedBy))
    .orderBy(desc(pages.updatedAt))
    .limit(limit);
}

export async function getProjectPages(projectId: number) {
  const db = await getDb();
  return db
    .select({ id: pages.id, title: pages.title, icon: pages.icon, updatedAt: pages.updatedAt })
    .from(pages)
    .where(eq(pages.projectId, projectId))
    .orderBy(asc(pages.sort), asc(pages.id));
}

export async function getTaskForTicket(ticketId: number) {
  const db = await getDb();
  const [row] = await db.select({ id: tasks.id, projectId: tasks.projectId }).from(tasks).where(eq(tasks.ticketId, ticketId)).limit(1);
  return row ?? null;
}
