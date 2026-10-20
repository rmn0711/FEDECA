"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlarmClock, Clock, ExternalLink, MoreHorizontal, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { deleteFollowupAction, snoozeFollowupAction, toggleFollowupAction } from "@/lib/actions/followups";
import type { FollowupItem } from "@/lib/followups/service";
import { bogotaNow } from "@/lib/followups/parse";
import { ticketCode } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CheckCircle2 } from "lucide-react";

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function Section({ title, tone, items, children }: { title: string; tone?: string; items: number; children: React.ReactNode }) {
  if (items === 0) return null;
  return (
    <section className="space-y-2">
      <h2 className={cn("flex items-center gap-2 text-sm font-semibold", tone)}>
        {title}
        <span className="font-normal text-muted-foreground">{items}</span>
      </h2>
      <ul className="space-y-1.5">{children}</ul>
    </section>
  );
}

export function FollowupList({ items }: { items: FollowupItem[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const now = new Date();
  const today = bogotaNow(now).date;
  const pending = items.filter((f) => f.status === "pendiente");
  const dayOf = (d: Date) => bogotaNow(d).date;
  const overdue = pending.filter((f) => f.remindAt && f.remindAt < now && dayOf(f.remindAt) < today);
  const todayItems = pending.filter((f) => f.remindAt && dayOf(f.remindAt) === today);
  const upcoming = pending.filter((f) => f.remindAt && dayOf(f.remindAt) > today);
  const undated = pending.filter((f) => !f.remindAt);
  const done = items.filter((f) => f.status === "hecho").slice(0, 15);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, ok?: string) {
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error ?? "Error");
      if (ok) toast.success(ok);
      router.refresh();
    });
  }

  function snooze(id: number, kind: "1h" | "manana" | "lunes") {
    const b = bogotaNow(new Date(Date.now() + 3_600_000));
    if (kind === "1h") return run(() => snoozeFollowupAction(id, b.date, `${String(b.hour).padStart(2, "0")}:${String(b.minute).padStart(2, "0")}`), "Pospuesto 1 hora.");
    if (kind === "manana") return run(() => snoozeFollowupAction(id, addDays(today, 1), "09:00"), "Pospuesto para mañana 9:00 a. m.");
    const wd = bogotaNow().weekday;
    return run(() => snoozeFollowupAction(id, addDays(today, ((8 - wd) % 7) || 7), "09:00"), "Pospuesto para el lunes 9:00 a. m.");
  }

  const row = (f: FollowupItem, late = false) => (
    <li key={f.id} className={cn("group flex items-start gap-3 rounded-xl border bg-card px-3 py-2.5 transition-colors", late && "border-[#d9342c]/40 bg-[#d9342c]/[0.03]")}>
      <input
        type="checkbox"
        checked={f.status === "hecho"}
        onChange={() => run(() => toggleFollowupAction(f.id))}
        className="mt-1 size-4 shrink-0 accent-[#d9342c]"
        aria-label={`Marcar «${f.title}» como hecho`}
      />
      <div className="min-w-0 flex-1 space-y-1">
        <p className={cn("text-sm font-medium", f.status === "hecho" && "text-muted-foreground line-through")}>{f.title}</p>
        {f.notes && <p className="line-clamp-2 text-xs whitespace-pre-wrap text-muted-foreground">{f.notes}</p>}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {f.remindAt && (
            <span className={cn("flex items-center gap-1", late && "font-semibold text-[#d9342c]")}>
              {late ? <AlarmClock className="size-3" /> : <Clock className="size-3" />}
              {formatDateTime(f.remindAt)}
            </span>
          )}
          {f.personName && (
            <span className="flex items-center gap-1">
              <UserRound className="size-3" />
              {f.personName}
            </span>
          )}
          {f.ticketId && (
            <Link href={`/solicitudes/${f.ticketId}`} className="flex items-center gap-1 font-medium text-[#d9342c] hover:underline">
              {ticketCode(f.ticketId)} <ExternalLink className="size-3" />
            </Link>
          )}
          {f.taskId && f.taskProjectId && (
            <Link href={`/equipo/proyectos/${f.taskProjectId}?tarea=${f.taskId}`} className="flex items-center gap-1 font-medium text-[#d9342c] hover:underline">
              Tarea #{f.taskId}
              {f.taskStatus === "hecho" ? " ✅" : ""} <ExternalLink className="size-3" />
            </Link>
          )}
        </div>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button type="button" className="rounded-md p-1 text-muted-foreground hover:bg-accent" aria-label="Opciones">
              <MoreHorizontal className="size-4" />
            </button>
          }
        />
        <DropdownMenuContent align="end" className="w-52">
          {f.status === "pendiente" && (
            <>
              <DropdownMenuItem onClick={() => snooze(f.id, "1h")}>Posponer 1 hora</DropdownMenuItem>
              <DropdownMenuItem onClick={() => snooze(f.id, "manana")}>Mañana 9:00 a. m.</DropdownMenuItem>
              <DropdownMenuItem onClick={() => snooze(f.id, "lunes")}>Próximo lunes 9:00 a. m.</DropdownMenuItem>
            </>
          )}
          <DropdownMenuItem variant="destructive" onClick={() => confirm("¿Eliminar este seguimiento?") && run(() => deleteFollowupAction(f.id), "Eliminado.")}>
            <Trash2 className="size-4" />
            Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed">
        <EmptyState icon={CheckCircle2} title="No tienes seguimientos" description="Anota arriba lo que debes hacer o revisar y te avisaremos a tiempo." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Section title="Vencidos" tone="text-[#d9342c]" items={overdue.length}>
        {overdue.map((f) => row(f, true))}
      </Section>
      <Section title="Hoy" items={todayItems.length}>
        {todayItems.map((f) => row(f, Boolean(f.remindAt && f.remindAt < now)))}
      </Section>
      <Section title="Próximos" items={upcoming.length}>
        {upcoming.map((f) => row(f))}
      </Section>
      <Section title="Sin fecha" items={undated.length}>
        {undated.map((f) => row(f))}
      </Section>
      <Section title="Hechos recientemente" tone="text-muted-foreground" items={done.length}>
        {done.map((f) => row(f))}
      </Section>
    </div>
  );
}
