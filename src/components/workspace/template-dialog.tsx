"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LayoutTemplate } from "lucide-react";
import { toast } from "sonner";
import { applyTemplateAction, templateAssigneesAction } from "@/lib/actions/workspace";
import { ROLE_LABELS, TEMPLATES } from "@/lib/workspace/templates";
import { addDaysISO, formatShortDate, todayISO } from "@/lib/workspace/constants";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function TemplateDialog({ projectId }: { projectId: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [templateId, setTemplateId] = useState(TEMPLATES[0].id);
  const [keyDate, setKeyDate] = useState(() => addDaysISO(todayISO(), 30));
  const [prefix, setPrefix] = useState("");
  const [assignees, setAssignees] = useState<Record<string, { id: number; name: string } | null>>({});
  const [pending, startTransition] = useTransition();
  const template = TEMPLATES.find((t) => t.id === templateId)!;

  useEffect(() => {
    if (open) templateAssigneesAction().then(setAssignees).catch(() => {});
  }, [open]);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <LayoutTemplate className="size-3.5" />
        Usar plantilla
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Crear tareas desde una plantilla</DialogTitle>
            <DialogDescription>Se crean todas las tareas con fechas relativas a la fecha clave y el responsable de cada área.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 sm:grid-cols-2">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTemplateId(t.id)}
                className={cn("rounded-xl border p-3 text-left transition-all", t.id === templateId ? "border-[#d9342c] ring-2 ring-[#d9342c]/30" : "hover:bg-accent")}
              >
                <p className="font-semibold">
                  {t.icon} {t.name}
                </p>
                <p className="text-xs text-muted-foreground">{t.description}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t.tasks.length} tareas</p>
              </button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="tpl-date">{template.keyDateLabel}</Label>
              <Input id="tpl-date" type="date" value={keyDate} onChange={(e) => setKeyDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tpl-prefix">Nombre de la campaña (opcional)</Label>
              <Input id="tpl-prefix" value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="Ej: Torres del Parque" />
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto rounded-xl border">
            <table className="w-full text-sm">
              <tbody>
                {template.tasks.map((t) => (
                  <tr key={t.title} className="border-b last:border-0">
                    <td className="px-3 py-1.5 whitespace-nowrap text-muted-foreground">{keyDate ? formatShortDate(addDaysISO(keyDate, t.offset)) : "—"}</td>
                    <td className="px-3 py-1.5">{prefix ? `${prefix} · ${t.title}` : t.title}</td>
                    <td className="px-3 py-1.5 text-xs whitespace-nowrap text-muted-foreground">
                      {assignees[t.role]?.name ?? (t.role === "lider" ? "Tú" : `${ROLE_LABELS[t.role]} (sin asignar)`)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={pending || !keyDate}
              onClick={() =>
                startTransition(async () => {
                  const r = await applyTemplateAction({ projectId, templateId, keyDate, prefix });
                  if (!r.ok) return void toast.error(r.error);
                  toast.success(`${r.data.created} tareas creadas. Se notificó a los responsables.`);
                  setOpen(false);
                  router.refresh();
                })
              }
            >
              {pending ? "Creando..." : `Crear ${template.tasks.length} tareas`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
