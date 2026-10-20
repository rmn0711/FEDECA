import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getProject, getProjectPages, getProjectTasks, getProjects } from "@/lib/workspace/queries";
import { getStaff } from "@/lib/tickets/queries";
import { Button } from "@/components/ui/button";
import { ProjectBoard } from "@/components/workspace/project-board";
import { ProjectDialog } from "@/components/workspace/project-dialog";
import { ArchiveProjectButton } from "@/components/workspace/archive-project-button";
import { TemplateDialog } from "@/components/workspace/template-dialog";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const project = await getProject(Number((await params).id));
  return { title: project?.name ?? "Proyecto" };
}

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ vista?: string; tarea?: string }>;
}) {
  const user = await requireUser();
  const id = Number((await params).id);
  const sp = await searchParams;
  const project = await getProject(id);
  if (!project) notFound();
  const [tasks, staff, projects, projectPages] = await Promise.all([getProjectTasks(id), getStaff(), getProjects(), getProjectPages(id)]);
  const view = sp.vista === "lista" || sp.vista === "calendario" ? sp.vista : "tablero";

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <Button variant="ghost" size="sm" className="-ml-2" render={<Link href="/equipo"><ArrowLeft className="size-4" />Espacio de equipo</Link>} />
        <div className="flex flex-wrap items-start gap-4">
          <span className="flex size-14 items-center justify-center rounded-2xl text-3xl" style={{ background: `${project.color}1a` }}>
            {project.icon}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              {project.name}
              {project.archived && <span className="ml-2 text-sm font-normal text-muted-foreground">(archivado)</span>}
            </h1>
            {project.description && <p className="text-sm text-muted-foreground">{project.description}</p>}
            {projectPages.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {projectPages.map((p) => (
                  <Link key={p.id} href={`/equipo/paginas/${p.id}`} className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs hover:bg-accent">
                    <FileText className="size-3" />
                    {p.icon} {p.title}
                  </Link>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <TemplateDialog projectId={project.id} />
            {user.role === "admin" && (
              <>
              <ProjectDialog project={{ id: project.id, name: project.name, description: project.description, icon: project.icon, color: project.color }} />
              <ArchiveProjectButton id={project.id} archived={project.archived} />
              </>
            )}
          </div>
        </div>
      </div>
      <ProjectBoard
        key={project.id}
        projectId={project.id}
        tasks={tasks}
        members={staff.map((s) => ({ id: s.id, name: s.name }))}
        projects={projects.map((p) => ({ id: p.id, name: p.name, icon: p.icon }))}
        meId={user.id}
        isAdmin={user.role === "admin"}
        initialView={view}
        initialTaskId={Number(sp.tarea) || null}
      />
    </div>
  );
}
