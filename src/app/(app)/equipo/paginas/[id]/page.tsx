import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getPage, getPageTree } from "@/lib/workspace/queries";
import { PageEditor } from "@/components/workspace/page-editor";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const row = await getPage(Number((await params).id));
  return { title: row?.page.title ?? "Página" };
}

export default async function TeamPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ editar?: string }>;
}) {
  const user = await requireUser();
  const id = Number((await params).id);
  const { editar } = await searchParams;
  const [row, nodes] = await Promise.all([getPage(id), getPageTree()]);
  if (!row) notFound();
  const { page } = row;

  const breadcrumb: Array<{ id: number; title: string; icon: string }> = [];
  let parent = nodes.find((n) => n.id === page.parentId);
  while (parent) {
    breadcrumb.unshift({ id: parent.id, title: parent.title, icon: parent.icon });
    const pid = parent.parentId;
    parent = nodes.find((n) => n.id === pid);
  }

  return (
    <PageEditor
      key={page.id}
      page={{
        id: page.id,
        title: page.title,
        icon: page.icon,
        content: page.content,
        updatedAt: page.updatedAt.toISOString(),
        parentId: page.parentId,
      }}
      updatedByName={row.updatedByName}
      project={page.projectId && row.projectName ? { id: page.projectId, name: row.projectName, icon: row.projectIcon ?? "📁" } : null}
      subpages={nodes.filter((n) => n.parentId === page.id).map((n) => ({ id: n.id, title: n.title, icon: n.icon }))}
      breadcrumb={breadcrumb}
      canDelete={user.role === "admin" || page.createdBy === user.id}
      startEditing={editar === "1"}
    />
  );
}
