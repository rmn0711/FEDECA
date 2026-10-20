import Link from "next/link";
import {
  AlarmClock,
  ArrowRight,
  CheckCircle2,
  Clock3,
  FolderOpen,
  Gauge,
  MessageSquareReply,
  Plus,
  Star,
  UserCheck,
} from "lucide-react";
import { requireUser, isStaff } from "@/lib/auth";
import { getCategoriesWithResponsible, getDashboard, listTickets } from "@/lib/tickets/queries";
import { CATEGORIES } from "@/lib/categories";
import { OPEN_STATUSES, STATUS_META, URGENCIES, URGENCY_META, ticketCode } from "@/lib/constants";
import { formatDuration, relativeTime } from "@/lib/format";
import { StatTile } from "@/components/dashboard/stat-tile";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CategoryIcon, PriorityBadge, SlaBadge, StatusBadge } from "@/components/tickets/badges";
import { EmptyState } from "@/components/ui/empty-state";
import { PushBanner } from "@/components/shared/push-toggle";

export const metadata = { title: "Inicio" };

function greeting() {
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Bogota", hour: "numeric", hour12: false }).format(new Date()));
  if (hour < 12) return "Buenos días";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

export default async function DashboardPage() {
  const user = await requireUser();
  const staff = isStaff(user);
  const [stats, categories, urgent] = await Promise.all([
    getDashboard(user),
    getCategoriesWithResponsible(),
    listTickets(user, { estado: "abiertas" }),
  ]);
  const fecha = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", weekday: "long", day: "numeric", month: "long" }).format(
    new Date()
  );
  const maxCat = Math.max(1, ...Array.from(stats.byCategory.values()).map((c) => c.open));
  const maxUrg = Math.max(1, ...Object.values(stats.byUrgency));

  return (
    <div className="space-y-6">
      <PushBanner />
      <Card className="relative overflow-hidden border-none bg-gradient-to-br from-[#242426] via-[#1b1b1d] to-[#141415] text-white shadow-lg">
        <div className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-[#d9342c] opacity-25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 size-64 rounded-full bg-white opacity-[0.04] blur-3xl" />
        <CardContent className="relative flex flex-col gap-5 p-6 sm:flex-row sm:items-end sm:justify-between sm:p-7">
          <div>
            <p className="text-sm font-medium tracking-wide text-white/50 first-letter:uppercase">{fecha}</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
              {greeting()}, <span className="text-[#ff5a4f]">{user.name.split(" ")[0]}</span>!
            </h1>
            <p className="mt-2 max-w-xl text-sm text-white/70">
              {staff
                ? stats.overdue + stats.responseOverdue > 0
                  ? `Hay ${stats.open} solicitud(es) abierta(s): ${stats.overdue} con la solución vencida y ${stats.responseOverdue} sin primera respuesta a tiempo.`
                  : `Tienes ${stats.open} solicitud(es) abierta(s). Todo está dentro de los tiempos de respuesta.`
                : stats.open > 0
                  ? `Tienes ${stats.open} solicitud(es) en curso. Te avisaremos por correo cada vez que haya una respuesta.`
                  : "¿Necesitas apoyo de Diseño, IA, Cotizador, Redes, Sistemas o Sinco Soft? Registra tu solicitud."}
            </p>
          </div>
          <Button
            className="bg-[#d9342c] text-white shadow-[0_6px_20px_rgba(217,52,44,0.45)] hover:bg-[#c42d26]"
            render={
              <Link href="/solicitudes/nueva">
                <Plus className="size-4" />
                Nueva solicitud
              </Link>
            }
          />
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Abiertas" value={String(stats.open)} hint={staff ? `${stats.mine} asignadas a ti` : "En curso"} icon={FolderOpen} accent="blue" />
        <StatTile
          label="Solución vencida"
          value={String(stats.overdue)}
          hint="Superaron el tiempo de solución"
          icon={AlarmClock}
          accent="orange"
        />
        <StatTile
          label="Sin primera respuesta a tiempo"
          value={String(stats.responseOverdue)}
          hint="Esperan respuesta y ya vencieron"
          icon={MessageSquareReply}
          accent="violet"
        />
        <StatTile
          label="Resueltas este mes"
          value={String(stats.resolvedMonth)}
          hint={`${stats.createdMonth} registradas este mes`}
          icon={CheckCircle2}
          accent="aqua"
        />
        <StatTile
          label="Cumplimiento de solución"
          value={stats.resolutionCompliance === null ? "—" : `${stats.resolutionCompliance}%`}
          hint="Resueltas dentro del tiempo (mes)"
          icon={Gauge}
          accent="aqua"
        />
        <StatTile
          label="Cumplimiento de respuesta"
          value={stats.responseCompliance === null ? "—" : `${stats.responseCompliance}%`}
          hint="Primera respuesta a tiempo (mes)"
          icon={UserCheck}
          accent="blue"
        />
        <StatTile
          label="Tiempo promedio de solución"
          value={stats.avgResolutionMs === null ? "—" : formatDuration(stats.avgResolutionMs)}
          hint="Tiempo calendario, este mes"
          icon={Clock3}
          accent="violet"
        />
        <StatTile
          label="Satisfacción"
          value={stats.satisfaction === null ? "—" : `${stats.satisfaction.toFixed(1).replace(".", ",")} / 5`}
          hint={`${stats.ratedCount} calificación(es), 90 días`}
          icon={Star}
          accent="orange"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Atención prioritaria</CardTitle>
              <CardDescription>Solicitudes abiertas ordenadas por prioridad y vencimiento.</CardDescription>
            </div>
            <Button variant="outline" size="sm" render={<Link href="/solicitudes">Ver todas<ArrowRight className="size-3.5" /></Link>} />
          </CardHeader>
          <CardContent className="space-y-2">
            {urgent.rows.length === 0 ? (
              <EmptyState icon={CheckCircle2} title="No hay solicitudes abiertas" description="Cuando registres o recibas una solicitud aparecerá aquí." />
            ) : (
              urgent.rows.slice(0, 7).map((t) => (
                <Link
                  key={t.id}
                  href={`/solicitudes/${t.id}`}
                  className="flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors hover:bg-accent"
                >
                  <CategoryIcon slug={t.categorySlug} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{t.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {ticketCode(t.id)} · {t.requesterName} · vence {relativeTime(t.dueAt)}
                    </p>
                  </div>
                  <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
                    <PriorityBadge urgency={t.urgency} />
                    <SlaBadge createdAt={t.createdAt} dueAt={t.dueAt} doneAt={t.resolvedAt} />
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Abiertas por prioridad</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {URGENCIES.map((u) => (
                <div key={u} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <PriorityBadge urgency={u} />
                    <span className="text-xs text-muted-foreground">
                      Respuesta {URGENCY_META[u].responseLabel} · solución {URGENCY_META[u].slaLabel}
                    </span>
                    <span className="font-semibold tabular-nums">{stats.byUrgency[u]}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className={`h-full rounded-full ${URGENCY_META[u].dot}`} style={{ width: `${(stats.byUrgency[u] / maxUrg) * 100}%` }} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Por estado</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {OPEN_STATUSES.map((s) => (
                <Link key={s} href={`/solicitudes?estado=${s}`} className="flex items-center gap-2 rounded-lg border px-3 py-2 hover:bg-accent">
                  <StatusBadge status={s} />
                  <span className="text-lg font-semibold tabular-nums">{stats.byStatus[s]}</span>
                </Link>
              ))}
              <p className="w-full text-xs text-muted-foreground">{STATUS_META.en_espera.description}: se pausa la gestión hasta recibir respuesta.</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Categorías</CardTitle>
          <CardDescription>Solicitudes abiertas por área y su responsable.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {CATEGORIES.map((def) => {
            const c = stats.byCategory.get(def.slug) ?? { open: 0, overdue: 0, month: 0 };
            const cat = categories.find((x) => x.slug === def.slug);
            return (
              <Link
                key={def.slug}
                href={`/solicitudes?categoria=${def.slug}`}
                className="space-y-2 rounded-xl border p-3 transition-colors hover:bg-accent"
              >
                <div className="flex items-center gap-3">
                  <CategoryIcon slug={def.slug} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{def.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{cat?.responsibleName ?? "Sin responsable asignado"}</p>
                  </div>
                  <span className="text-xl font-bold tabular-nums">{c.open}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-[#d9342c]" style={{ width: `${(c.open / maxCat) * 100}%` }} />
                </div>
                <div className="flex gap-2 text-xs text-muted-foreground">
                  {c.overdue > 0 && <Badge variant="destructive">{c.overdue} vencida(s)</Badge>}
                  <span>{c.month} este mes</span>
                </div>
              </Link>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
