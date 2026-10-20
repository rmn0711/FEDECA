import { ArrowRight, CheckCircle2, FileText, Lock, Mail, MessageCircle, Paperclip, RefreshCcw, Star, Tag, UserCheck, Zap } from "lucide-react";
import type { TicketDetail } from "@/lib/tickets/queries";
import { STATUS_META, URGENCY_META, type Status, type Urgency } from "@/lib/constants";
import { getCategory } from "@/lib/categories";
import { formatBytes, formatDateTime, relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import { EmptyState } from "@/components/ui/empty-state";

type Event = TicketDetail["events"][number];
type Attachment = TicketDetail["attachments"][number];

export function AttachmentList({ files }: { files: Attachment[] }) {
  if (files.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {files.map((f) => (
        <a
          key={f.id}
          href={`/api/adjuntos/${f.id}`}
          target="_blank"
          rel="noreferrer"
          className="flex max-w-full items-center gap-2 rounded-lg border bg-background px-2.5 py-1.5 text-xs transition-colors hover:bg-accent"
        >
          {f.mime.startsWith("image/") ? <Paperclip className="size-3.5 text-[#d9342c]" /> : <FileText className="size-3.5 text-[#d9342c]" />}
          <span className="max-w-[220px] truncate font-medium">{f.filename}</span>
          <span className="text-muted-foreground">{formatBytes(f.size)}</span>
        </a>
      ))}
    </div>
  );
}

function SystemLine({ icon: Icon, children, at }: { icon: typeof Tag; children: React.ReactNode; at: Date }) {
  return (
    <div className="flex items-center gap-3 py-1 pl-2 text-xs text-muted-foreground">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted">
        <Icon className="size-3.5" />
      </span>
      <span className="min-w-0 flex-1">{children}</span>
      <time title={formatDateTime(at)} className="shrink-0">{relativeTime(at)}</time>
    </div>
  );
}

function Bubble({
  event,
  files,
  variant,
  label,
}: {
  event: Event;
  files: Attachment[];
  variant: "requester" | "staff" | "note" | "solution";
  label?: string;
}) {
  const name = event.authorName ?? "Sistema";
  return (
    <div className="flex gap-3">
      <UserAvatar fullName={name} className="mt-1" />
      <div
        className={cn(
          "min-w-0 flex-1 rounded-2xl border p-4 shadow-xs",
          variant === "staff" && "bg-card",
          variant === "requester" && "bg-muted/40",
          variant === "note" && "border-dashed border-[#eb6834]/40 bg-[#eb6834]/[0.05]",
          variant === "solution" && "border-[#1baf7a]/40 bg-[#1baf7a]/[0.06]"
        )}
      >
        <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold">{name}</span>
          {variant === "note" && (
            <Badge variant="warning">
              <Lock />
              Nota interna
            </Badge>
          )}
          {variant === "solution" && (
            <Badge variant="success">
              <CheckCircle2 />
              Solución
            </Badge>
          )}
          {label && <Badge variant="neutral">{label}</Badge>}
          {event.source === "whatsapp" && (
            <Badge variant="success">
              <MessageCircle />
              Por WhatsApp
            </Badge>
          )}
          {event.source === "email" && (
            <Badge variant="info">
              <Mail />
              Por correo
            </Badge>
          )}
          <time className="ml-auto text-xs text-muted-foreground" title={formatDateTime(event.createdAt)}>
            {formatDateTime(event.createdAt)}
          </time>
        </div>
        {event.body && <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">{event.body}</p>}
        {files.length > 0 && (
          <div className="mt-3">
            <AttachmentList files={files} />
          </div>
        )}
      </div>
    </div>
  );
}

export function TicketTimeline({
  events,
  attachments,
  requesterId,
}: {
  events: Event[];
  attachments: Attachment[];
  requesterId: number;
}) {
  if (events.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed">
        <EmptyState icon={Mail} title="Aún no hay respuestas" description="Las respuestas y cambios de estado aparecerán aquí y se enviarán por correo." />
      </div>
    );
  }
  const filesOf = (id: number) => attachments.filter((a) => a.eventId === id);

  return (
    <div className="space-y-3">
      {events.map((e) => {
        const who = e.authorName ?? "El sistema";
        const meta = e.meta as Record<string, unknown>;
        switch (e.type) {
          case "comment":
            return (
              <Bubble
                key={e.id}
                event={e}
                files={filesOf(e.id)}
                variant={e.authorId === requesterId ? "requester" : "staff"}
                label={e.authorId === requesterId ? "Solicitante" : "Mesa de ayuda"}
              />
            );
          case "note":
            return <Bubble key={e.id} event={e} files={filesOf(e.id)} variant="note" />;
          case "status": {
            const to = meta.to as Status;
            const from = meta.from as Status;
            return (
              <div key={e.id} className="space-y-2">
                <SystemLine icon={meta.auto ? RefreshCcw : ArrowRight} at={e.createdAt}>
                  {meta.auto ? "La solicitud cambió automáticamente" : `${who} cambió el estado`} de{" "}
                  <strong>{STATUS_META[from]?.label}</strong> a <strong>{STATUS_META[to]?.label}</strong>
                </SystemLine>
                {e.body && <Bubble event={e} files={[]} variant={to === "resuelto" ? "solution" : "staff"} />}
              </div>
            );
          }
          case "assign":
            return (
              <SystemLine key={e.id} icon={UserCheck} at={e.createdAt}>
                {meta.assigneeName ? (
                  <>
                    {who} asignó la solicitud a <strong>{String(meta.assigneeName)}</strong>
                  </>
                ) : (
                  <>{who} quitó la asignación</>
                )}
              </SystemLine>
            );
          case "urgency":
            return (
              <SystemLine key={e.id} icon={Zap} at={e.createdAt}>
                {who} cambió la prioridad de <strong>{URGENCY_META[meta.from as Urgency]?.label}</strong> a{" "}
                <strong>{URGENCY_META[meta.to as Urgency]?.label}</strong> y se recalcularon los tiempos
              </SystemLine>
            );
          case "category":
            return (
              <SystemLine key={e.id} icon={Tag} at={e.createdAt}>
                {who} movió la solicitud de <strong>{getCategory(String(meta.from))?.name}</strong> a{" "}
                <strong>{getCategory(String(meta.to))?.name}</strong>
              </SystemLine>
            );
          case "rating":
            return (
              <div key={e.id} className="space-y-2">
                <SystemLine icon={Star} at={e.createdAt}>
                  {who} calificó la atención con <strong className="text-[#eb6834]">{"★".repeat(Number(meta.rating))}</strong> ({String(meta.rating)}/5)
                  y cerró la solicitud
                </SystemLine>
                {e.body && <Bubble event={e} files={[]} variant="requester" label="Comentario de calificación" />}
              </div>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
