"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ImageUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { listTaskReviewsAction, submitReviewAction } from "@/lib/actions/reviews";
import type { ReviewSummary } from "@/lib/reviews/queries";
import { relativeTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const REVIEW_STATUS = {
  pendiente: { label: "Pendiente", variant: "warning" },
  aprobada: { label: "Aprobada", variant: "success" },
  cambios: { label: "Requiere cambios", variant: "destructive" },
} as const;

/** Dentro del detalle de una tarea: versiones de la pieza y envío a aprobación. */
export function ReviewsSection({ taskId }: { taskId: number }) {
  const router = useRouter();
  const [items, setItems] = useState<ReviewSummary[] | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    listTaskReviewsAction(taskId).then((r) => r.ok && setItems(r.data));
  }, [taskId]);

  function submit() {
    if (!file) return;
    const fd = new FormData();
    fd.set("taskId", String(taskId));
    fd.set("file", file);
    fd.set("note", note);
    startTransition(async () => {
      const r = await submitReviewAction(fd);
      if (!r.ok) return void toast.error(r.error);
      toast.success("Pieza enviada a aprobación. Se notificó al líder.");
      router.push(`/equipo/revisiones/${r.data.id}`);
    });
  }

  return (
    <div className="space-y-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <CheckCircle2 className="size-4 text-[#d9342c]" />
        Aprobación de piezas
      </h3>
      {items === null ? (
        <p className="text-xs text-muted-foreground">Cargando…</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-muted-foreground">Aún no se ha enviado ninguna versión para aprobación.</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((r) => (
            <li key={r.id}>
              <Link href={`/equipo/revisiones/${r.id}`} className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-accent">
                {r.mime.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/revisiones/${r.id}`} alt="" className="size-10 rounded-md border object-cover" />
                ) : (
                  <span className="flex size-10 items-center justify-center rounded-md border text-[10px] font-semibold text-muted-foreground uppercase">{r.mime.split("/")[1]}</span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">Versión {r.version}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {r.submittedByName} · {relativeTime(r.submittedAt)}
                  </span>
                </span>
                <Badge variant={REVIEW_STATUS[r.status].variant}>{REVIEW_STATUS[r.status].label}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div className="space-y-2 rounded-xl border border-dashed p-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ImageUp className="size-4" />
          {file ? <span className="truncate font-medium text-foreground">{file.name}</span> : "Subir nueva versión (imagen, PDF o video)"}
          <input type="file" accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,video/mp4" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        {file && (
          <div className="flex gap-2">
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nota para quien aprueba (opcional)" />
            <Button onClick={submit} disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Enviar a aprobación
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
