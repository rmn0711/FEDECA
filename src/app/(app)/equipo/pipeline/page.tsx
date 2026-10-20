import Link from "next/link";
import { AlarmClock, Inbox, ListTodo, MessageSquareReply } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { getStaff } from "@/lib/tickets/queries";
import { getMyTasks, getProjects } from "@/lib/workspace/queries";
import { getPipelineTickets } from "@/lib/workspace/pipeline";
import { StatTile } from "@/components/dashboard/stat-tile";
import { UserAvatar } from "@/components/shared/user-avatar";
import { PipelineBoard } from "@/components/workspace/pipeline-board";
import { cn } from "@/lib/utils";

export const metadata = { title: "Pipeline" };

export default async function PipelinePage({ searchParams }: { searchParams: Promise<{ persona?: string }> }) {
  const user = await requireRole("admin", "agent");
  const staff = await getStaff();
  const { persona } = await searchParams;
  // El líder puede ver el pipeline de cada integrante; cada responsable ve el suyo.
  const requested = Number(persona);
  const person = user.role === "admin" && requested ? (staff.find((s) => s.id === requested) ?? null) : null;
  const personId = person?.id ?? user.id;
  const personName = person?.name ?? user.name;
  const isMine = personId === user.id;

  const [pipelineTickets, tasks, projects] = await Promise.all([getPipelineTickets(personId), getMyTasks(personId), getProjects()]);
  const now = new Date();
  const overdue = pipelineTickets.filter((t) => t.dueAt < now).length;
  const noResponse = pipelineTickets.filter((t) => !t.firstResponseAt).length;
  const openTasks = tasks.filter((t) => t.status !== "hecho");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{isMine ? "Mi pipeline" : `Pipeline de ${personName}`}</h1>
          <p className="text-sm text-muted-foreground">Solicitudes del helpdesk por resolver y tareas del equipo, en un solo tablero.</p>
        </div>
      </div>

      {user.role === "admin" && (
        <div className="flex flex-wrap gap-2">
          {staff.map((s) => (
            <Link
              key={s.id}
              href={s.id === user.id ? "/equipo/pipeline" : `/equipo/pipeline?persona=${s.id}`}
              className={cn(
                "flex items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-sm transition-colors",
                s.id === personId ? "border-[#d9342c] bg-[#d9342c]/10 font-medium text-[#d9342c]" : "hover:bg-accent"
              )}
            >
              <UserAvatar fullName={s.name} size="sm" />
              {s.id === user.id ? "Yo" : s.name}
            </Link>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Solicitudes por resolver" value={String(pipelineTickets.length)} hint="Helpdesk abiertas" icon={Inbox} accent="blue" />
        <StatTile label="Solicitudes vencidas" value={String(overdue)} hint="Pasaron el tiempo de solución" icon={AlarmClock} accent="orange" />
        <StatTile label="Sin primera respuesta" value={String(noResponse)} hint="Aún no se ha respondido" icon={MessageSquareReply} accent="violet" />
        <StatTile label="Tareas abiertas" value={String(openTasks.length)} hint="Espacio de equipo" icon={ListTodo} accent="aqua" />
      </div>

      <PipelineBoard
        key={personId}
        tickets={pipelineTickets}
        tasks={tasks}
        members={staff.map((s) => ({ id: s.id, name: s.name }))}
        projects={projects.map((p) => ({ id: p.id, name: p.name, icon: p.icon }))}
        meId={user.id}
        isAdmin={user.role === "admin"}
        isMine={isMine}
      />
    </div>
  );
}
