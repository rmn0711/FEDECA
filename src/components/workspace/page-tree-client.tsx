"use client";

import { useParams } from "next/navigation";
import type { PageNode } from "@/lib/workspace/queries";
import { PageTree } from "./page-tree";

/** El árbol vive en el layout; la página activa se toma de la URL. */
export function PageTreeClient({ nodes }: { nodes: PageNode[] }) {
  const params = useParams<{ id?: string }>();
  const activeId = params.id ? Number(params.id) : null;
  return <PageTree key={activeId ?? "none"} nodes={nodes} activeId={activeId} />;
}
