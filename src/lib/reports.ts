import "server-only";
import { and, desc, eq, gte, isNotNull, lt, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb } from "@/lib/db";
import { categories, kbArticles, tasks, tickets, users } from "@/lib/db/schema";
import { CATEGORIES } from "@/lib/categories";
import { STATUS_META, URGENCY_META, ticketCode } from "@/lib/constants";

/** Campo que resume el "tema" de cada categoría (para los temas más frecuentes). */
const THEME_FIELD: Record<string, string> = {
  diseno: "tipo_pieza",
  ia: "tipo_solicitud",
  cotizador: "tipo_solicitud",
  crm: "tipo",
  redes: "tipo_publicacion",
  sistemas: "tipo",
  sinco: "modulo",
};

export function monthBounds(month: string) {
  const [y, m] = month.split("-").map(Number);
  const start = new Date(`${month}-01T00:00:00-05:00`);
  const next = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);
  const end = new Date(`${next}-01T00:00:00-05:00`);
  return { start, end };
}

export function shiftMonthStr(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
}

export function monthLabel(month: string) {
  return new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));
}

type Agg = {
  received: number;
  resolved: number;
  respondedOnTime: number;
  responded: number;
  resolvedOnTime: number;
  resolutionMs: number;
  ratingSum: number;
  rated: number;
  openNow: number;
};
const emptyAgg = (): Agg => ({ received: 0, resolved: 0, respondedOnTime: 0, responded: 0, resolvedOnTime: 0, resolutionMs: 0, ratingSum: 0, rated: 0, openNow: 0 });

export function summarize(a: Agg) {
  return {
    received: a.received,
    resolved: a.resolved,
    openNow: a.openNow,
    responseCompliance: a.responded ? Math.round((a.respondedOnTime / a.responded) * 100) : null,
    resolutionCompliance: a.resolved ? Math.round((a.resolvedOnTime / a.resolved) * 100) : null,
    avgResolutionHours: a.resolved ? a.resolutionMs / a.resolved / 3_600_000 : null,
    satisfaction: a.rated ? a.ratingSum / a.rated : null,
    rated: a.rated,
  };
}

export async function getMonthlyReport(month: string) {
  const db = await getDb();
  const { start, end } = monthBounds(month);
  const assignee = alias(users, "assignee");
  const requester = alias(users, "requester");

  const rows = await db
    .select({
      id: tickets.id,
      title: tickets.title,
      categorySlug: tickets.categorySlug,
      categoryName: categories.name,
      urgency: tickets.urgency,
      status: tickets.status,
      fields: tickets.fields,
      assigneeId: tickets.assigneeId,
      assigneeName: assignee.name,
      requesterName: requester.name,
      requesterDepartment: requester.department,
      createdAt: tickets.createdAt,
      responseDueAt: tickets.responseDueAt,
      firstResponseAt: tickets.firstResponseAt,
      dueAt: tickets.dueAt,
      resolvedAt: tickets.resolvedAt,
      rating: tickets.rating,
    })
    .from(tickets)
    .innerJoin(categories, eq(categories.slug, tickets.categorySlug))
    .innerJoin(requester, eq(requester.id, tickets.requesterId))
    .leftJoin(assignee, eq(assignee.id, tickets.assigneeId))
    .where(or(and(gte(tickets.createdAt, start), lt(tickets.createdAt, end)), and(gte(tickets.resolvedAt, start), lt(tickets.resolvedAt, end))))
    .orderBy(desc(tickets.createdAt));

  const inMonth = (d: Date | null) => Boolean(d && d >= start && d < end);
  const total = emptyAgg();
  const byPerson = new Map<string, { name: string; agg: Agg; tasksDone: number }>();
  const byCategory = new Map<string, Agg>(CATEGORIES.map((c) => [c.slug, emptyAgg()]));
  const themes = new Map<string, Map<string, number>>();
  const departments = new Map<string, number>();

  for (const t of rows) {
    const key = t.assigneeId ? String(t.assigneeId) : "none";
    if (!byPerson.has(key)) byPerson.set(key, { name: t.assigneeName ?? "Sin asignar", agg: emptyAgg(), tasksDone: 0 });
    const targets = [total, byPerson.get(key)!.agg, byCategory.get(t.categorySlug) ?? emptyAgg()];
    if (inMonth(t.createdAt)) {
      for (const a of targets) {
        a.received++;
        if (t.firstResponseAt) {
          a.responded++;
          if (t.firstResponseAt <= t.responseDueAt) a.respondedOnTime++;
        }
        if (!t.resolvedAt) a.openNow++;
      }
      const field = THEME_FIELD[t.categorySlug];
      const value = field ? t.fields[field] : undefined;
      if (value) {
        const map = themes.get(t.categorySlug) ?? new Map<string, number>();
        const v = Array.isArray(value) ? value.join(", ") : value;
        map.set(v, (map.get(v) ?? 0) + 1);
        themes.set(t.categorySlug, map);
      }
      const dep = t.requesterDepartment?.trim() || "Sin área";
      departments.set(dep, (departments.get(dep) ?? 0) + 1);
    }
    if (inMonth(t.resolvedAt)) {
      for (const a of targets) {
        a.resolved++;
        if (t.resolvedAt! <= t.dueAt) a.resolvedOnTime++;
        a.resolutionMs += t.resolvedAt!.getTime() - t.createdAt.getTime();
        if (t.rating) {
          a.ratingSum += t.rating;
          a.rated++;
        }
      }
    }
  }

  // Tareas del espacio de equipo completadas en el mes, por persona.
  const done = await db
    .select({ assigneeId: tasks.assigneeId, name: users.name })
    .from(tasks)
    .leftJoin(users, eq(users.id, tasks.assigneeId))
    .where(and(eq(tasks.status, "hecho"), isNotNull(tasks.completedAt), gte(tasks.completedAt, start), lt(tasks.completedAt, end)));
  for (const d of done) {
    const key = d.assigneeId ? String(d.assigneeId) : "none";
    if (!byPerson.has(key)) byPerson.set(key, { name: d.name ?? "Sin asignar", agg: emptyAgg(), tasksDone: 0 });
    byPerson.get(key)!.tasksDone++;
  }

  // Tendencia de los últimos 6 meses (recibidas vs. resueltas).
  const trendStart = monthBounds(shiftMonthStr(month, -5)).start;
  const history = await db
    .select({ createdAt: tickets.createdAt, resolvedAt: tickets.resolvedAt })
    .from(tickets)
    .where(or(and(gte(tickets.createdAt, trendStart), lt(tickets.createdAt, end)), and(gte(tickets.resolvedAt, trendStart), lt(tickets.resolvedAt, end))));
  const monthOf = (d: Date) => new Date(d.getTime() - 5 * 3_600_000).toISOString().slice(0, 7);
  const trend = Array.from({ length: 6 }, (_, i) => {
    const m = shiftMonthStr(month, i - 5);
    return {
      month: m,
      label: new Intl.DateTimeFormat("es-CO", { month: "short", timeZone: "UTC" }).format(new Date(`${m}-01T00:00:00Z`)),
      recibidas: history.filter((h) => monthOf(h.createdAt) === m).length,
      resueltas: history.filter((h) => h.resolvedAt && monthOf(h.resolvedAt) === m).length,
    };
  });

  const kb = await db
    .select({ id: kbArticles.id, title: kbArticles.title, views: kbArticles.views, deflections: kbArticles.deflections, helpful: kbArticles.helpful })
    .from(kbArticles)
    .orderBy(desc(kbArticles.deflections), desc(kbArticles.views))
    .limit(5);

  return {
    month,
    label: monthLabel(month),
    total: summarize(total),
    people: Array.from(byPerson.entries())
      .map(([id, p]) => ({ id, name: p.name, tasksDone: p.tasksDone, ...summarize(p.agg) }))
      .sort((a, b) => b.received + b.resolved - (a.received + a.resolved)),
    categories: CATEGORIES.map((c) => ({ slug: c.slug, name: c.name, ...summarize(byCategory.get(c.slug) ?? emptyAgg()) })),
    themes: CATEGORIES.map((c) => ({
      slug: c.slug,
      name: c.name,
      items: Array.from(themes.get(c.slug)?.entries() ?? [])
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
    })).filter((t) => t.items.length > 0),
    departments: Array.from(departments.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
    trend,
    kb,
    tickets: rows
      .filter((t) => inMonth(t.createdAt))
      .map((t) => ({
        code: ticketCode(t.id),
        id: t.id,
        title: t.title,
        category: t.categoryName,
        theme: (() => {
          const v = t.fields[THEME_FIELD[t.categorySlug] ?? ""];
          return Array.isArray(v) ? v.join(", ") : (v ?? "");
        })(),
        urgency: URGENCY_META[t.urgency].label,
        status: STATUS_META[t.status].label,
        requester: t.requesterName,
        department: t.requesterDepartment ?? "",
        assignee: t.assigneeName ?? "Sin asignar",
        createdAt: t.createdAt,
        firstResponseAt: t.firstResponseAt,
        responseOnTime: t.firstResponseAt ? t.firstResponseAt <= t.responseDueAt : null,
        resolvedAt: t.resolvedAt,
        resolutionOnTime: t.resolvedAt ? t.resolvedAt <= t.dueAt : null,
        rating: t.rating,
      })),
  };
}

export type MonthlyReport = Awaited<ReturnType<typeof getMonthlyReport>>;
