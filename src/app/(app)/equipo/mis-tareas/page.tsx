import { requireUser } from "@/lib/auth";
import { getMyTasks, getProjects } from "@/lib/workspace/queries";
import { getStaff } from "@/lib/tickets/queries";
import { MyTasks } from "@/components/workspace/task-list-sheet";

export const metadata = { title: "Mis tareas" };

export default async function MyTasksPage() {
  const user = await requireUser();
  const [tasks, staff, projects] = await Promise.all([getMyTasks(user.id), getStaff(), getProjects()]);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Mis tareas</h1>
        <p className="text-sm text-muted-foreground">Todo lo que tienes asignado en los proyectos del equipo, ordenado por fecha de entrega.</p>
      </div>
      <MyTasks
        tasks={tasks}
        members={staff.map((s) => ({ id: s.id, name: s.name }))}
        projects={projects.map((p) => ({ id: p.id, name: p.name, icon: p.icon }))}
        meId={user.id}
        isAdmin={user.role === "admin"}
      />
    </div>
  );
}
