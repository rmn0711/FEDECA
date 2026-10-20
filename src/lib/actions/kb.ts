"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { kbArticles } from "@/lib/db/schema";
import { requireRole, requireUser } from "@/lib/auth";
import { getCategory } from "@/lib/categories";
import { audit } from "@/lib/audit";
import { searchArticles } from "@/lib/kb/queries";
import type { FormState } from "./auth";

export async function saveArticleAction(_: FormState, formData: FormData): Promise<FormState> {
  const me = await requireRole("admin", "agent");
  const id = Number(formData.get("id")) || null;
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "");
  const cat = String(formData.get("category") ?? "");
  const categorySlug = cat && getCategory(cat) ? cat : null;
  if (title.length < 5) return { error: "El título debe tener al menos 5 caracteres." };
  if (body.trim().length < 20) return { error: "Escribe el contenido del artículo." };
  const values = {
    title: title.slice(0, 200),
    body: body.slice(0, 100_000),
    summary: String(formData.get("summary") ?? "").trim().slice(0, 300) || null,
    keywords: String(formData.get("keywords") ?? "").trim().slice(0, 300) || null,
    categorySlug,
    published: formData.get("published") === "on",
    updatedBy: me.id,
    updatedAt: new Date(),
  };
  const db = await getDb();
  let articleId = id;
  if (id) {
    await db.update(kbArticles).set(values).where(eq(kbArticles.id, id));
    await audit(me.id, "actualizar", "articulo", id, `Artículo actualizado: ${values.title}${values.published ? "" : " (borrador)"}`);
  } else {
    const [a] = await db.insert(kbArticles).values({ ...values, createdBy: me.id }).returning();
    articleId = a.id;
    await audit(me.id, "crear", "articulo", a.id, `Artículo creado: ${values.title}${values.published ? "" : " (borrador)"}`);
  }
  revalidatePath("/ayuda", "layout");
  redirect(`/ayuda/${articleId}`);
}

export async function deleteArticleAction(id: number) {
  const me = await requireRole("admin", "agent");
  const db = await getDb();
  const [a] = await db.delete(kbArticles).where(eq(kbArticles.id, id)).returning();
  if (a) await audit(me.id, "eliminar", "articulo", id, `Artículo eliminado: ${a.title}`);
  revalidatePath("/ayuda", "layout");
  redirect("/ayuda");
}

export async function articleFeedbackAction(id: number, kind: "helpful" | "not_helpful" | "deflection") {
  await requireUser();
  const db = await getDb();
  const col = kind === "helpful" ? kbArticles.helpful : kind === "not_helpful" ? kbArticles.notHelpful : kbArticles.deflections;
  const key = kind === "helpful" ? "helpful" : kind === "not_helpful" ? "notHelpful" : "deflections";
  await db.update(kbArticles).set({ [key]: sql`${col} + 1` }).where(eq(kbArticles.id, id));
  return { ok: true };
}

/** Sugerencias mientras el usuario escribe su solicitud. */
export async function suggestArticlesAction(category: string, text: string) {
  await requireUser();
  if (text.trim().length < 6) return [];
  return searchArticles(text, { category, limit: 3 });
}
