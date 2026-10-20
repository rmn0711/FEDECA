import Link from "next/link";
import { Banknote, CalendarCheck2, Handshake, Magnet, Target, TrendingUp, UserCheck2, Wallet } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getMetricOptions, getMetrics, totals } from "@/lib/marketing/metrics";
import { cop, delta, num, pctStr } from "@/lib/marketing/format";
import { monthLabel, shiftMonthStr } from "@/lib/reports";
import { appUrl } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/dashboard/stat-tile";
import { BarList } from "@/components/charts/chart-kit";
import { LeadTrend } from "@/components/marketing/lead-trend";
import { MetricsEditor } from "@/components/marketing/metrics-editor";

export const metadata = { title: "Tablero de marketing" };

const PERIODS = [
  { v: "1", label: "Mes" },
  { v: "3", label: "3 meses" },
  { v: "6", label: "6 meses" },
  { v: "12", label: "12 meses" },
];

export default async function MarketingPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; proyecto?: string; vista?: string; mes?: string }>;
}) {
  await requireUser();
  const sp = await searchParams;
  const options = await getMetricOptions();
  const current = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Bogota" }).format(new Date()).slice(0, 7);
  const to = sp.mes && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : (options.lastMonth ?? current);
  const period = PERIODS.some((p) => p.v === sp.periodo) ? Number(sp.periodo) : 3;
  const from = shiftMonthStr(to, -(period - 1));
  const project = sp.proyecto && options.projects.includes(sp.proyecto) ? sp.proyecto : undefined;
  const editing = sp.vista === "datos";

  const [rows, prevRows, monthRows] = await Promise.all([
    getMetrics(from, to, project),
    getMetrics(shiftMonthStr(from, -period), shiftMonthStr(from, -1), project),
    editing ? getMetrics(to, to) : Promise.resolve([]),
  ]);
  const t = totals(rows);
  const p = totals(prevRows);

  const href = (patch: Record<string, string | undefined>) => {
    const params = new URLSearchParams(Object.entries({ periodo: String(period), proyecto: project, mes: to, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `/equipo/marketing?${params}`;
  };

  const byChannel = new Map<string, typeof rows>();
  const byProject = new Map<string, typeof rows>();
  for (const r of rows) {
    byChannel.set(r.channel, [...(byChannel.get(r.channel) ?? []), r]);
    byProject.set(r.project, [...(byProject.get(r.project) ?? []), r]);
  }
  const channels = Array.from(byChannel.entries()).map(([name, list]) => ({ name, ...totals(list) }));
  const projectsTable = Array.from(byProject.entries())
    .map(([name, list]) => ({ name, ...totals(list) }))
    .sort((a, b) => b.leads - a.leads);
  const months = Array.from({ length: period }, (_, i) => shiftMonthStr(from, i));
  const trend = months.map((m) => {
    const list = rows.filter((r) => r.month === m);
    return {
      label: new Intl.DateTimeFormat("es-CO", { month: "short", timeZone: "UTC" }).format(new Date(`${m}-01T00:00:00Z`)),
      leads: list.reduce((a, r) => a + r.leads, 0),
      calificados: list.reduce((a, r) => a + r.qualified, 0),
    };
  });
  const funnel = [
    { label: "Leads", value: t.leads },
    { label: "Leads calificados", value: t.qualified },
    { label: "Visitas a sala", value: t.visits },
    { label: "Cotizaciones", value: t.quotes },
    { label: "Separaciones", value: t.sales },
  ].map((s, i, arr) => ({ ...s, hint: i === 0 ? undefined : arr[i - 1].value ? `${pctStr(s.value / arr[i - 1].value, 0)} de la etapa anterior` : undefined }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tablero de marketing y demanda</h1>
          <p className="text-sm text-muted-foreground first-letter:uppercase">
            {period === 1 ? monthLabel(to) : `${monthLabel(from)} – ${monthLabel(to)}`}
            {project ? ` · ${project}` : " · todos los proyectos"}
          </p>
        </div>
        <div className="no-print flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border p-0.5">
            {PERIODS.map((x) => (
              <Link
                key={x.v}
                href={href({ periodo: x.v, vista: sp.vista })}
                className={cn("rounded-md px-3 py-1 text-sm", String(period) === x.v ? "bg-[#d9342c] text-white" : "hover:bg-accent")}
              >
                {x.label}
              </Link>
            ))}
          </div>
          <form action="/equipo/marketing" className="flex gap-2">
            <input type="hidden" name="periodo" value={period} />
            {sp.vista && <input type="hidden" name="vista" value={sp.vista} />}
            <input type="month" name="mes" defaultValue={to} className="h-8 rounded-lg border bg-transparent px-2 text-sm" aria-label="Mes final" />
            <select name="proyecto" defaultValue={project ?? ""} className="h-8 rounded-lg border bg-transparent px-2 text-sm" aria-label="Proyecto">
              <option value="">Todos los proyectos</option>
              {options.projects.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
            <Button type="submit" variant="outline" size="sm">
              Ver
            </Button>
          </form>
          <Button size="sm" variant={editing ? "outline" : "default"} render={<Link href={href({ vista: editing ? undefined : "datos" })}>{editing ? "Ver tablero" : "Cargar datos"}</Link>} />
        </div>
      </div>

      {editing ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Cargando datos de <strong className="first-letter:uppercase">{monthLabel(to)}</strong> (cambia el mes arriba).
          </p>
          <MetricsEditor month={to} initial={monthRows} projects={options.projects} channels={options.channels} />
          <Card>
            <CardHeader>
              <CardTitle>Carga automática desde el CRM o el cotizador</CardTitle>
              <CardDescription>Para que los datos lleguen solos, el CRM, el cotizador o un flujo de Power Automate pueden enviarlos por API.</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="overflow-x-auto rounded-xl bg-[#19191b] p-4 text-xs text-white">{`POST ${appUrl("/api/marketing/metricas")}
Authorization: Bearer MARKETING_API_KEY
Content-Type: application/json

[{ "mes": "${to}", "proyecto": "Torres del Parque", "canal": "Meta Ads",
   "inversion": 4500000, "leads": 120, "calificados": 48,
   "visitas": 20, "cotizaciones": 12, "separaciones": 3 }]`}</pre>
            </CardContent>
          </Card>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed">
          <EmptyState icon={TrendingUp} title="Aún no hay datos en este periodo" description="Carga las métricas del mes a mano, pegando desde Excel o por API." />
          <div className="pb-8 text-center">
            <Button render={<Link href={href({ vista: "datos" })}>Cargar datos</Link>} />
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile label="Inversión" value={cop(t.spend)} hint={delta(t.spend, p.spend) ?? "Pauta y medios"} icon={Wallet} accent="blue" />
            <StatTile label="Leads" value={num(t.leads)} hint={delta(t.leads, p.leads) ?? "Contactos generados"} icon={Magnet} accent="orange" />
            <StatTile label="Costo por lead (CPL)" value={cop(t.cpl)} hint={delta(t.cpl, p.cpl) ?? "Inversión / leads"} icon={Banknote} accent="violet" />
            <StatTile label="Leads calificados" value={pctStr(t.qualifiedRate)} hint={`${num(t.qualified)} calificados`} icon={UserCheck2} accent="aqua" />
            <StatTile label="Visitas a sala" value={num(t.visits)} hint={delta(t.visits, p.visits) ?? "Asistieron"} icon={CalendarCheck2} accent="blue" />
            <StatTile label="Separaciones" value={num(t.sales)} hint={delta(t.sales, p.sales) ?? "Ventas iniciadas"} icon={Handshake} accent="aqua" />
            <StatTile label="Costo por separación" value={cop(t.costPerSale)} hint="Inversión / separaciones" icon={Target} accent="violet" />
            <StatTile label="Conversión lead → separación" value={pctStr(t.leadToSale)} hint="Del total de leads" icon={TrendingUp} accent="orange" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Embudo de demanda</CardTitle>
                <CardDescription>Cada etapa con su conversión frente a la anterior.</CardDescription>
              </CardHeader>
              <CardContent>
                <BarList items={funnel} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Leads por mes</CardTitle>
                <CardDescription>Leads totales y calificados en el periodo.</CardDescription>
              </CardHeader>
              <CardContent>
                <LeadTrend data={trend} />
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Leads por canal</CardTitle>
                <CardDescription>Con su costo por lead.</CardDescription>
              </CardHeader>
              <CardContent>
                <BarList items={[...channels].sort((a, b) => b.leads - a.leads).map((c) => ({ label: c.name, value: c.leads, hint: c.cpl !== null ? `CPL ${cop(c.cpl)}` : undefined }))} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Separaciones por canal</CardTitle>
                <CardDescription>Con su costo por separación.</CardDescription>
              </CardHeader>
              <CardContent>
                <BarList
                  items={[...channels]
                    .filter((c) => c.sales > 0)
                    .sort((a, b) => b.sales - a.sales)
                    .map((c) => ({ label: c.name, value: c.sales, hint: c.costPerSale !== null ? `${cop(c.costPerSale)} c/u` : undefined }))}
                  emptyText="Sin separaciones en el periodo."
                />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Por proyecto</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Proyecto</TableHead>
                    <TableHead className="text-right">Inversión</TableHead>
                    <TableHead className="text-right">Leads</TableHead>
                    <TableHead className="text-right">CPL</TableHead>
                    <TableHead className="text-right">% calificados</TableHead>
                    <TableHead className="text-right">Visitas</TableHead>
                    <TableHead className="text-right">Cotizaciones</TableHead>
                    <TableHead className="text-right">Separaciones</TableHead>
                    <TableHead className="pr-4 text-right">Costo por separación</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projectsTable.map((r) => (
                    <TableRow key={r.name}>
                      <TableCell className="pl-4 font-medium">
                        <Link href={href({ proyecto: r.name })} className="hover:underline">
                          {r.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{cop(r.spend)}</TableCell>
                      <TableCell className="text-right tabular-nums">{num(r.leads)}</TableCell>
                      <TableCell className="text-right tabular-nums">{cop(r.cpl)}</TableCell>
                      <TableCell className="text-right tabular-nums">{pctStr(r.qualifiedRate, 0)}</TableCell>
                      <TableCell className="text-right tabular-nums">{num(r.visits)}</TableCell>
                      <TableCell className="text-right tabular-nums">{num(r.quotes)}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{num(r.sales)}</TableCell>
                      <TableCell className="pr-4 text-right tabular-nums">{cop(r.costPerSale)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
