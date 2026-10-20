import { requireUser } from "@/lib/auth";
import { getProjects, getTasksBetween } from "@/lib/workspace/queries";
import { getStaff } from "@/lib/tickets/queries";
import { monthRange, todayISO } from "@/lib/workspace/constants";
import { TeamCalendar } from "@/components/workspace/task-list-sheet";

export const metadata = { title: "Calendario del equipo" };

export default async function TeamCalendarPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const user = await requireUser();
  const { mes } = await searchParams;
  const month = mes && /^\d{4}-\d{2}$/.test(mes) ? mes : todayISO().slice(0, 7);
  const { from, to } = monthRange(month);
  const [tasks, staff, projects] = await Promise.all([getTasksBetween(from, to), getStaff(), getProjects()]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Calendario del equipo</h1>
          <p className="text-sm text-muted-foreground">Calendario de contenidos y entregas de todos los proyectos, por fecha de entrega.</p>
        </div>
        <div className="flex flex-wrap gap-3 text-xs">
          {projects.map((p) => (
            <span key={p.id} className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm" style={{ background: p.color }} />
              {p.icon} {p.name}
            </span>
          ))}
        </div>
      </div>
      <TeamCalendar
        month={month}
        tasks={tasks}
        members={staff.map((s) => ({ id: s.id, name: s.name }))}
        projects={projects.map((p) => ({ id: p.id, name: p.name, icon: p.icon }))}
        meId={user.id}
        isAdmin={user.role === "admin"}
      />
    </div>
  );
}
