import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { isStaff, requireUser } from "@/lib/auth";
import { countView, getArticle } from "@/lib/kb/queries";
import { relativeTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Markdown } from "@/components/workspace/markdown";
import { ArticleFeedback } from "@/components/kb/article-feedback";
import { CategoryIcon } from "@/components/tickets/badges";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const row = await getArticle(Number((await params).id));
  return { title: row?.article.title ?? "Artículo" };
}

export default async function ArticlePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ desde?: string }> }) {
  const user = await requireUser();
  const staff = isStaff(user);
  const id = Number((await params).id);
  const { desde } = await searchParams;
  const row = await getArticle(id);
  if (!row || (!row.article.published && !staff)) notFound();
  await countView(id);
  const a = row.article;

  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" className="-ml-2" render={<Link href="/ayuda"><ArrowLeft className="size-4" />Base de conocimiento</Link>} />
        {staff && <Button variant="outline" size="sm" render={<Link href={`/ayuda/${id}/editar`}><Pencil className="size-3.5" />Editar</Link>} />}
      </div>
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {a.categorySlug && <CategoryIcon slug={a.categorySlug} className="size-7" />}
          {row.categoryName ?? "General"}
          {!a.published && <Badge variant="neutral">Borrador</Badge>}
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-balance">{a.title}</h1>
        {a.summary && <p className="text-muted-foreground">{a.summary}</p>}
        <p className="text-xs text-muted-foreground">
          Actualizado {relativeTime(a.updatedAt)}
          {row.updatedByName ? ` por ${row.updatedByName}` : ""} · {a.views + 1} lecturas
        </p>
      </header>
      <div className="rounded-2xl bg-card p-6 shadow-xs ring-1 ring-foreground/10">
        <Markdown source={a.body} />
      </div>
      <ArticleFeedback id={id} fromTicket={desde === "solicitud"} category={a.categorySlug} />
      {staff && (
        <p className="text-xs text-muted-foreground">
          Útil: {a.helpful} · No útil: {a.notHelpful} · Solicitudes evitadas: {a.deflections}
        </p>
      )}
    </article>
  );
}
