import { getPageTree } from "@/lib/workspace/queries";
import { requireRole } from "@/lib/auth";
import { PageTreeClient } from "@/components/workspace/page-tree-client";

export default async function PagesLayout({ children }: { children: React.ReactNode }) {
  await requireRole("admin", "agent");
  const nodes = await getPageTree();
  return (
    <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
        <div className="rounded-2xl bg-card p-3 shadow-xs ring-1 ring-foreground/10">
          <p className="mb-2 px-1 text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">Páginas del equipo</p>
          <PageTreeClient nodes={nodes} />
        </div>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
