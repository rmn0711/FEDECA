"use client";

import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import type { TaskCard } from "@/lib/workspace/queries";
import { URGENCY_META } from "@/lib/constants";
import { monthRange, shiftMonth, todayISO } from "@/lib/workspace/constants";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export function TaskCalendar({
  month,
  onMonthChange,
  tasks,
  onOpen,
  onCreate,
  showProject,
}: {
  month: string;
  onMonthChange: (month: string) => void;
  tasks: TaskCard[];
  onOpen: (id: number) => void;
  onCreate?: (date: string) => void;
  showProject?: boolean;
}) {
  const { from } = monthRange(month);
  const today = todayISO();
  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(`${from}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
  const byDay = new Map<string, TaskCard[]>();
  for (const t of tasks) {
    if (!t.dueDate) continue;
    byDay.set(t.dueDate, [...(byDay.get(t.dueDate) ?? []), t]);
  }
  const label = new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));
  const withoutDate = tasks.filter((t) => !t.dueDate && t.status !== "hecho").length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon" aria-label="Mes anterior" onClick={() => onMonthChange(shiftMonth(month, -1))}>
          <ChevronLeft className="size-4" />
        </Button>
        <Button variant="outline" size="icon" aria-label="Mes siguiente" onClick={() => onMonthChange(shiftMonth(month, 1))}>
          <ChevronRight className="size-4" />
        </Button>
        <h2 className="text-lg font-semibold first-letter:uppercase">{label}</h2>
        <Button variant="ghost" size="sm" onClick={() => onMonthChange(today.slice(0, 7))}>
          Hoy
        </Button>
        {withoutDate > 0 && <span className="ml-auto text-xs text-muted-foreground">{withoutDate} tarea(s) sin fecha no aparecen aquí</span>}
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <div className="grid min-w-[760px] grid-cols-7">
          {WEEKDAYS.map((d) => (
            <div key={d} className="border-b bg-muted/40 px-2 py-1.5 text-xs font-semibold text-muted-foreground">
              {d}
            </div>
          ))}
          {days.map((day, i) => {
            const inMonth = day.slice(0, 7) === month;
            const list = byDay.get(day) ?? [];
            return (
              <div
                key={day}
                className={cn(
                  "group min-h-28 space-y-1 border-b p-1.5",
                  i % 7 !== 6 && "border-r",
                  !inMonth && "bg-muted/30",
                  i >= 35 && "border-b-0"
                )}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "flex size-6 items-center justify-center rounded-full text-xs",
                      day === today ? "bg-[#d9342c] font-semibold text-white" : inMonth ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {Number(day.slice(8))}
                  </span>
                  {onCreate && (
                    <button
                      type="button"
                      onClick={() => onCreate(day)}
                      className="flex size-5 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-accent"
                      aria-label={`Nueva tarea el ${day}`}
                    >
                      <Plus className="size-3.5" />
                    </button>
                  )}
                </div>
                {list.slice(0, 4).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onOpen(t.id)}
                    className={cn(
                      "flex w-full items-center gap-1.5 truncate rounded-md border-l-[3px] bg-muted/60 px-1.5 py-1 text-left text-[11px] font-medium transition-colors hover:bg-accent",
                      t.status === "hecho" && "text-muted-foreground line-through"
                    )}
                    style={{ borderLeftColor: showProject ? t.projectColor : undefined }}
                    title={`${t.title}${t.assigneeName ? ` · ${t.assigneeName}` : ""}`}
                  >
                    {!showProject && <span className={cn("size-1.5 shrink-0 rounded-full", URGENCY_META[t.priority].dot)} />}
                    <span className="truncate">{t.title}</span>
                  </button>
                ))}
                {list.length > 4 && <p className="px-1 text-[11px] text-muted-foreground">+{list.length - 4} más</p>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
