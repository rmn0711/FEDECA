"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, CheckCircle2, MessageSquarePlus, PenLine, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { addReviewCommentAction, decideReviewAction, toggleReviewCommentAction } from "@/lib/actions/reviews";
import type { ReviewDetail } from "@/lib/reviews/queries";
import { formatDateTime, relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/shared/user-avatar";
import { REVIEW_STATUS } from "./reviews-section";

export function ReviewViewer({ review, canDecide, meId }: { review: ReviewDetail; canDecide: boolean; meId: number }) {
  const router = useRouter();
  const [draft, setDraft] = useState<{ x: number | null; y: number | null } | null>(null);
  const [text, setText] = useState("");
  const [decision, setDecision] = useState<"aprobada" | "cambios" | null>(null);
  const [decisionText, setDecisionText] = useState("");
  const [active, setActive] = useState<number | null>(null);
  const [showResolved, setShowResolved] = useState(false);
  const [pending, startTransition] = useTransition();
  const isImage = review.mime.startsWith("image/");
  const pins = review.comments.filter((c) => c.x !== null && c.y !== null && (showResolved || !c.resolved));
  const pinNumber = new Map(review.comments.filter((c) => c.x !== null).map((c, i) => [c.id, i + 1]));
  const latest = review.versions.at(-1)?.id === review.id;

  function placePin(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    setDraft({ x: ((e.clientX - rect.left) / rect.width) * 100, y: ((e.clientY - rect.top) / rect.height) * 100 });
    setText("");
  }

  function saveComment() {
    if (!text.trim()) return;
    startTransition(async () => {
      const r = await addReviewCommentAction(review.id, text, draft?.x ?? null, draft?.y ?? null);
      if (!r.ok) return void toast.error(r.error);
      setDraft(null);
      setText("");
      router.refresh();
    });
  }

  function decide() {
    if (!decision) return;
    startTransition(async () => {
      const r = await decideReviewAction(review.id, decision, decisionText);
      if (!r.ok) return void toast.error(r.error);
      toast.success(decision === "aprobada" ? "Pieza aprobada. La tarea quedó como hecha." : "Se pidieron cambios. Se notificó al responsable.");
      setDecision(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" className="-ml-2" render={<Link href={`/equipo/proyectos/${review.projectId}?tarea=${review.taskId}`}><ArrowLeft className="size-4" />Volver a la tarea</Link>} />
        <div className="ml-auto flex flex-wrap gap-1">
          {review.versions.map((v) => (
            <Link
              key={v.id}
              href={`/equipo/revisiones/${v.id}`}
              className={cn("rounded-full border px-3 py-1 text-xs font-medium", v.id === review.id ? "border-[#d9342c] bg-[#d9342c]/10 text-[#d9342c]" : "hover:bg-accent")}
            >
              v{v.version} {v.status === "aprobada" ? "✅" : v.status === "cambios" ? "✏️" : "⏳"}
            </Link>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            {review.projectIcon} {review.projectName} · Versión {review.version}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{review.taskTitle}</h1>
          <p className="text-sm text-muted-foreground">
            Enviada por {review.submittedByName} {relativeTime(review.submittedAt)} · {review.filename}
          </p>
        </div>
        <Badge variant={REVIEW_STATUS[review.status].variant} className="h-6 px-3 text-sm">
          {REVIEW_STATUS[review.status].label}
        </Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-2">
          {isImage && <p className="text-xs text-muted-foreground">Haz clic sobre la imagen para dejar un comentario en ese punto.</p>}
          <div className="overflow-hidden rounded-2xl bg-[repeating-conic-gradient(#f4f4f5_0%_25%,#fff_0%_50%)] bg-[length:20px_20px] p-4 ring-1 ring-foreground/10">
            {isImage ? (
              <div className="relative mx-auto w-fit cursor-crosshair" onClick={placePin}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/revisiones/${review.id}`} alt={review.filename} className="block max-h-[75vh] w-auto max-w-full select-none" draggable={false} />
                {pins.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActive(c.id);
                    }}
                    className={cn(
                      "absolute flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white text-xs font-bold text-white shadow-lg transition-transform hover:scale-110",
                      c.resolved ? "bg-[#6b6b6e]" : "bg-[#d9342c]",
                      active === c.id && "scale-125 ring-4 ring-[#d9342c]/30"
                    )}
                    style={{ left: `${c.x}%`, top: `${c.y}%` }}
                    title={c.body}
                  >
                    {pinNumber.get(c.id)}
                  </button>
                ))}
                {draft?.x != null && (
                  <span
                    className="absolute flex size-7 -translate-x-1/2 -translate-y-1/2 animate-pulse items-center justify-center rounded-full border-2 border-white bg-[#2a78d6] text-xs font-bold text-white shadow-lg"
                    style={{ left: `${draft.x}%`, top: `${draft.y}%` }}
                  >
                    +
                  </span>
                )}
              </div>
            ) : review.mime === "application/pdf" ? (
              <iframe src={`/api/revisiones/${review.id}`} title={review.filename} className="h-[75vh] w-full rounded-lg bg-white" />
            ) : (
              <video src={`/api/revisiones/${review.id}`} controls className="mx-auto max-h-[75vh]" />
            )}
          </div>
        </div>

        <aside className="space-y-4">
          {review.note && (
            <div className="rounded-xl bg-muted/50 p-3 text-sm">
              <p className="mb-1 text-xs font-semibold text-muted-foreground">Nota de {review.submittedByName}</p>
              {review.note}
            </div>
          )}

          {review.status === "pendiente" && canDecide && latest && (
            <div className="space-y-2 rounded-2xl border p-3">
              <p className="text-sm font-semibold">Tu decisión</p>
              {decision ? (
                <>
                  <Textarea
                    autoFocus
                    rows={3}
                    value={decisionText}
                    onChange={(e) => setDecisionText(e.target.value)}
                    placeholder={decision === "cambios" ? "¿Qué debe cambiar? (obligatorio)" : "Comentario (opcional)"}
                  />
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setDecision(null)}>
                      Cancelar
                    </Button>
                    <Button onClick={decide} disabled={pending} className={decision === "aprobada" ? "bg-[#1a7f4e] text-white hover:bg-[#156a41]" : ""}>
                      Confirmar
                    </Button>
                  </div>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Button className="bg-[#1a7f4e] text-white hover:bg-[#156a41]" onClick={() => setDecision("aprobada")}>
                    <CheckCircle2 className="size-4" />
                    Aprobar
                  </Button>
                  <Button variant="outline" onClick={() => setDecision("cambios")}>
                    <PenLine className="size-4" />
                    Pedir cambios
                  </Button>
                </div>
              )}
            </div>
          )}
          {review.status !== "pendiente" && (
            <div className={cn("rounded-2xl border p-3 text-sm", review.status === "aprobada" ? "border-[#1baf7a]/40 bg-[#1baf7a]/[0.06]" : "border-[#d9342c]/30 bg-[#d9342c]/[0.04]")}>
              <p className="font-semibold">
                {review.status === "aprobada" ? "Aprobada" : "Cambios pedidos"} por {review.decidedByName}
              </p>
              <p className="text-xs text-muted-foreground">{review.decidedAt ? formatDateTime(review.decidedAt) : ""}</p>
              {review.decisionComment && <p className="mt-1">{review.decisionComment}</p>}
            </div>
          )}
          {!latest && <p className="text-xs text-muted-foreground">Estás viendo una versión anterior.</p>}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Comentarios ({review.comments.filter((c) => !c.resolved).length} abiertos)</p>
              <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setShowResolved(!showResolved)}>
                {showResolved ? "Ocultar resueltos" : "Ver resueltos"}
              </button>
            </div>
            {(draft || !isImage) && (
              <div className="space-y-2 rounded-xl border border-[#2a78d6]/40 p-2">
                <p className="text-xs text-muted-foreground">{draft?.x != null ? "Comentario en el punto marcado" : "Comentario general"}</p>
                <Textarea autoFocus rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ej: subir el logo, cambiar el color del botón…" />
                <div className="flex justify-end gap-2">
                  {draft && (
                    <Button variant="ghost" size="sm" onClick={() => setDraft(null)}>
                      Cancelar
                    </Button>
                  )}
                  <Button size="sm" onClick={saveComment} disabled={pending || !text.trim()}>
                    Comentar
                  </Button>
                </div>
              </div>
            )}
            {isImage && !draft && (
              <Button variant="outline" size="sm" className="w-full" onClick={() => setDraft({ x: null, y: null })}>
                <MessageSquarePlus className="size-4" />
                Comentario general
              </Button>
            )}
            <ul className="space-y-2">
              {review.comments
                .filter((c) => showResolved || !c.resolved)
                .map((c) => (
                  <li
                    key={c.id}
                    onMouseEnter={() => setActive(c.id)}
                    className={cn("flex gap-2 rounded-xl border p-2.5 text-sm transition-colors", active === c.id && "border-[#d9342c]/50 bg-[#d9342c]/[0.04]", c.resolved && "opacity-60")}
                  >
                    {c.x !== null ? (
                      <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white", c.resolved ? "bg-[#6b6b6e]" : "bg-[#d9342c]")}>
                        {pinNumber.get(c.id)}
                      </span>
                    ) : (
                      <UserAvatar fullName={c.authorName ?? "?"} size="sm" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs">
                        <span className="font-semibold">{c.authorName}</span> <span className="text-muted-foreground">{relativeTime(c.createdAt)}</span>
                      </p>
                      <p className={cn("whitespace-pre-wrap", c.resolved && "line-through")}>{c.body}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => startTransition(async () => { await toggleReviewCommentAction(c.id); router.refresh(); })}
                      className="self-start text-muted-foreground hover:text-foreground"
                      title={c.resolved ? "Reabrir" : "Marcar como resuelto"}
                      aria-label={c.resolved ? "Reabrir comentario" : "Marcar como resuelto"}
                    >
                      {c.resolved ? <Undo2 className="size-4" /> : <Check className="size-4" />}
                    </button>
                  </li>
                ))}
            </ul>
            {review.comments.length === 0 && <p className="text-xs text-muted-foreground">Sin comentarios.</p>}
          </div>
          {meId === review.submittedBy && review.status === "cambios" && (
            <p className="rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
              Ajusta la pieza y sube la nueva versión desde el detalle de la tarea.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
