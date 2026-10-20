import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, AtSign, Building2, CalendarClock, Mail, Phone, UserRound } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getStaff, getTicketDetail } from "@/lib/tickets/queries";
import { getCategory, formatFieldValue } from "@/lib/categories";
import { URGENCY_META, ticketCode } from "@/lib/constants";
import { formatDateTime, relativeTime } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { UserAvatar } from "@/components/shared/user-avatar";
import { CategoryIcon, PriorityBadge, SlaBadge, StatusBadge } from "@/components/tickets/badges";
import { AttachmentList, TicketTimeline } from "@/components/tickets/ticket-timeline";
import { TicketComposer } from "@/components/tickets/ticket-composer";
import { ManagePanel, RequesterPanel } from "@/components/tickets/manage-panel";
import { RatingCard } from "@/components/tickets/rating-card";
import { CreatedToast } from "@/components/tickets/created-toast";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: ticketCode(Number(id) || 0) };
}

export default async function TicketPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ creada?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { creada } = await searchParams;
  const detail = await getTicketDetail(user, Number(id));
  if (!detail) notFound();
  const { ticket, category, requester, assignee, responsible, canManage, isRequester } = detail;
  const def = getCategory(ticket.categorySlug);
  const staff = canManage ? await getStaff() : [];
  const closed = ticket.status === "cerrado";
  const knownKeys = new Set(def?.fields.map((f) => f.key));
  const extraFields = Object.entries(ticket.fields).filter(([k]) => !knownKeys.has(k));
  const firstFiles = detail.attachments.filter((a) => detail.events[0] && a.eventId === detail.events[0].id);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {creada && <CreatedToast />}
      <div className="space-y-3">
        <Button variant="ghost" size="sm" className="-ml-2" render={<Link href="/solicitudes"><ArrowLeft className="size-4" />Solicitudes</Link>} />
        <div className="flex flex-wrap items-start gap-4">
          <CategoryIcon slug={ticket.categorySlug} className="size-12 rounded-xl" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              {ticketCode(ticket.id)} · {category.name}
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-balance">{ticket.title}</h1>
            <div className="flex flex-wrap items-center gap-1.5">
              <StatusBadge status={ticket.status} />
              <PriorityBadge urgency={ticket.urgency} />
              <span className="text-xs text-muted-foreground">
                Registrada {relativeTime(ticket.createdAt)} por {requester.name}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Detalle de la solicitud</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{ticket.description}</p>
              {(def?.fields.some((f) => ticket.fields[f.key]) || extraFields.length > 0) && (
                <>
                  <Separator />
                  <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                    {def?.fields
                      .filter((f) => ticket.fields[f.key])
                      .map((f) => (
                        <div key={f.key} className={f.wide ? "sm:col-span-2" : undefined}>
                          <dt className="text-xs text-muted-foreground">{f.label}</dt>
                          <dd className="text-sm font-medium break-words whitespace-pre-wrap">
                            {f.type === "url" && /^https?:\/\//.test(String(ticket.fields[f.key])) ? (
                              <a href={String(ticket.fields[f.key])} target="_blank" rel="noreferrer" className="text-[#d9342c] hover:underline">
                                {String(ticket.fields[f.key])}
                              </a>
                            ) : (
                              formatFieldValue(f, ticket.fields[f.key])
                            )}
                          </dd>
                        </div>
                      ))}
                    {extraFields.map(([k, v]) => (
                      <div key={k}>
                        <dt className="text-xs text-muted-foreground">{k.replace(/_/g, " ")}</dt>
                        <dd className="text-sm font-medium">{Array.isArray(v) ? v.join(", ") : v}</dd>
                      </div>
                    ))}
                  </dl>
                </>
              )}
              {firstFiles.length > 0 && (
                <>
                  <Separator />
                  <AttachmentList files={firstFiles} />
                </>
              )}
            </CardContent>
          </Card>

          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground">Seguimiento</h2>
            <TicketTimeline events={detail.events.slice(1)} attachments={detail.attachments} requesterId={ticket.requesterId} />
          </div>

          {isRequester && (ticket.status === "resuelto" || closed) && !ticket.rating && <RatingCard ticketId={ticket.id} />}

          <TicketComposer ticketId={ticket.id} canManage={canManage} isRequester={isRequester} status={ticket.status} />
        </div>

        <aside className="space-y-4">
          {canManage && (
            <ManagePanel
              ticketId={ticket.id}
              status={ticket.status}
              urgency={ticket.urgency}
              categorySlug={ticket.categorySlug}
              assigneeId={ticket.assigneeId}
              staff={staff.map((s) => ({ id: s.id, name: s.name }))}
            />
          )}
          {isRequester && !canManage && <RequesterPanel ticketId={ticket.id} status={ticket.status} />}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarClock className="size-4 text-[#d9342c]" />
                Tiempos de respuesta
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <p className="text-xs text-muted-foreground">
                Prioridad {URGENCY_META[ticket.urgency].label}: respuesta en {URGENCY_META[ticket.urgency].responseLabel}, solución en{" "}
                {URGENCY_META[ticket.urgency].slaLabel}.
              </p>
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">Primera respuesta</span>
                  <SlaBadge createdAt={ticket.createdAt} dueAt={ticket.responseDueAt} doneAt={ticket.firstResponseAt} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {ticket.firstResponseAt
                    ? `Respondida el ${formatDateTime(ticket.firstResponseAt)}`
                    : `Antes de ${formatDateTime(ticket.responseDueAt)} (${relativeTime(ticket.responseDueAt)})`}
                </p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">Solución</span>
                  <SlaBadge createdAt={ticket.createdAt} dueAt={ticket.dueAt} doneAt={ticket.resolvedAt} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {ticket.resolvedAt
                    ? `Resuelta el ${formatDateTime(ticket.resolvedAt)}`
                    : `Antes de ${formatDateTime(ticket.dueAt)} (${relativeTime(ticket.dueAt)})`}
                </p>
              </div>
              {ticket.rating && (
                <div className="rounded-lg bg-muted/60 p-3">
                  <p className="text-lg text-[#eb6834]">
                    {"★".repeat(ticket.rating)}
                    <span className="text-muted-foreground/40">{"★".repeat(5 - ticket.rating)}</span>
                  </p>
                  {ticket.ratingComment && <p className="mt-1 text-xs text-muted-foreground">“{ticket.ratingComment}”</p>}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Personas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-start gap-3">
                <UserAvatar fullName={requester.name} />
                <div className="min-w-0 space-y-0.5">
                  <p className="text-xs text-muted-foreground">Solicitante</p>
                  <p className="font-medium">{requester.name}</p>
                  <p className="flex items-center gap-1 truncate text-xs text-muted-foreground"><Mail className="size-3" />{requester.email}</p>
                  {requester.department && <p className="flex items-center gap-1 text-xs text-muted-foreground"><Building2 className="size-3" />{requester.department}</p>}
                  {requester.phone && <p className="flex items-center gap-1 text-xs text-muted-foreground"><Phone className="size-3" />{requester.phone}</p>}
                </div>
              </div>
              <div className="flex items-start gap-3">
                {assignee?.name ? <UserAvatar fullName={assignee.name} /> : <span className="flex size-8 items-center justify-center rounded-full bg-muted"><UserRound className="size-4 text-muted-foreground" /></span>}
                <div className="min-w-0 space-y-0.5">
                  <p className="text-xs text-muted-foreground">Asignada a</p>
                  <p className="font-medium">{assignee?.name ?? "Sin asignar"}</p>
                  {assignee?.email && <p className="flex items-center gap-1 truncate text-xs text-muted-foreground"><Mail className="size-3" />{assignee.email}</p>}
                  {responsible?.name && responsible.id !== assignee?.id && (
                    <p className="text-xs text-muted-foreground">Responsable del área: {responsible.name}</p>
                  )}
                </div>
              </div>
              {ticket.ccEmails && (
                <div className="space-y-1">
                  <p className="flex items-center gap-1 text-xs text-muted-foreground"><AtSign className="size-3" />En copia</p>
                  <p className="text-xs break-words">{ticket.ccEmails}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
