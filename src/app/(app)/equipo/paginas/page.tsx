import Link from "next/link";
import { FileText } from "lucide-react";
import { getPageTree } from "@/lib/workspace/queries";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata = { title: "Páginas del equipo" };

export default async function PagesIndex() {
  const nodes = await getPageTree();
  const roots = nodes.filter((n) => n.parentId === null);
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Páginas del equipo</h1>
        <p className="text-sm text-muted-foreground">
          Planes, guías, actas y documentos, con subpáginas, tablas y listas de tareas, como en Notion.
        </p>
      </div>
      {roots.length === 0 ? (
        <div className="rounded-2xl border border-dashed">
          <EmptyState icon={FileText} title="Aún no hay páginas" description="Crea la primera con «Nueva página»." />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {roots.map((p) => {
            const children = nodes.filter((n) => n.parentId === p.id);
            return (
              <Link key={p.id} href={`/equipo/paginas/${p.id}`} className="space-y-2 rounded-2xl bg-card p-4 shadow-xs ring-1 ring-foreground/10 transition-all hover:shadow-md">
                <p className="flex items-center gap-2 font-semibold">
                  <span className="text-2xl">{p.icon}</span>
                  {p.title}
                </p>
                {children.length > 0 && (
                  <p className="truncate text-xs text-muted-foreground">
                    {children.map((c) => `${c.icon} ${c.title}`).join(" · ")}
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
