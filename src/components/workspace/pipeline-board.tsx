"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Inbox, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { quickTicketStatusAction } from "@/lib/actions/tickets";
import { updateTaskAction } from "@/lib/actions/workspace";
import type { PipelineTicket } from "@/lib/workspace/pipeline";
import type { TaskCard } from "@/lib/workspace/queries";
import { TASK_STATUSES, TASK_STATUS_META, type TaskStatus } from "@/lib/workspace/constants";
import { OPEN_STATUSES, STATUS_META, ticketCode, type Status } from "@/lib/constants";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CategoryIcon, PriorityBadge, SlaBadge } from "@/components/tickets/badges";
import { TaskCardView } from "./task-card";
import { TaskSheet } from "./task-sheet";

type Member = { id: number; name: string };
type ProjectOption = { id: number; name: string; icon: string };

const STATUS_DOT: Record<string, string> = { abierto: "bg-[#2a78d6]", en_progreso: "bg-[#eb6834]", en_espera: "bg-[#6b6b6e]" };

function Column({
  title,
  dot,
  count,
  active,
  onDragOver,
  onDragLeave,
  onDrop,
  children,
  hint,
}: {
  title: string;
  dot: string;
  count: number;
  active: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn("flex min-h-[220px] flex-col gap-2 rounded-2xl bg-muted/50 p-2 transition-colors", active && "bg-[#d9342c]/[0.06] ring-2 ring-[#d9342c]/30")}
    >
      <div className="flex items-center gap-2 px-1.5 pt-1 text-sm font-semibold">
        <span className={cn("size-2 rounded-full", dot)} />
        {title}
        <span className="text-xs font-normal text-muted-foreground">{count}</span>
      </div>
      {hint && count === 0 && <p className="px-1.5 text-xs text-muted-foreground">{hint}</p>}
      {children}
    </div>
  );
}

export function PipelineBoard({
  tickets: serverTickets,
  tasks: serverTasks,
  members,
  projects,
  meId,
  isAdmin,
  isMine,
}: {
  tickets: PipelineTicket[];
  tasks: TaskCard[];
  members: Member[];
  projects: ProjectOption[];
  meId: number;
  isAdmin: boolean;
  isMine: boolean;
}) {
  const router = useRouter();
  const [tickets, setTickets] = useState(serverTickets);
  const [tasks, setTasks] = useState(serverTasks);
  // Al refrescar desde el servidor se reemplaza el estado local.
  useEffect(() => {
    setTickets(serverTickets);
  }, [serverTickets]);
  useEffect(() => {
    setTasks(serverTasks);
  }, [serverTasks]);
  const [drag, setDrag] = useState<{ kind: "ticket" | "task"; id: number } | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [openTask, setOpenTask] = useState<number | null>(null);
  const [, startTransition] = useTransition();

  function dropTicket(status: Status) {
    if (drag?.kind !== "ticket") return;
    const id = drag.id;
    const t = tickets.find((x) => x.id === id);
    setDrag(null);
    setOver(null);
    if (!t || t.status === status) return;
    setTickets((list) => list.map((x) => (x.id === id ? { ...x, status } : x)));
    startTransition(async () => {
      const r = await quickTicketStatusAction(id, status);
      if (r.error) toast.error(r.error);
      else toast.success(`${ticketCode(id)} → ${STATUS_META[status].label}. Se notificó al solicitante.`);
      router.refresh();
    });
  }

  function dropTask(status: TaskStatus) {
    if (drag?.kind !== "task") return;
    const id = drag.id;
    const t = tasks.find((x) => x.id === id);
    setDrag(null);
    setOver(null);
    if (!t || t.status === status) return;
    setTasks((list) => list.map((x) => (x.id === id ? { ...x, status } : x)));
    startTransition(async () => {
      const r = await updateTaskAction(id, { status });
      if (!r.ok) toast.error(r.error);
      router.refresh();
    });
  }

  const allow = (kind: "ticket" | "task", key: string) => (e: React.DragEvent) => {
    if (drag?.kind !== kind) return;
    e.preventDefault();
    if (over !== key) setOver(key);
  };

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Inbox className="size-5 text-[#d9342c]" />
              Solicitudes del helpdesk por resolver
            </h2>
            <p className="text-sm text-muted-foreground">
              Asignadas {isMine ? "a ti" : ""} o sin asignar de sus categorías. Arrastra para cambiar el estado; para resolver, abre la solicitud.
            </p>
          </div>
        </div>
        <div className="-mx-1 overflow-x-auto px-1 pb-2">
          <div className="grid min-w-[760px] grid-cols-3 gap-3">
            {OPEN_STATUSES.map((status) => {
              const list = tickets.filter((t) => t.status === status);
              return (
                <Column
                  key={status}
                  title={STATUS_META[status].label}
                  dot={STATUS_DOT[status]}
                  count={list.length}
                  active={over === `t-${status}`}
                  onDragOver={allow("ticket", `t-${status}`)}
                  onDragLeave={() => setOver(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    dropTicket(status);
                  }}
                  hint={status === "abierto" ? "Sin solicitudes nuevas. 🎉" : undefined}
                >
                  {list.map((t) => (
                    <div
                      key={t.id}
                      draggable
                      onDragStart={() => setDrag({ kind: "ticket", id: t.id })}
                      onDragEnd={() => {
                        setDrag(null);
                        setOver(null);
                      }}
                      className={cn(
                        "space-y-2 rounded-xl bg-card p-3 shadow-xs ring-1 ring-foreground/10 transition-all hover:shadow-md",
                        drag?.kind === "ticket" && drag.id === t.id && "opacity-40",
                        t.dueAt < new Date() && "ring-[#d9342c]/40"
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <CategoryIcon slug={t.categorySlug} className="size-7" />
                        <div className="min-w-0 flex-1">
                          <Link href={`/solicitudes/${t.id}`} className="text-sm leading-snug font-medium hover:underline">
                            {t.title}
                          </Link>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {ticketCode(t.id)} · {t.categoryName} · {t.requesterName}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <PriorityBadge urgency={t.urgency} />
                        {!t.firstResponseAt ? (
                          <SlaBadge createdAt={t.createdAt} dueAt={t.responseDueAt} doneAt={null} prefix="Respuesta" />
                        ) : (
                          <SlaBadge createdAt={t.createdAt} dueAt={t.dueAt} doneAt={null} prefix="Solución" />
                        )}
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>Vence {relativeTime(t.dueAt)}</span>
                        <span className="flex items-center gap-2">
                          {t.comments > 0 && (
                            <span className="flex items-center gap-1">
                              <MessageSquare className="size-3" />
                              {t.comments}
                            </span>
                          )}
                          {!t.assigneeId && <span className="font-medium text-[#b84f22]">Sin asignar</span>}
                          <Link href={`/solicitudes/${t.id}`} className="flex items-center gap-0.5 font-medium text-[#d9342c] hover:underline">
                            Abrir <ExternalLink className="size-3" />
                          </Link>
                        </span>
                      </div>
                    </div>
                  ))}
                </Column>
              );
            })}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Tareas del espacio de equipo</h2>
          <p className="text-sm text-muted-foreground">De todos los proyectos. Arrastra entre columnas o haz clic para ver el detalle.</p>
        </div>
        <div className="-mx-1 overflow-x-auto px-1 pb-2">
          <div className="grid min-w-[1000px] grid-cols-4 gap-3">
            {TASK_STATUSES.map((status) => {
              const list = tasks.filter((t) => t.status === status);
              return (
                <Column
                  key={status}
                  title={TASK_STATUS_META[status].label}
                  dot={TASK_STATUS_META[status].dot}
                  count={list.length}
                  active={over === `k-${status}`}
                  onDragOver={allow("task", `k-${status}`)}
                  onDragLeave={() => setOver(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    dropTask(status);
                  }}
                >
                  {list.map((t) => (
                    <TaskCardView
                      key={t.id}
                      task={t}
                      showProject
                      draggable
                      dragging={drag?.kind === "task" && drag.id === t.id}
                      onDragStart={() => setDrag({ kind: "task", id: t.id })}
                      onDragEnd={() => {
                        setDrag(null);
                        setOver(null);
                      }}
                      onOpen={() => setOpenTask(t.id)}
                    />
                  ))}
                </Column>
              );
            })}
          </div>
        </div>
      </section>

      <TaskSheet
        taskId={openTask}
        onClose={() => setOpenTask(null)}
        members={members}
        projects={projects}
        canDelete={(createdBy) => isAdmin || createdBy === meId}
      />
    </div>
  );
}
