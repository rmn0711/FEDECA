import { CheckCircle2, Clock3, Gauge, Inbox, Star, UserCheck } from "lucide-react";
import { getMonthlyReport, shiftMonthStr } from "@/lib/reports";
import { formatDuration } from "@/lib/format";
import { ORG_NAME } from "@/lib/constants";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatTile } from "@/components/dashboard/stat-tile";
import { BarList } from "@/components/charts/chart-kit";
import { ReportActions } from "@/components/reports/report-actions";
import { ReportTrend } from "@/components/reports/trend-card";

export const metadata = { title: "Informes de gestión" };

const pct = (v: number | null) => (v === null ? "—" : `${v}%`);
const hours = (v: number | null) => (v === null ? "—" : formatDuration(v * 3_600_000));
const stars = (v: number | null) => (v === null ? "—" : `${v.toFixed(1).replace(".", ",")} ★`);

function complianceTone(v: number | null) {
  if (v === null) return "";
  return v >= 90 ? "text-[#0f8a5f]" : v >= 75 ? "text-[#b84f22]" : "text-[#d9342c]";
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { mes } = await searchParams;
  const current = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Bogota" }).format(new Date()).slice(0, 7);
  const month = mes && /^\d{4}-\d{2}$/.test(mes) && mes <= current ? mes : current;
  const r = await getMonthlyReport(month);
  const t = r.total;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{ORG_NAME} · Mesa de Ayuda</p>
          <h1 className="text-2xl font-semibold tracking-tight first-letter:uppercase">Informe de gestión · {r.label}</h1>
          <p className="text-sm text-muted-foreground">Solicitudes recibidas y resueltas en el mes, cumplimiento de tiempos, satisfacción y temas frecuentes.</p>
        </div>
        <ReportActions month={month} prev={shiftMonthStr(month, -1)} next={month < current ? shiftMonthStr(month, 1) : null} />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        <StatTile label="Recibidas" value={String(t.received)} hint={`${t.openNow} aún abiertas`} icon={Inbox} accent="blue" />
        <StatTile label="Resueltas" value={String(t.resolved)} hint="En el mes" icon={CheckCircle2} accent="aqua" />
        <StatTile label="Respuesta a tiempo" value={pct(t.responseCompliance)} hint="Primera respuesta" icon={UserCheck} accent="blue" />
        <StatTile label="Solución a tiempo" value={pct(t.resolutionCompliance)} hint="Dentro del ANS" icon={Gauge} accent="aqua" />
        <StatTile label="Tiempo promedio" value={hours(t.avgResolutionHours)} hint="Registro → solución" icon={Clock3} accent="violet" />
        <StatTile label="Satisfacción" value={stars(t.satisfaction)} hint={`${t.rated} calificación(es)`} icon={Star} accent="orange" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Tendencia de los últimos 6 meses</CardTitle>
            <CardDescription>Solicitudes recibidas vs. resueltas por mes.</CardDescription>
          </CardHeader>
          <CardContent>
            <ReportTrend data={r.trend} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Solicitudes por área solicitante</CardTitle>
            <CardDescription>Recibidas en el mes según el área de quien las registra.</CardDescription>
          </CardHeader>
          <CardContent>
            <BarList items={r.departments.map((d) => ({ label: d.label, value: d.count }))} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Por responsable</CardTitle>
          <CardDescription>Desempeño de cada persona del equipo en el mes (solicitudes del helpdesk y tareas del espacio de equipo).</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Responsable</TableHead>
                <TableHead className="text-right">Recibidas</TableHead>
                <TableHead className="text-right">Resueltas</TableHead>
                <TableHead className="text-right">Abiertas</TableHead>
                <TableHead className="text-right">Respuesta a tiempo</TableHead>
                <TableHead className="text-right">Solución a tiempo</TableHead>
                <TableHead className="text-right">Promedio</TableHead>
                <TableHead className="text-right">Satisfacción</TableHead>
                <TableHead className="pr-4 text-right">Tareas hechas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {r.people.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                    Sin actividad en el mes.
                  </TableCell>
                </TableRow>
              ) : (
                r.people.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="pl-4 font-medium">{p.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{p.received}</TableCell>
                    <TableCell className="text-right tabular-nums">{p.resolved}</TableCell>
                    <TableCell className="text-right tabular-nums">{p.openNow}</TableCell>
                    <TableCell className={`text-right font-semibold tabular-nums ${complianceTone(p.responseCompliance)}`}>{pct(p.responseCompliance)}</TableCell>
                    <TableCell className={`text-right font-semibold tabular-nums ${complianceTone(p.resolutionCompliance)}`}>{pct(p.resolutionCompliance)}</TableCell>
                    <TableCell className="text-right tabular-nums">{hours(p.avgResolutionHours)}</TableCell>
                    <TableCell className="text-right tabular-nums">{stars(p.satisfaction)}</TableCell>
                    <TableCell className="pr-4 text-right tabular-nums">{p.tasksDone}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Por categoría</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Categoría</TableHead>
                <TableHead className="text-right">Recibidas</TableHead>
                <TableHead className="text-right">Resueltas</TableHead>
                <TableHead className="text-right">Respuesta a tiempo</TableHead>
                <TableHead className="text-right">Solución a tiempo</TableHead>
                <TableHead className="text-right">Promedio</TableHead>
                <TableHead className="pr-4 text-right">Satisfacción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {r.categories.map((c) => (
                <TableRow key={c.slug}>
                  <TableCell className="pl-4 font-medium">{c.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.received}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.resolved}</TableCell>
                  <TableCell className={`text-right font-semibold tabular-nums ${complianceTone(c.responseCompliance)}`}>{pct(c.responseCompliance)}</TableCell>
                  <TableCell className={`text-right font-semibold tabular-nums ${complianceTone(c.resolutionCompliance)}`}>{pct(c.resolutionCompliance)}</TableCell>
                  <TableCell className="text-right tabular-nums">{hours(c.avgResolutionHours)}</TableCell>
                  <TableCell className="pr-4 text-right tabular-nums">{stars(c.satisfaction)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Temas más frecuentes</CardTitle>
            <CardDescription>Qué se pidió más en cada categoría: insumo para la base de conocimiento y para capacitaciones.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 sm:grid-cols-2">
            {r.themes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin solicitudes en el mes.</p>
            ) : (
              r.themes.map((th) => (
                <div key={th.slug} className="space-y-2">
                  <p className="text-sm font-semibold">{th.name}</p>
                  <BarList items={th.items.map((i) => ({ label: i.label, value: i.count }))} />
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Base de conocimiento</CardTitle>
            <CardDescription>Artículos que más evitaron solicitudes (acumulado).</CardDescription>
          </CardHeader>
          <CardContent>
            <BarList
              items={r.kb.map((a) => ({ label: a.title, value: a.deflections, hint: `${a.views} lecturas` }))}
              emptyText="Aún no hay artículos."
            />
          </CardContent>
        </Card>
      </div>
      <p className="text-xs text-muted-foreground">
        Los tiempos de respuesta y solución se miden en horas hábiles según la prioridad. El tiempo promedio es calendario, desde el registro hasta la solución.
      </p>
    </div>
  );
}
