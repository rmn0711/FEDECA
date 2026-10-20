import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getArticle } from "@/lib/kb/queries";
import { ArticleForm } from "@/components/kb/article-form";

export const metadata = { title: "Editar artículo" };

export default async function EditArticlePage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("admin", "agent");
  const row = await getArticle(Number((await params).id));
  if (!row) notFound();
  const a = row.article;
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Editar artículo</h1>
      <ArticleForm article={{ id: a.id, title: a.title, summary: a.summary, keywords: a.keywords, body: a.body, categorySlug: a.categorySlug, published: a.published }} />
    </div>
  );
}
