"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { CheckCircle2, RotateCcw, Settings2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { assignAction, categoryAction, statusAction, urgencyAction } from "@/lib/actions/tickets";
import type { FormState } from "@/lib/actions/auth";
import { CATEGORIES } from "@/lib/categories";
import { STATUSES, STATUS_META, URGENCIES, URGENCY_META, type Status, type Urgency } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const initialState: FormState = { error: null };

function useToastState(state: FormState) {
  useEffect(() => {
    if (state.error) toast.error(state.error);
    if (state.ok) toast.success(state.ok);
  }, [state]);
}

/** Diálogo para cambiar el estado con un comentario (obligatorio al resolver o reabrir). */
function StatusDialog({
  ticketId,
  target,
  onClose,
  requireComment,
  title,
  description,
}: {
  ticketId: number;
  target: Status | null;
  onClose: () => void;
  requireComment: boolean;
  title: string;
  description: string;
}) {
  const [state, formAction] = useActionState(statusAction, initialState);
  const [pending, startTransition] = useTransition();
  useToastState(state);
  useEffect(() => {
    if (state.ok) onClose();
    // Solo reacciona a un nuevo resultado de la acción.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <Dialog open={target !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            startTransition(() => formAction(fd));
          }}
          className="space-y-4"
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <input type="hidden" name="ticketId" value={ticketId} />
          <input type="hidden" name="status" value={target ?? ""} />
          <div className="space-y-2">
            <Label htmlFor="status-comment">{requireComment ? "Comentario *" : "Comentario (opcional)"}</Label>
            <Textarea id="status-comment" name="comment" rows={4} required={requireComment} />
            <p className="text-xs text-muted-foreground">Se publicará en el seguimiento y se enviará por correo.</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ManagePanel({
  ticketId,
  status,
  urgency,
  categorySlug,
  assigneeId,
  staff,
}: {
  ticketId: number;
  status: Status;
  urgency: Urgency;
  categorySlug: string;
  assigneeId: number | null;
  staff: Array<{ id: number; name: string }>;
}) {
  const [target, setTarget] = useState<Status | null>(null);
  const [pending, startTransition] = useTransition();

  function runQuick(fn: () => Promise<FormState>) {
    startTransition(async () => {
      const r = await fn();
      if (r.error) toast.error(r.error);
      else if (r.ok) toast.success(r.ok);
    });
  }

  return (
    <Card className={pending ? "opacity-70" : undefined}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings2 className="size-4 text-[#d9342c]" />
          Gestión
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label>Estado</Label>
          <Select value={status} onValueChange={(v) => v && setTarget(v as Status)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_META[s].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{STATUS_META[status].description}</p>
        </div>
        {status !== "resuelto" && status !== "cerrado" && (
          <Button className="w-full bg-[#1a7f4e] text-white hover:bg-[#156a41]" onClick={() => setTarget("resuelto")}>
            <CheckCircle2 className="size-4" />
            Marcar como resuelta
          </Button>
        )}
        <div className="space-y-1.5">
          <Label>Asignada a</Label>
          <Select
            value={assigneeId ? String(assigneeId) : "none"}
            onValueChange={(v) => runQuick(() => assignAction(ticketId, v === "none" || !v ? null : Number(v)))}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin asignar</SelectItem>
              {staff.map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Prioridad</Label>
          <Select value={urgency} onValueChange={(v) => v && runQuick(() => urgencyAction(ticketId, String(v)))}>
            <SelectTrigger className="w-full">
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
        </div>
        <div className="space-y-1.5">
          <Label>Categoría</Label>
          <Select value={categorySlug} onValueChange={(v) => v && runQuick(() => categoryAction(ticketId, String(v)))}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c.slug} value={c.slug}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Al cambiarla se asigna al responsable de la nueva categoría.</p>
        </div>
      </CardContent>
      <StatusDialog
        ticketId={ticketId}
        target={target}
        onClose={() => setTarget(null)}
        requireComment={target === "resuelto"}
        title={target === "resuelto" ? "Marcar como resuelta" : `Cambiar a "${target ? STATUS_META[target].label : ""}"`}
        description={
          target === "resuelto"
            ? "Describe la solución entregada. El solicitante la recibirá por correo y podrá calificar la atención."
            : target === "en_espera"
              ? "Indica qué información o acción esperas del solicitante o de un tercero."
              : "El solicitante será notificado por correo del cambio."
        }
      />
    </Card>
  );
}

export function RequesterPanel({ ticketId, status }: { ticketId: number; status: Status }) {
  const [target, setTarget] = useState<Status | null>(null);
  const done = status === "resuelto" || status === "cerrado";
  return (
    <Card>
      <CardHeader>
        <CardTitle>Acciones</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {done ? (
          <Button variant="outline" className="w-full" onClick={() => setTarget("abierto")}>
            <RotateCcw className="size-4" />
            Reabrir solicitud
          </Button>
        ) : (
          <Button variant="outline" className="w-full" onClick={() => setTarget("cerrado")}>
            <XCircle className="size-4" />
            Cancelar / cerrar solicitud
          </Button>
        )}
        <p className="text-xs text-muted-foreground">
          {done
            ? "Si la solución no funcionó, reabre la solicitud y explica qué pasa."
            : "Ciérrala si ya no la necesitas. El responsable será notificado."}
        </p>
      </CardContent>
      <StatusDialog
        ticketId={ticketId}
        target={target}
        onClose={() => setTarget(null)}
        requireComment={target === "abierto"}
        title={target === "abierto" ? "Reabrir solicitud" : "Cerrar solicitud"}
        description={target === "abierto" ? "Cuéntanos por qué la solución no funcionó." : "Puedes indicar el motivo del cierre."}
      />
    </Card>
  );
}
