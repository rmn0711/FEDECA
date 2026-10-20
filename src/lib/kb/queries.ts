import "server-only";
import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { categories, kbArticles, users } from "@/lib/db/schema";

const STOP = new Set(["de", "la", "el", "en", "y", "a", "que", "no", "con", "para", "por", "los", "las", "un", "una", "mi", "me", "se", "del", "al", "es", "lo", "como"]);

export function searchTerms(q: string) {
  return Array.from(
    new Set(
      q
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .split(/[^a-z0-9ñ]+/)
        .filter((w) => w.length > 2 && !STOP.has(w))
    )
  ).slice(0, 8);
}

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

export async function listArticles({ includeDrafts = false, category }: { includeDrafts?: boolean; category?: string } = {}) {
  const db = await getDb();
  return db
    .select({
      id: kbArticles.id,
      title: kbArticles.title,
      summary: kbArticles.summary,
      categorySlug: kbArticles.categorySlug,
      categoryName: categories.name,
      published: kbArticles.published,
      views: kbArticles.views,
      helpful: kbArticles.helpful,
      notHelpful: kbArticles.notHelpful,
      deflections: kbArticles.deflections,
      keywords: kbArticles.keywords,
      body: kbArticles.body,
      updatedAt: kbArticles.updatedAt,
    })
    .from(kbArticles)
    .leftJoin(categories, eq(categories.slug, kbArticles.categorySlug))
    .where(and(includeDrafts ? undefined : eq(kbArticles.published, true), category ? eq(kbArticles.categorySlug, category) : undefined))
    .orderBy(desc(kbArticles.views), desc(kbArticles.updatedAt));
}

/** Búsqueda simple por palabras: pesa más el título, luego palabras clave, resumen y contenido. */
export async function searchArticles(q: string, opts: { category?: string | null; limit?: number; includeDrafts?: boolean } = {}) {
  const terms = searchTerms(q);
  const db = await getDb();
  const all = await db
    .select({
      id: kbArticles.id,
      title: kbArticles.title,
      summary: kbArticles.summary,
      categorySlug: kbArticles.categorySlug,
      keywords: kbArticles.keywords,
      body: kbArticles.body,
      views: kbArticles.views,
      published: kbArticles.published,
    })
    .from(kbArticles)
    .where(
      and(
        opts.includeDrafts ? undefined : eq(kbArticles.published, true),
        opts.category ? or(eq(kbArticles.categorySlug, opts.category), isNull(kbArticles.categorySlug)) : undefined
      )
    );
  if (terms.length === 0) return [];
  return all
    .map((a) => {
      const t = norm(a.title);
      const k = norm(a.keywords ?? "");
      const s = norm(a.summary ?? "");
      const b = norm(a.body);
      let score = 0;
      for (const term of terms) {
        if (t.includes(term)) score += 5;
        if (k.includes(term)) score += 4;
        if (s.includes(term)) score += 2;
        if (b.includes(term)) score += 1;
      }
      if (opts.category && a.categorySlug === opts.category) score += 1;
      return { id: a.id, title: a.title, summary: a.summary, categorySlug: a.categorySlug, score };
    })
    .filter((a) => a.score >= 4)
    .sort((x, y) => y.score - x.score)
    .slice(0, opts.limit ?? 5);
}

export async function getArticle(id: number) {
  const db = await getDb();
  const [row] = await db
    .select({ article: kbArticles, categoryName: categories.name, updatedByName: users.name })
    .from(kbArticles)
    .leftJoin(categories, eq(categories.slug, kbArticles.categorySlug))
    .leftJoin(users, eq(users.id, kbArticles.updatedBy))
    .where(eq(kbArticles.id, id));
  return row ?? null;
}

export async function countView(id: number) {
  const db = await getDb();
  await db.update(kbArticles).set({ views: sql`${kbArticles.views} + 1` }).where(eq(kbArticles.id, id));
}
