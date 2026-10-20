"use client";

import { CalendarDays, CheckSquare, FileText, Link2, MessageSquare } from "lucide-react";
import type { TaskCard as TaskCardData } from "@/lib/workspace/queries";
import { dueState, formatShortDate } from "@/lib/workspace/constants";
import { URGENCY_META } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/shared/user-avatar";

const DUE_TONE = {
  vencida: "bg-[#d9342c]/10 text-[#d9342c]",
  hoy: "bg-[#eb6834]/10 text-[#b84f22]",
  pronto: "bg-[#2a78d6]/10 text-[#1c5cab]",
  normal: "bg-muted text-muted-foreground",
} as const;

export function DueChip({ date, done }: { date: string | null; done: boolean }) {
  if (!date) return null;
  const state = dueState(date, done);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium",
        state ? DUE_TONE[state] : "bg-muted text-muted-foreground line-through"
      )}
      title={state === "vencida" ? "Vencida" : state === "hoy" ? "Vence hoy" : "Fecha de entrega"}
    >
      <CalendarDays className="size-3" />
      {state === "hoy" ? "Hoy" : formatShortDate(date)}
    </span>
  );
}

export function TaskCardView({
  task,
  onOpen,
  showProject,
  dragging,
  ...rest
}: {
  task: TaskCardData;
  onOpen: () => void;
  showProject?: boolean;
  dragging?: boolean;
} & React.HTMLAttributes<HTMLDivElement>) {
  const done = task.checklist.filter((c) => c.done).length;
  const isDone = task.status === "hecho";
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onOpen())}
      className={cn(
        "group cursor-pointer space-y-2 rounded-xl bg-card p-3 text-left shadow-xs ring-1 ring-foreground/10 transition-all select-none hover:shadow-md hover:ring-foreground/20",
        dragging && "opacity-40",
        isDone && "opacity-75"
      )}
      {...rest}
    >
      {showProject && task.projectName && (
        <p className="truncate text-[11px] font-medium text-muted-foreground">
          {task.projectIcon} {task.projectName}
        </p>
      )}
      <div className="flex items-start gap-2">
        <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", URGENCY_META[task.priority].dot)} title={`Prioridad ${URGENCY_META[task.priority].label}`} />
        <p className={cn("min-w-0 flex-1 text-sm leading-snug font-medium", isDone && "text-muted-foreground line-through")}>{task.title}</p>
      </div>
      {task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {task.tags.slice(0, 3).map((t) => (
            <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
              {t}
            </span>
          ))}
          {task.tags.length > 3 && <span className="text-[11px] text-muted-foreground">+{task.tags.length - 3}</span>}
        </div>
      )}
      <div className="flex items-center gap-2 text-muted-foreground">
        <DueChip date={task.dueDate} done={isDone} />
        {task.checklist.length > 0 && (
          <span className={cn("inline-flex items-center gap-1 text-[11px]", done === task.checklist.length && "text-[#1a7f4e]")}>
            <CheckSquare className="size-3" />
            {done}/{task.checklist.length}
          </span>
        )}
        {task.comments > 0 && (
          <span className="inline-flex items-center gap-1 text-[11px]">
            <MessageSquare className="size-3" />
            {task.comments}
          </span>
        )}
        {task.hasDescription && <FileText className="size-3" aria-label="Tiene descripción" />}
        {task.ticketId && <Link2 className="size-3" aria-label="Vinculada a solicitud" />}
        <span className="ml-auto">
          {task.assigneeName ? (
            <UserAvatar fullName={task.assigneeName} size="sm" />
          ) : (
            <span className="text-[11px]">Sin asignar</span>
          )}
        </span>
      </div>
    </div>
  );
}
