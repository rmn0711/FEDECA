"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Eye, FilePlus2, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createPageAction, deletePageAction, updatePageAction } from "@/lib/actions/workspace";
import { PAGE_ICONS } from "@/lib/workspace/constants";
import { formatDateTime, relativeTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Markdown, toggleTaskInMarkdown } from "./markdown";
import { MarkdownEditor } from "./markdown-editor";

type SaveState = "saved" | "dirty" | "saving";

export function PageEditor({
  page,
  updatedByName,
  project,
  subpages,
  breadcrumb,
  canDelete,
  startEditing,
}: {
  page: { id: number; title: string; icon: string; content: string; updatedAt: string; parentId: number | null };
  updatedByName: string | null;
  project: { id: number; name: string; icon: string } | null;
  subpages: Array<{ id: number; title: string; icon: string }>;
  breadcrumb: Array<{ id: number; title: string; icon: string }>;
  canDelete: boolean;
  startEditing: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(page.title === "Sin título" && startEditing ? "" : page.title);
  const [icon, setIcon] = useState(page.icon);
  const [content, setContent] = useState(page.content);
  const [editing, setEditing] = useState(startEditing || !page.content);
  const [state, setState] = useState<SaveState>("saved");
  const [updatedAt, setUpdatedAt] = useState(page.updatedAt);
  const [, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPatch = useRef<{ title?: string; icon?: string; content?: string }>({});

  function flush() {
    if (timer.current) clearTimeout(timer.current);
    const patch = pendingPatch.current;
    if (Object.keys(patch).length === 0) return;
    pendingPatch.current = {};
    setState("saving");
    startTransition(async () => {
      const r = await updatePageAction(page.id, patch);
      if (!r.ok) {
        toast.error(r.error);
        setState("dirty");
        return;
      }
      setUpdatedAt(r.data.updatedAt);
      setState(Object.keys(pendingPatch.current).length ? "dirty" : "saved");
      if (patch.title !== undefined || patch.icon !== undefined) router.refresh();
    });
  }

  // Guardado automático: 800 ms después de dejar de escribir.
  function queue(patch: { title?: string; icon?: string; content?: string }, immediate = false) {
    pendingPatch.current = { ...pendingPatch.current, ...patch };
    setState("dirty");
    if (timer.current) clearTimeout(timer.current);
    if (immediate) flush();
    else timer.current = setTimeout(flush, 800);
  }

  // Guarda lo pendiente al salir de la página o cerrar la pestaña.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (Object.keys(pendingPatch.current).length) {
        flush();
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      if (Object.keys(pendingPatch.current).length) flush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function remove() {
    if (!confirm("¿Eliminar esta página y todas sus subpáginas? No se puede deshacer.")) return;
    startTransition(async () => {
      const r = await deletePageAction(page.id);
      if (!r.ok) return void toast.error(r.error);
      toast.success("Página eliminada.");
      router.push(r.data.parentId ? `/equipo/paginas/${r.data.parentId}` : "/equipo/paginas");
    });
  }

  function addSubpage() {
    startTransition(async () => {
      const r = await createPageAction({ parentId: page.id });
      if (!r.ok) return void toast.error(r.error);
      router.push(`/equipo/paginas/${r.data.id}?editar=1`);
    });
  }

  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <nav className="flex min-w-0 flex-wrap items-center gap-1">
          <Link href="/equipo/paginas" className="hover:text-foreground">
            Páginas
          </Link>
          {breadcrumb.map((b) => (
            <span key={b.id} className="flex items-center gap-1">
              <span>/</span>
              <Link href={`/equipo/paginas/${b.id}`} className="truncate hover:text-foreground">
                {b.icon} {b.title}
              </Link>
            </span>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1" aria-live="polite">
            {state === "saving" ? (
              <>
                <Loader2 className="size-3 animate-spin" /> Guardando…
              </>
            ) : state === "dirty" ? (
              "Cambios sin guardar"
            ) : (
              <>
                <Check className="size-3" /> Guardado
              </>
            )}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (editing) queue({}, true);
              setEditing(!editing);
            }}
          >
            {editing ? <Eye className="size-3.5" /> : <Pencil className="size-3.5" />}
            {editing ? "Ver" : "Editar"}
          </Button>
          {canDelete && (
            <Button variant="ghost" size="icon-sm" onClick={remove} aria-label="Eliminar página" title="Eliminar página">
              <Trash2 className="size-4 text-muted-foreground" />
            </Button>
          )}
        </div>
      </div>

      <header className="space-y-2">
        <Popover>
          <PopoverTrigger
            render={
              <button type="button" className="rounded-xl p-1 text-5xl leading-none transition-colors hover:bg-accent" aria-label="Cambiar ícono">
                {icon}
              </button>
            }
          />
          <PopoverContent className="w-64">
            <div className="grid grid-cols-7 gap-1">
              {PAGE_ICONS.map((i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setIcon(i);
                    queue({ icon: i }, true);
                  }}
                  className="rounded-md p-1 text-xl hover:bg-accent"
                >
                  {i}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        <textarea
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            queue({ title: e.target.value });
          }}
          onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
          rows={1}
          autoFocus={startEditing}
          placeholder="Sin título"
          className="field-sizing-content w-full resize-none bg-transparent text-4xl font-bold tracking-tight outline-none placeholder:text-muted-foreground/50"
          aria-label="Título de la página"
        />
        <p className="text-xs text-muted-foreground" title={formatDateTime(updatedAt)}>
          {project && (
            <>
              <Link href={`/equipo/proyectos/${project.id}`} className="font-medium hover:text-foreground">
                {project.icon} {project.name}
              </Link>
              {" · "}
            </>
          )}
          Editada {relativeTime(updatedAt)}
          {updatedByName ? ` por ${updatedByName}` : ""}
        </p>
      </header>

      {editing ? (
        <MarkdownEditor
          value={content}
          onChange={(v) => {
            setContent(v);
            queue({ content: v });
          }}
          minRows={16}
          placeholder={"Empieza a escribir…\n\n# Título\n- Lista\n- [ ] Tarea pendiente\n> Nota destacada"}
        />
      ) : content.trim() ? (
        <div onDoubleClick={() => setEditing(true)} title="Doble clic para editar">
          <Markdown
            source={content}
            onToggleTask={(i) => {
              const next = toggleTaskInMarkdown(content, i);
              setContent(next);
              queue({ content: next }, true);
            }}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="w-full rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground hover:bg-accent"
        >
          Página vacía. Haz clic para empezar a escribir.
        </button>
      )}

      <section className="space-y-2 border-t pt-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground">Subpáginas</h2>
          <Button variant="ghost" size="sm" onClick={addSubpage}>
            <FilePlus2 className="size-3.5" />
            Nueva subpágina
          </Button>
        </div>
        {subpages.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sin subpáginas.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {subpages.map((s) => (
              <Link key={s.id} href={`/equipo/paginas/${s.id}`} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-accent">
                <span>{s.icon}</span>
                <span className="truncate font-medium">{s.title}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </article>
  );
}
