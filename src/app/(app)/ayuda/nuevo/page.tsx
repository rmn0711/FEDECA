import { requireRole } from "@/lib/auth";
import { ArticleForm } from "@/components/kb/article-form";

export const metadata = { title: "Nuevo artículo" };

export default async function NewArticlePage() {
  await requireRole("admin", "agent");
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Nuevo artículo</h1>
      <ArticleForm />
    </div>
  );
}
