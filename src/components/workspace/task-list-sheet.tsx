"use client";

import { useState } from "react";
import type { TaskCard } from "@/lib/workspace/queries";
import { TaskSheet } from "./task-sheet";
import { TaskCalendar } from "./task-calendar";
import { useRouter } from "next/navigation";

type Member = { id: number; name: string };
type ProjectOption = { id: number; name: string; icon: string };

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
