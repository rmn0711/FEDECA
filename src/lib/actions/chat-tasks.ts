"use server";

import { and, desc, eq, ilike, ne, or, sql } from "drizzle-orm";
import { requireRole } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { projects, tasks } from "@/lib/db/schema";
import type { TaskMention } from "@/lib/chat/task-mentions";

/** Uses the same staff-only visibility as the team workspace. */
export async function searchChatTasksAction(query: string): Promise<{ ok: true; tasks: TaskMention[] } | { ok: false; error: string }> {
  await requireRole("admin", "agent");
  const term = String(query).trim().slice(0, 80);
  const pattern = `%${term.replace(/[\\%_]/g, "\\$&")}%`;
  try {
    const db = await getDb();
    const rows = await db.select({ id: tasks.id, projectId: tasks.projectId, title: tasks.title, projectName: projects.name, status: tasks.status })
      .from(tasks).innerJoin(projects, eq(projects.id, tasks.projectId))
      .where(and(ne(tasks.status, "hecho"), eq(projects.archived, false), term ? or(ilike(tasks.title, pattern), ilike(projects.name, pattern), sql`${tasks.id}::text = ${term}`) : undefined))
      .orderBy(desc(tasks.updatedAt), desc(tasks.id)).limit(10);
    return { ok: true, tasks: rows };
  } catch {
    return { ok: false, error: "No se pudieron buscar las tareas. Vuelve a escribir # para intentarlo." };
  }
}
