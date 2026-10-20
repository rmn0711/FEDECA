"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { saveProjectAction } from "@/lib/actions/workspace";
import type { FormState } from "@/lib/actions/auth";
import { PROJECT_COLORS, PROJECT_ICONS } from "@/lib/workspace/constants";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const initialState: FormState = { error: null };

export function ProjectDialog({
  project,
}: {
  project?: { id: number; name: string; description: string | null; icon: string; color: string };
}) {
  const [open, setOpen] = useState(false);
  const [icon, setIcon] = useState(project?.icon ?? "📣");
  const [color, setColor] = useState(project?.color ?? PROJECT_COLORS[0]);
  const [state, action] = useActionState(saveProjectAction, initialState);
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    if (state.error) toast.error(state.error);
    if (state.ok) {
      toast.success(state.ok);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpen(false);
    }
  }, [state]);

  return (
    <>
      {project ? (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Pencil className="size-3.5" />
          Editar proyecto
        </Button>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <Plus className="size-4" />
          Nuevo proyecto
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              startTransition(() => action(fd));
            }}
            className="space-y-4"
          >
            <DialogHeader>
              <DialogTitle>{project ? "Editar proyecto" : "Nuevo proyecto"}</DialogTitle>
              <DialogDescription>Los proyectos agrupan tareas y páginas del equipo (campañas, lanzamientos, áreas).</DialogDescription>
            </DialogHeader>
            <input type="hidden" name="id" value={project?.id ?? ""} />
            <input type="hidden" name="icon" value={icon} />
            <input type="hidden" name="color" value={color} />
            <div className="space-y-2">
              <Label htmlFor="p-name">Nombre *</Label>
              <Input id="p-name" name="name" defaultValue={project?.name} required placeholder="Ej: Lanzamiento Torres del Parque" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-desc">Descripción</Label>
              <Textarea id="p-desc" name="description" defaultValue={project?.description ?? ""} rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Ícono</Label>
              <div className="flex flex-wrap gap-1">
                {PROJECT_ICONS.map((i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setIcon(i)}
                    className={cn("rounded-lg p-1.5 text-xl transition-colors hover:bg-accent", icon === i && "bg-accent ring-2 ring-[#d9342c]/40")}
                  >
                    {i}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-2">
                {PROJECT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Color ${c}`}
                    onClick={() => setColor(c)}
                    className={cn("size-7 rounded-full ring-offset-2 transition-all", color === c && "ring-2 ring-foreground")}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Guardando..." : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
