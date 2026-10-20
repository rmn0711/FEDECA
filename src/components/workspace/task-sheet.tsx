"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Check, ExternalLink, Eye, Flag, FolderKanban, Pencil, Plus, Send, Tag, Trash2, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import {
  addTaskCommentAction,
  deleteTaskAction,
  getTaskAction,
  updateTaskAction,
  type TaskPatch,
} from "@/lib/actions/workspace";
import type { TaskDetail } from "@/lib/workspace/queries";
import { CHANNEL_TAGS, TASK_STATUSES, TASK_STATUS_META, type ChecklistItem } from "@/lib/workspace/constants";
import { URGENCIES, URGENCY_META, ticketCode } from "@/lib/constants";
import { formatDateTime, relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Markdown, toggleTaskInMarkdown } from "./markdown";
import { MarkdownEditor } from "./markdown-editor";

type Member = { id: number; name: string };
type ProjectOption = { id: number; name: string; icon: string };

function Row({ icon: Icon, label, children }: { icon: typeof Flag; label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[130px_1fr] items-center gap-2 text-sm">
      <span className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4" />
        {label}
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function TaskSheet({
  taskId,
  onClose,
  members,
  projects,
  canDelete,
}: {
  taskId: number | null;
  onClose: () => void;
  members: Member[];
  projects: ProjectOption[];
  canDelete: (createdBy: number | null) => boolean;
}) {
  const router = useRouter();
  const [detail, setDetail] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [editingDesc, setEditingDesc] = useState(false);
  const [comment, setComment] = useState("");
  const [newItem, setNewItem] = useState("");
  const [customTag, setCustomTag] = useState("");
  const [, startTransition] = useTransition();

  async function load(id: number) {
    const r = await getTaskAction(id);
    if (!r.ok) {
      toast.error(r.error);
      onClose();
      return;
    }
    setDetail(r.data);
    setTitle(r.data.task.title);
    setDescription(r.data.task.description);
  }

  useEffect(() => {
    if (!taskId) return;
    let cancel = false;
    setLoading(true);
    setEditingDesc(false);
    getTaskAction(taskId).then((r) => {
      if (cancel) return;
      setLoading(false);
      if (!r.ok) {
        toast.error(r.error);
        onClose();
        return;
      }
      setDetail(r.data);
      setTitle(r.data.task.title);
      setDescription(r.data.task.description);
    });
    return () => {
      cancel = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  const task = detail?.task;

  function save(patch: TaskPatch, success?: string) {
    if (!task) return;
    // Actualización optimista del panel; el tablero se refresca al confirmar.
    setDetail((d) => (d ? { ...d, task: { ...d.task, ...(patch as Partial<TaskDetail["task"]>) } } : d));
    startTransition(async () => {
      const r = await updateTaskAction(task.id, patch);
      if (!r.ok) {
        toast.error(r.error);
        await load(task.id);
        return;
      }
      if (success) toast.success(success);
      router.refresh();
    });
  }

  function setChecklist(list: ChecklistItem[]) {
    save({ checklist: list });
  }

  function addComment() {
    if (!task || !comment.trim()) return;
    const body = comment;
    setComment("");
    startTransition(async () => {
      const r = await addTaskCommentAction(task.id, body);
      if (!r.ok) {
        toast.error(r.error);
        setComment(body);
        return;
      }
      await load(task.id);
      router.refresh();
    });
  }

  function remove() {
    if (!task || !confirm("¿Eliminar esta tarea? No se puede deshacer.")) return;
    startTransition(async () => {
      const r = await deleteTaskAction(task.id);
      if (!r.ok) return void toast.error(r.error);
      toast.success("Tarea eliminada.");
      onClose();
      router.refresh();
    });
  }

  const done = task?.checklist.filter((c) => c.done).length ?? 0;

  return (
    <Sheet open={taskId !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 sm:max-w-xl">
        <SheetTitle className="sr-only">Detalle de la tarea</SheetTitle>
        {loading || !task || !detail ? (
          <div className="space-y-4 p-6">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <div className="space-y-6 p-6">
            <div className="space-y-2 pr-8">
              <p className="text-xs font-medium text-muted-foreground">
                {detail.projectIcon} {detail.projectName} · Tarea #{task.id}
              </p>
              <textarea
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => title.trim() && title !== task.title && save({ title })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    e.currentTarget.blur();
                  }
                }}
                rows={1}
                className="field-sizing-content w-full resize-none bg-transparent text-2xl font-semibold tracking-tight outline-none"
                aria-label="Nombre de la tarea"
              />
            </div>

            <div className="space-y-3">
              <Row icon={Check} label="Estado">
                <Select value={task.status} onValueChange={(v) => v && save({ status: String(v) })}>
                  <SelectTrigger className="w-48">
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
              </Row>
              <Row icon={UserRound} label="Responsable">
                <Select
                  value={task.assigneeId ? String(task.assigneeId) : "none"}
                  onValueChange={(v) => save({ assigneeId: !v || v === "none" ? null : Number(v) }, v && v !== "none" ? "Asignada; se notificó por correo." : undefined)}
                >
                  <SelectTrigger className="w-56">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin asignar</SelectItem>
                    {members.map((m) => (
                      <SelectItem key={m.id} value={String(m.id)}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Row>
              <Row icon={Flag} label="Prioridad">
                <Select value={task.priority} onValueChange={(v) => v && save({ priority: String(v) })}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {URGENCIES.map((u) => (
                      <SelectItem key={u} value={u}>
                        {URGENCY_META[u].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Row>
              <Row icon={CalendarDays} label="Fechas">
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    type="date"
                    className="w-40"
                    aria-label="Fecha de inicio"
                    title="Inicio"
                    value={task.startDate ?? ""}
                    onChange={(e) => save({ startDate: e.target.value || null })}
                  />
                  <span className="text-muted-foreground">→</span>
                  <Input
                    type="date"
                    className="w-40"
                    aria-label="Fecha de entrega"
                    title="Entrega"
                    value={task.dueDate ?? ""}
                    onChange={(e) => save({ dueDate: e.target.value || null })}
                  />
                </div>
              </Row>
              <Row icon={FolderKanban} label="Proyecto">
                <Select value={String(task.projectId)} onValueChange={(v) => v && save({ projectId: Number(v) }, "Tarea movida de proyecto.")}>
                  <SelectTrigger className="w-56">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.icon} {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Row>
              <div className="grid grid-cols-[130px_1fr] gap-2 text-sm">
                <span className="flex items-center gap-2 pt-1 text-muted-foreground">
                  <Tag className="size-4" />
                  Canales
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {Array.from(new Set([...CHANNEL_TAGS, ...task.tags])).map((t) => {
                    const on = task.tags.includes(t);
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => save({ tags: on ? task.tags.filter((x) => x !== t) : [...task.tags, t] })}
                        className={cn(
                          "rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                          on ? "border-[#d9342c] bg-[#d9342c]/10 text-[#d9342c]" : "text-muted-foreground hover:bg-accent"
                        )}
                      >
                        {t}
                      </button>
                    );
                  })}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!customTag.trim()) return;
                      save({ tags: [...task.tags, customTag.trim()] });
                      setCustomTag("");
                    }}
                  >
                    <input
                      value={customTag}
                      onChange={(e) => setCustomTag(e.target.value)}
                      placeholder="+ Otra etiqueta"
                      className="w-28 rounded-full border border-dashed bg-transparent px-2.5 py-0.5 text-xs outline-none focus:border-solid"
                    />
                  </form>
                </div>
              </div>
              {task.ticketId && (
                <Row icon={ExternalLink} label="Solicitud">
                  <Link href={`/solicitudes/${task.ticketId}`} className="font-medium text-[#d9342c] hover:underline">
                    {ticketCode(task.ticketId)} (mesa de ayuda)
                  </Link>
                </Row>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Descripción</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (editingDesc && description !== task.description) save({ description });
                    setEditingDesc(!editingDesc);
                  }}
                >
                  {editingDesc ? <Eye className="size-3.5" /> : <Pencil className="size-3.5" />}
                  {editingDesc ? "Guardar y ver" : "Editar"}
                </Button>
              </div>
              {editingDesc ? (
                <MarkdownEditor
                  value={description}
                  onChange={setDescription}
                  autoFocus
                  minRows={6}
                  placeholder="Brief, objetivo, enlaces, entregables…"
                />
              ) : description ? (
                <button type="button" onDoubleClick={() => setEditingDesc(true)} className="block w-full rounded-xl border p-3 text-left">
                  <Markdown
                    source={description}
                    onToggleTask={(i) => {
                      const next = toggleTaskInMarkdown(description, i);
                      setDescription(next);
                      save({ description: next });
                    }}
                  />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingDesc(true)}
                  className="w-full rounded-xl border border-dashed p-4 text-left text-sm text-muted-foreground hover:bg-accent"
                >
                  Agregar brief, objetivo, enlaces o entregables…
                </button>
              )}
            </div>

            <div className="space-y-2">
              <h3 className="flex items-center justify-between text-sm font-semibold">
                Checklist
                {task.checklist.length > 0 && (
                  <span className="text-xs font-normal text-muted-foreground">
                    {done}/{task.checklist.length}
                  </span>
                )}
              </h3>
              {task.checklist.length > 0 && (
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-[#1baf7a] transition-all" style={{ width: `${(done / task.checklist.length) * 100}%` }} />
                </div>
              )}
              <ul className="space-y-1">
                {task.checklist.map((c) => (
                  <li key={c.id} className="group flex items-center gap-2 rounded-lg px-1 py-0.5 hover:bg-accent">
                    <input
                      type="checkbox"
                      checked={c.done}
                      onChange={() => setChecklist(task.checklist.map((x) => (x.id === c.id ? { ...x, done: !x.done } : x)))}
                      className="size-4 accent-[#d9342c]"
                    />
                    <span className={cn("flex-1 text-sm", c.done && "text-muted-foreground line-through")}>{c.text}</span>
                    <button
                      type="button"
                      aria-label="Quitar"
                      onClick={() => setChecklist(task.checklist.filter((x) => x.id !== c.id))}
                      className="opacity-0 group-hover:opacity-100"
                    >
                      <X className="size-3.5 text-muted-foreground" />
                    </button>
                  </li>
                ))}
              </ul>
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newItem.trim()) return;
                  setChecklist([...task.checklist, { id: crypto.randomUUID(), text: newItem.trim(), done: false }]);
                  setNewItem("");
                }}
              >
                <Input value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="Agregar elemento…" />
                <Button type="submit" variant="outline" size="icon" aria-label="Agregar elemento">
                  <Plus className="size-4" />
                </Button>
              </form>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Comentarios</h3>
              {detail.comments.length === 0 && <p className="text-sm text-muted-foreground">Aún no hay comentarios.</p>}
              {detail.comments.map((c) => (
                <div key={c.id} className="flex gap-2.5">
                  <UserAvatar fullName={c.authorName ?? "?"} size="sm" />
                  <div className="min-w-0 flex-1 rounded-xl bg-muted/50 px-3 py-2">
                    <p className="text-xs">
                      <span className="font-semibold">{c.authorName}</span>{" "}
                      <span className="text-muted-foreground" title={formatDateTime(c.createdAt)}>
                        {relativeTime(c.createdAt)}
                      </span>
                    </p>
                    <p className="mt-0.5 text-sm whitespace-pre-wrap">{c.body}</p>
                  </div>
                </div>
              ))}
              <div className="flex gap-2">
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) addComment();
                  }}
                  rows={2}
                  placeholder="Escribe un comentario… (Ctrl+Enter para enviar)"
                />
                <Button size="icon" onClick={addComment} aria-label="Enviar comentario" className="self-end">
                  <Send className="size-4" />
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between border-t pt-4 text-xs text-muted-foreground">
              <span>
                Creada {formatDateTime(task.createdAt)}
                {detail.createdByName ? ` por ${detail.createdByName}` : ""}
              </span>
              {canDelete(task.createdBy) && (
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={remove}>
                  <Trash2 className="size-3.5" />
                  Eliminar
                </Button>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
