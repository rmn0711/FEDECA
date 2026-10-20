"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, FilePlus2, Plus } from "lucide-react";
import { toast } from "sonner";
import { createPageAction } from "@/lib/actions/workspace";
import type { PageNode } from "@/lib/workspace/queries";
import { cn } from "@/lib/utils";

function ancestorsOf(nodes: PageNode[], id: number | null) {
  const set = new Set<number>();
  let cur = nodes.find((n) => n.id === id);
  while (cur?.parentId) {
    set.add(cur.parentId);
    cur = nodes.find((n) => n.id === cur!.parentId);
  }
  return set;
}

export function PageTree({ nodes, activeId }: { nodes: PageNode[]; activeId: number | null }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<Set<number>>(() => {
    const s = ancestorsOf(nodes, activeId);
    if (activeId) s.add(activeId);
    return s;
  });
  const [pending, startTransition] = useTransition();

  function create(parentId: number | null) {
    startTransition(async () => {
      const r = await createPageAction({ parentId });
      if (!r.ok) return void toast.error(r.error);
      if (parentId) setExpanded((s) => new Set(s).add(parentId));
      router.push(`/equipo/paginas/${r.data.id}?editar=1`);
    });
  }

  function render(parentId: number | null, depth: number): React.ReactNode {
    const children = nodes.filter((n) => n.parentId === parentId);
    if (children.length === 0) return null;
    return (
      <ul className="space-y-0.5">
        {children.map((n) => {
          const hasChildren = nodes.some((c) => c.parentId === n.id);
          const isOpen = expanded.has(n.id);
          return (
            <li key={n.id}>
              <div
                className={cn(
                  "group flex items-center gap-1 rounded-lg pr-1 text-sm transition-colors",
                  n.id === activeId ? "bg-[#d9342c]/10 font-medium text-[#d9342c]" : "hover:bg-accent"
                )}
                style={{ paddingLeft: depth * 14 + 4 }}
              >
                <button
                  type="button"
                  onClick={() =>
                    setExpanded((s) => {
                      const next = new Set(s);
                      if (next.has(n.id)) next.delete(n.id);
                      else next.add(n.id);
                      return next;
                    })
                  }
                  className={cn("flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-background", !hasChildren && "invisible")}
                  aria-label={isOpen ? "Contraer" : "Expandir"}
                >
                  <ChevronRight className={cn("size-3.5 transition-transform", isOpen && "rotate-90")} />
                </button>
                <Link href={`/equipo/paginas/${n.id}`} className="flex min-w-0 flex-1 items-center gap-1.5 py-1">
                  <span className="shrink-0">{n.icon}</span>
                  <span className="truncate">{n.title}</span>
                </Link>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => create(n.id)}
                  className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-background"
                  aria-label={`Nueva subpágina en ${n.title}`}
                  title="Nueva subpágina"
                >
                  <Plus className="size-3.5" />
                </button>
              </div>
              {isOpen && render(n.id, depth + 1)}
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <nav className="space-y-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => create(null)}
        className="flex w-full items-center gap-2 rounded-lg border border-dashed px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <FilePlus2 className="size-4" />
        Nueva página
      </button>
      {nodes.length === 0 ? <p className="px-2 text-xs text-muted-foreground">Aún no hay páginas.</p> : render(null, 0)}
    </nav>
  );
}
