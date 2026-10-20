"use client";

import { useState } from "react";
import type { TaskCard } from "@/lib/workspace/queries";
import { TASK_STATUSES, TASK_STATUS_META, type TaskStatus } from "@/lib/workspace/constants";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";
import { CheckCircle2 } from "lucide-react";
import { TaskCardView } from "./task-card";
import { TaskSheet } from "./task-sheet";
import { TaskCalendar } from "./task-calendar";
import { useRouter } from "next/navigation";

type Member = { id: number; name: string };
type ProjectOption = { id: number; name: string; icon: string };

/** "Mis tareas": agrupadas por estado, de todos los proyectos. */
export function MyTasks({
  tasks,
  members,
  projects,
  meId,
  isAdmin,
}: {
  tasks: TaskCard[];
  members: Member[];
  projects: ProjectOption[];
  meId: number;
  isAdmin: boolean;
}) {
  const [openId, setOpenId] = useState<number | null>(null);
  const [showDone, setShowDone] = useState(false);
  const groups = TASK_STATUSES.filter((s) => showDone || s !== "hecho").map((s) => ({
    status: s as TaskStatus,
    items: tasks.filter((t) => t.status === s),
  }));
  const openCount = tasks.filter((t) => t.status !== "hecho").length;

  return (
    <div className="space-y-6">
      {openCount === 0 && !showDone && (
        <div className="rounded-2xl border border-dashed">
          <EmptyState icon={CheckCircle2} title="No tienes tareas pendientes" description="Cuando te asignen una tarea aparecerá aquí y te llegará un correo." />
        </div>
      )}
      {groups.map(
        (g) =>
          g.items.length > 0 && (
            <section key={g.status} className="space-y-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <span className={cn("size-2 rounded-full", TASK_STATUS_META[g.status].dot)} />
                {TASK_STATUS_META[g.status].label}
                <span className="font-normal text-muted-foreground">{g.items.length}</span>
              </h2>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {g.items.map((t) => (
                  <TaskCardView key={t.id} task={t} showProject onOpen={() => setOpenId(t.id)} />
                ))}
              </div>
            </section>
          )
      )}
      <button type="button" onClick={() => setShowDone(!showDone)} className="text-sm text-muted-foreground hover:text-foreground">
        {showDone ? "Ocultar tareas hechas" : `Ver tareas hechas (${tasks.length - openCount})`}
      </button>
      <TaskSheet
        taskId={openId}
        onClose={() => setOpenId(null)}
        members={members}
        projects={projects}
        canDelete={(createdBy) => isAdmin || createdBy === meId}
      />
    </div>
  );
}

/** Calendario de contenidos de todos los proyectos; el mes vive en la URL (?mes=AAAA-MM). */
export function TeamCalendar({
  month,
  tasks,
  members,
  projects,
  meId,
  isAdmin,
}: {
  month: string;
  tasks: TaskCard[];
  members: Member[];
  projects: ProjectOption[];
  meId: number;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [openId, setOpenId] = useState<number | null>(null);
  return (
    <>
      <TaskCalendar month={month} onMonthChange={(m) => router.push(`/equipo/calendario?mes=${m}`)} tasks={tasks} onOpen={setOpenId} showProject />
      <TaskSheet
        taskId={openId}
        onClose={() => setOpenId(null)}
        members={members}
        projects={projects}
        canDelete={(createdBy) => isAdmin || createdBy === meId}
      />
    </>
  );
}
