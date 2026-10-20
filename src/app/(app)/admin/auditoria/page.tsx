import { requireRole } from "@/lib/auth";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { getAuditLog, type AuditFilters } from "@/lib/audit-queries";
import { getUsersList } from "@/lib/tickets/queries";
import { formatDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const metadata = { title: "Auditoría" };

const ENTITIES: Record<string, string> = {
  sesion: "Ingresos",
  usuario: "Usuarios",
  categoria: "Categorías",
  configuracion: "Configuración",
  solicitud: "Solicitudes",
  proyecto: "Proyectos",
  tarea: "Tareas",
  pagina: "Páginas",
  canal: "Canales",
  articulo: "Base de conocimiento",
  plantilla: "Plantillas",
  aprobacion: "Aprobaciones",
  metricas: "Métricas",
};

const DANGER = new Set(["ingreso_fallido", "ingreso_bloqueado", "eliminar", "quitar_miembros"]);

export default async function AuditPage({ searchParams }: { searchParams: Promise<AuditFilters> }) {
  // Además del layout: cada página valida el rol (las páginas y el layout se generan en paralelo).
  await requireRole("admin");
  const f = await searchParams;
  const [{ rows, total, page, pages }, people] = await Promise.all([getAuditLog(f), getUsersList()]);
  const href = (p: number) => {
    const params = new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][]);
    params.set("pagina", String(p));
    return `/admin/auditoria?${params}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Auditoría</h1>
        <p className="text-sm text-muted-foreground">
          Quién cambió qué y cuándo: ingresos, usuarios y permisos, categorías, configuración, proyectos, canales y más.
        </p>
      </div>

      <Card>
        <CardContent>
          <form className="flex flex-wrap items-end gap-3" action="/admin/auditoria">
            <Input name="q" defaultValue={f.q} placeholder="Buscar en la descripción…" className="w-full sm:w-64" />
            <select name="entidad" defaultValue={f.entidad ?? ""} className="h-8 rounded-lg border bg-transparent px-2 text-sm">
              <option value="">Todo tipo de cambio</option>
              {Object.entries(ENTITIES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <select name="usuario" defaultValue={f.usuario ?? ""} className="h-8 rounded-lg border bg-transparent px-2 text-sm">
              <option value="">Todas las personas</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <label className="text-xs text-muted-foreground">
              Desde
              <Input type="date" name="desde" defaultValue={f.desde} className="w-40" />
            </label>
            <label className="text-xs text-muted-foreground">
              Hasta
              <Input type="date" name="hasta" defaultValue={f.hasta} className="w-40" />
            </label>
            <Button type="submit">Filtrar</Button>
            <Button variant="ghost" render={<Link href="/admin/auditoria">Limpiar</Link>} />
          </form>
        </CardContent>
      </Card>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Persona</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Qué pasó</TableHead>
              <TableHead className="hidden lg:table-cell">IP</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="p-0">
                  <EmptyState icon={ShieldCheck} title="Sin registros" description="Aún no hay cambios que coincidan con el filtro." />
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(r.createdAt)}</TableCell>
                  <TableCell>{r.actorName ?? <span className="text-muted-foreground">Sistema / desconocido</span>}</TableCell>
                  <TableCell>
                    <Badge variant={DANGER.has(r.action) ? "destructive" : "neutral"}>{ENTITIES[r.entity] ?? r.entity}</Badge>
                  </TableCell>
                  <TableCell className="max-w-[520px] whitespace-normal">{r.summary}</TableCell>
                  <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">{r.ip ?? "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {total} registro(s) · página {page} de {pages}
        </span>
        <div className="flex gap-2">
          {page > 1 && <Button variant="outline" size="sm" render={<Link href={href(page - 1)}>Anterior</Link>} />}
          {page < pages && <Button variant="outline" size="sm" render={<Link href={href(page + 1)}>Siguiente</Link>} />}
        </div>
      </div>
    </div>
  );
}
