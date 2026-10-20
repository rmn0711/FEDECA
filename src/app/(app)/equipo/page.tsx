import Link from "next/link";
import { AlarmClock, ArrowRight, CalendarDays, CheckCircle2, FileText, ListTodo } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getMyTasks, getProjects, getRecentPages, getUpcomingTasks, getWorkload } from "@/lib/workspace/queries";
import { relativeTime } from "@/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { StatTile } from "@/components/dashboard/stat-tile";
import { UserAvatar } from "@/components/shared/user-avatar";
import { DueChip } from "@/components/workspace/task-card";
import { ProjectDialog } from "@/components/workspace/project-dialog";

export const metadata = { title: "Espacio de equipo" };

export default async function TeamHome() {
  const user = await requireUser();
  const [projects, mine, upcoming, pages, workload] = await Promise.all([
    getProjects(),
    getMyTasks(user.id),
    getUpcomingTasks(7),
    getRecentPages(6),
    getWorkload(),
  ]);
  const myOpen = mine.filter((t) => t.status !== "hecho");
  const overdueTeam = workload.reduce((a, w) => a + w.overdue, 0);
  const reviewTeam = workload.reduce((a, w) => a + w.review, 0);
  const isAdmin = user.role === "admin";

  return (
    <div className="space-y-6">
      <Card className="relative overflow-hidden border-none bg-gradient-to-br from-[#242426] via-[#1b1b1d] to-[#141415] text-white shadow-lg">
        <div className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-[#d9342c] opacity-25 blur-3xl" />
        <CardContent className="relative flex flex-col gap-4 p-6 sm:flex-row sm:items-end sm:justify-between sm:p-7">
          <div>
            <p className="text-sm font-medium tracking-wide text-white/50">Marketing digital y generación de demanda</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
              Espacio de <span className="text-[#ff5a4f]">equipo</span>
            </h1>
            <p className="mt-2 max-w-xl text-sm text-white/70">
              Proyectos, tareas, calendario de contenidos y documentos del equipo en un solo lugar.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"
              render={<Link href="/equipo/paginas"><FileText className="size-4" />Páginas</Link>}
            />
            {isAdmin && <ProjectDialog />}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Mis tareas abiertas" value={String(myOpen.length)} hint="Asignadas a ti" icon={ListTodo} accent="blue" />
        <StatTile label="Vencidas del equipo" value={String(overdueTeam)} hint="Pasaron su fecha de entrega" icon={AlarmClock} accent="orange" />
        <StatTile label="En revisión" value={String(reviewTeam)} hint="Esperan aprobación" icon={CheckCircle2} accent="violet" />
        <StatTile label="Entregas en 7 días" value={String(upcoming.length)} hint="Todo el equipo" icon={CalendarDays} accent="aqua" />
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Proyectos</h2>
        {projects.length === 0 ? (
          <div className="rounded-2xl border border-dashed">
            <EmptyState icon={ListTodo} title="Aún no hay proyectos" description={isAdmin ? "Crea el primero con «Nuevo proyecto»." : "El líder del equipo debe crear un proyecto."} />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {projects.map((p) => {
              const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
              return (
                <Link
                  key={p.id}
                  href={`/equipo/proyectos/${p.id}`}
                  className="group space-y-3 rounded-2xl bg-card p-4 shadow-xs ring-1 ring-foreground/10 transition-all hover:-translate-y-0.5 hover:shadow-md"
                  style={{ borderTop: `4px solid ${p.color}` }}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-3xl leading-none">{p.icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{p.name}</p>
                      {p.description && <p className="line-clamp-2 text-sm text-muted-foreground">{p.description}</p>}
                    </div>
                    <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>
                        {p.done} de {p.total} tareas
                      </span>
                      <span>{pct}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: p.color }} />
                    </div>
                  </div>
                  {p.overdue > 0 && <Badge variant="destructive">{p.overdue} vencida(s)</Badge>}
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Próximas entregas</CardTitle>
              <CardDescription>Vencidas y de los próximos 7 días, de todo el equipo.</CardDescription>
            </div>
            <Button variant="outline" size="sm" render={<Link href="/equipo/calendario">Calendario<ArrowRight className="size-3.5" /></Link>} />
          </CardHeader>
          <CardContent className="space-y-1.5">
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay entregas próximas.</p>
            ) : (
              upcoming.map((t) => (
                <Link
                  key={t.id}
                  href={`/equipo/proyectos/${t.projectId}?tarea=${t.id}`}
                  className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-accent"
                >
                  <span>{t.projectIcon}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{t.title}</span>
                  <DueChip date={t.dueDate} done={false} />
                  {t.assigneeName ? <UserAvatar fullName={t.assigneeName} size="sm" /> : <span className="text-xs text-muted-foreground">Sin asignar</span>}
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Carga del equipo</CardTitle>
            <CardDescription>Tareas abiertas por persona.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {workload.map((w) => {
              const max = Math.max(1, ...workload.map((x) => x.open));
              return (
                <div key={w.id} className="space-y-1">
                  <div className="flex items-center gap-2 text-sm">
                    <UserAvatar fullName={w.name} size="sm" />
                    <span className="min-w-0 flex-1 truncate">{w.name}</span>
                    {w.overdue > 0 && <Badge variant="destructive">{w.overdue} vencida(s)</Badge>}
                    <span className="font-semibold tabular-nums">{w.open}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-[#d9342c]" style={{ width: `${(w.open / max) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Páginas recientes</CardTitle>
            <CardDescription>Planes, guías y documentos del equipo.</CardDescription>
          </div>
          <Button variant="outline" size="sm" render={<Link href="/equipo/paginas">Ver todas<ArrowRight className="size-3.5" /></Link>} />
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {pages.map((p) => (
            <Link key={p.id} href={`/equipo/paginas/${p.id}`} className="flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors hover:bg-accent">
              <span className="text-xl">{p.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{p.title}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  Editada {relativeTime(p.updatedAt)}
                  {p.updatedByName ? ` · ${p.updatedByName}` : ""}
                </span>
              </span>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
