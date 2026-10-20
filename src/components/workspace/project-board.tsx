"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, KanbanSquare, List, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { createTaskAction, moveTaskAction, updateTaskAction } from "@/lib/actions/workspace";
import type { TaskCard } from "@/lib/workspace/queries";
import { TASK_STATUSES, TASK_STATUS_META, todayISO, type TaskStatus } from "@/lib/workspace/constants";
import { URGENCY_META } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { UserAvatar } from "@/components/shared/user-avatar";
import { TaskCardView, DueChip } from "./task-card";
import { TaskCalendar } from "./task-calendar";
import { TaskSheet } from "./task-sheet";

type Member = { id: number; name: string };
type ProjectOption = { id: number; name: string; icon: string };
type View = "tablero" | "lista" | "calendario";

const ALL = "__all__";

function setUrlParam(key: string, value: string | null) {
  const url = new URL(window.location.href);
  if (value === null) url.searchParams.delete(key);
  else url.searchParams.set(key, value);
  window.history.replaceState(null, "", url.toString());
}

export function ProjectBoard({
  projectId,
  tasks: serverTasks,
  members,
  projects,
  meId,
  isAdmin,
  initialView,
  initialTaskId,
}: {
  projectId: number;
  tasks: TaskCard[];
  members: Member[];
  projects: ProjectOption[];
  meId: number;
  isAdmin: boolean;
  initialView: View;
  initialTaskId: number | null;
}) {
  const router = useRouter();
  const [tasks, setTasks] = useState(serverTasks);
  // Al refrescar desde el servidor se reemplaza el estado local (fuente de verdad).
  useEffect(() => {
    setTasks(serverTasks);
  }, [serverTasks]);

  const [view, setView] = useState<View>(initialView);
  const [openId, setOpenId] = useState<number | null>(initialTaskId);
  const [q, setQ] = useState("");
  const [who, setWho] = useState<string>(ALL);
  const [tag, setTag] = useState<string>(ALL);
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const [dragId, setDragId] = useState<number | null>(null);
  const [drop, setDrop] = useState<{ status: TaskStatus; index: number } | null>(null);
  const [adding, setAdding] = useState<TaskStatus | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [, startTransition] = useTransition();
  const columnRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const allTags = useMemo(() => Array.from(new Set(tasks.flatMap((t) => t.tags))).sort(), [tasks]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return tasks.filter((t) => {
      if (s && !t.title.toLowerCase().includes(s)) return false;
      if (who === "me" && t.assigneeId !== meId) return false;
      if (who === "none" && t.assigneeId !== null) return false;
      if (who !== ALL && who !== "me" && who !== "none" && t.assigneeId !== Number(who)) return false;
      if (tag !== ALL && !t.tags.includes(tag)) return false;
      return true;
    });
  }, [tasks, q, who, tag, meId]);

  const columns = useMemo(() => {
    const map = Object.fromEntries(TASK_STATUSES.map((s) => [s, [] as TaskCard[]])) as Record<TaskStatus, TaskCard[]>;
    for (const t of [...filtered].sort((a, b) => a.sort - b.sort)) map[t.status].push(t);
    return map;
  }, [filtered]);

  function open(id: number | null) {
    setOpenId(id);
    setUrlParam("tarea", id ? String(id) : null);
  }

  function changeView(v: View) {
    setView(v);
    setUrlParam("vista", v === "tablero" ? null : v);
  }

  function create(status: TaskStatus, title: string, dueDate?: string) {
    startTransition(async () => {
      const r = await createTaskAction({ projectId, title, status, dueDate: dueDate ?? null });
      if (!r.ok) return void toast.error(r.error);
      router.refresh();
      if (dueDate) open(r.data.id);
    });
  }

  function onColumnDragOver(e: React.DragEvent, status: TaskStatus) {
    if (dragId === null) return;
    e.preventDefault();
    const col = columnRefs.current[status];
    if (!col) return;
    const cards = Array.from(col.querySelectorAll<HTMLElement>("[data-card-id]")).filter((el) => Number(el.dataset.cardId) !== dragId);
    let index = cards.length;
    for (const [i, el] of cards.entries()) {
      const rect = el.getBoundingClientRect();
      if (e.clientY < rect.top + rect.height / 2) {
        index = i;
        break;
      }
    }
    if (drop?.status !== status || drop.index !== index) setDrop({ status, index });
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    if (dragId === null || !drop) return finishDrag();
    const moving = tasks.find((t) => t.id === dragId);
    if (!moving) return finishDrag();
    const target = columns[drop.status].filter((t) => t.id !== dragId);
    const before = target[drop.index - 1] ?? null;
    const after = target[drop.index] ?? null;
    const sort =
      before && after ? (before.sort + after.sort) / 2 : before ? before.sort + 1024 : after ? after.sort - 1024 : 1024;
    const status = drop.status;
    setTasks((list) => list.map((t) => (t.id === dragId ? { ...t, status, sort } : t)));
    const id = dragId;
    finishDrag();
    startTransition(async () => {
      const r = await moveTaskAction(id, status, before?.id ?? null, after?.id ?? null);
      if (!r.ok) toast.error(r.error);
      router.refresh();
    });
  }

  function finishDrag() {
    setDragId(null);
    setDrop(null);
  }

  function quickStatus(id: number, status: string) {
    setTasks((list) => list.map((t) => (t.id === id ? { ...t, status: status as TaskStatus } : t)));
    startTransition(async () => {
      const r = await updateTaskAction(id, { status });
      if (!r.ok) toast.error(r.error);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Tabs value={view} onValueChange={(v) => changeView(v as View)}>
            <TabsList>
              <TabsTrigger value="tablero">
                <KanbanSquare className="size-3.5" />
                Tablero
              </TabsTrigger>
              <TabsTrigger value="lista">
                <List className="size-3.5" />
                Lista
              </TabsTrigger>
              <TabsTrigger value="calendario">
                <CalendarDays className="size-3.5" />
                Calendario
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative w-full sm:w-60">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar tarea…" className="pl-8" />
          </div>
          <Select value={who} onValueChange={(v) => setWho(String(v))}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todo el equipo</SelectItem>
              <SelectItem value="me">Asignadas a mí</SelectItem>
              <SelectItem value="none">Sin asignar</SelectItem>
              {members.map((m) => (
                <SelectItem key={m.id} value={String(m.id)}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={tag} onValueChange={(v) => setTag(String(v))}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos los canales</SelectItem>
              {allTags.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="ml-auto text-xs text-muted-foreground">{filtered.length} tarea(s)</span>
        </CardContent>
      </Card>

      {view === "tablero" && (
        <div className="-mx-1 overflow-x-auto px-1 pb-2">
          <div className="grid min-w-[1000px] grid-cols-4 gap-3">
            {TASK_STATUSES.map((status) => {
              const list = columns[status];
              return (
                <div
                  key={status}
                  ref={(el) => {
                    columnRefs.current[status] = el;
                  }}
                  onDragOver={(e) => onColumnDragOver(e, status)}
                  onDrop={onDrop}
                  className={cn(
                    "flex min-h-[420px] flex-col gap-2 rounded-2xl bg-muted/50 p-2 transition-colors",
                    drop?.status === status && "bg-[#d9342c]/[0.06] ring-2 ring-[#d9342c]/30"
                  )}
                >
                  <div className="flex items-center justify-between px-1.5 pt-1">
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      <span className={cn("size-2 rounded-full", TASK_STATUS_META[status].dot)} />
                      {TASK_STATUS_META[status].label}
                      <span className="text-xs font-normal text-muted-foreground">{list.length}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setAdding(status);
                        setNewTitle("");
                      }}
                      className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground"
                      aria-label={`Nueva tarea en ${TASK_STATUS_META[status].label}`}
                    >
                      <Plus className="size-4" />
                    </button>
                  </div>
                  {list.map((t, i) => (
                    <div key={t.id}>
                      {drop?.status === status && drop.index === i && dragId !== t.id && <div className="mb-2 h-1 rounded-full bg-[#d9342c]" />}
                      <TaskCardView
                        task={t}
                        data-card-id={t.id}
                        draggable
                        dragging={dragId === t.id}
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = "move";
                          setDragId(t.id);
                        }}
                        onDragEnd={finishDrag}
                        onOpen={() => open(t.id)}
                      />
                    </div>
                  ))}
                  {drop?.status === status && drop.index >= list.filter((t) => t.id !== dragId).length && (
                    <div className="h-1 rounded-full bg-[#d9342c]" />
                  )}
                  {adding === status ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (newTitle.trim()) create(status, newTitle.trim());
                        setNewTitle("");
                      }}
                      className="space-y-1.5"
                    >
                      <Input
                        autoFocus
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        onBlur={() => !newTitle.trim() && setAdding(null)}
                        onKeyDown={(e) => e.key === "Escape" && setAdding(null)}
                        placeholder="Nombre de la tarea y Enter"
                        className="bg-card"
                      />
                    </form>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setAdding(status);
                        setNewTitle("");
                      }}
                      className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                    >
                      <Plus className="size-4" />
                      Nueva tarea
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {view === "lista" && (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tarea</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="hidden md:table-cell">Responsable</TableHead>
                <TableHead className="hidden md:table-cell">Prioridad</TableHead>
                <TableHead>Entrega</TableHead>
                <TableHead className="hidden lg:table-cell">Canales</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="p-0">
                    <EmptyState icon={List} title="No hay tareas" description="Crea la primera desde el tablero." />
                  </TableCell>
                </TableRow>
              ) : (
                [...filtered]
                  .sort(
                    (a, b) =>
                      TASK_STATUSES.indexOf(a.status) - TASK_STATUSES.indexOf(b.status) || (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999")
                  )
                  .map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="max-w-[320px]">
                        <button type="button" onClick={() => open(t.id)} className="truncate text-left font-medium hover:underline">
                          {t.title}
                        </button>
                      </TableCell>
                      <TableCell>
                        <Select value={t.status} onValueChange={(v) => v && quickStatus(t.id, String(v))}>
                          <SelectTrigger size="sm" className="w-36">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TASK_STATUSES.map((s) => (
                              <SelectItem key={s} value={s}>
                                {TASK_STATUS_META[s].label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {t.assigneeName ? (
                          <span className="flex items-center gap-2">
                            <UserAvatar fullName={t.assigneeName} size="sm" />
                            {t.assigneeName}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Sin asignar</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant={URGENCY_META[t.priority].variant}>{URGENCY_META[t.priority].label}</Badge>
                      </TableCell>
                      <TableCell>
                        <DueChip date={t.dueDate} done={t.status === "hecho"} />
                      </TableCell>
                      <TableCell className="hidden max-w-[220px] truncate text-xs text-muted-foreground lg:table-cell">{t.tags.join(", ")}</TableCell>
                    </TableRow>
                  ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {view === "calendario" && (
        <TaskCalendar
          month={month}
          onMonthChange={setMonth}
          tasks={filtered}
          onOpen={open}
          onCreate={(date) => create("por_hacer", "Nueva tarea", date)}
        />
      )}

      <TaskSheet
        taskId={openId}
        onClose={() => open(null)}
        members={members}
        projects={projects}
        canDelete={(createdBy) => isAdmin || createdBy === meId}
      />
    </div>
  );
}
