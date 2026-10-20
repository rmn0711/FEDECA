import Link from "next/link";
import { FileSearch, Plus } from "lucide-react";
import { requireUser, isStaff } from "@/lib/auth";
import { getStaff, listTickets, type TicketFilters } from "@/lib/tickets/queries";
import { ticketCode } from "@/lib/constants";
import { formatDateTime, relativeTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CategoryIcon, PriorityBadge, SlaBadge, StatusBadge } from "@/components/tickets/badges";
import { TicketFiltersBar } from "@/components/tickets/ticket-filters";

export const metadata = { title: "Solicitudes" };

export default async function TicketsPage({ searchParams }: { searchParams: Promise<TicketFilters> }) {
  const user = await requireUser();
  const staff = isStaff(user);
  const filters = await searchParams;
  const [{ rows, total, page, pages }, staffList] = await Promise.all([
    listTickets(user, filters),
    staff ? getStaff() : Promise.resolve([]),
  ]);

  const pageHref = (p: number) => {
    const params = new URLSearchParams(Object.entries(filters).filter(([, v]) => v) as [string, string][]);
    params.set("pagina", String(p));
    return `/solicitudes?${params.toString()}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{staff ? "Solicitudes" : "Mis solicitudes"}</h1>
          <p className="text-sm text-muted-foreground">
            {staff
              ? "Bandeja de la mesa de ayuda con prioridad, estado y cumplimiento de tiempos."
              : "Historial de tus solicitudes y su estado. Haz clic en una para ver el seguimiento."}
          </p>
        </div>
        <Button render={<Link href="/solicitudes/nueva"><Plus className="size-4" />Nueva solicitud</Link>} />
      </div>

      <TicketFiltersBar staff={staff} isAdmin={user.role === "admin"} staffList={staffList} />

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Solicitud</TableHead>
              <TableHead className="hidden md:table-cell">Solicitante</TableHead>
              <TableHead className="hidden lg:table-cell">Responsable</TableHead>
              <TableHead>Prioridad</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="hidden md:table-cell">Tiempo de solución</TableHead>
              <TableHead className="hidden xl:table-cell">Actualizada</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="p-0">
                  <EmptyState icon={FileSearch} title="No hay solicitudes que coincidan" description="Prueba ajustando los filtros de búsqueda." />
                </TableCell>
              </TableRow>
            ) : (
              rows.map((t) => (
                <TableRow key={t.id} className="relative">
                  <TableCell className="max-w-[340px]">
                    <Link href={`/solicitudes/${t.id}`} className="flex items-center gap-3 after:absolute after:inset-0">
                      <CategoryIcon slug={t.categorySlug} />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{t.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {ticketCode(t.id)} · {t.categoryName} · {formatDateTime(t.createdAt)}
                        </span>
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{t.requesterName}</TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {t.assigneeName ?? <span className="text-muted-foreground">Sin asignar</span>}
                  </TableCell>
                  <TableCell>
                    <PriorityBadge urgency={t.urgency} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={t.status} />
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="flex flex-col items-start gap-0.5">
                      <SlaBadge createdAt={t.createdAt} dueAt={t.dueAt} doneAt={t.resolvedAt} />
                      {!t.resolvedAt && <span className="text-xs text-muted-foreground">vence {relativeTime(t.dueAt)}</span>}
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground xl:table-cell">{relativeTime(t.updatedAt)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {total} solicitud(es) · página {page} de {pages}
        </span>
        <div className="flex gap-2">
          {page > 1 ? (
            <Button variant="outline" size="sm" render={<Link href={pageHref(page - 1)}>Anterior</Link>} />
          ) : (
            <Button variant="outline" size="sm" disabled>
              Anterior
            </Button>
          )}
          {page < pages ? (
            <Button variant="outline" size="sm" render={<Link href={pageHref(page + 1)}>Siguiente</Link>} />
          ) : (
            <Button variant="outline" size="sm" disabled>
              Siguiente
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
