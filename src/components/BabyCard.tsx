"use client";
import { useEffect, useRef } from "react";
import { BabyFruit } from "./BabyFruit";
import { Card, cx, Eyebrow } from "./ui";
import { BABY_WEEKS, babyForWeek, MEASURE_NOTE } from "@/lib/nutrition/baby";
import { gestationalDays, trimesterOf } from "@/lib/nutrition/pregnancy";
import { daysBetween, longDate, num } from "@/lib/format";

/** Semana de gestación y tamaño del bebé comparado con una fruta o verdura. */
export function BabyCard({ dueDate, today, compact = false }: { dueDate: string; today: string; compact?: boolean }) {
  const days = gestationalDays(dueDate, today);
  const week = Math.min(42, Math.floor(days / 7));
  const extraDays = days % 7;
  const left = Math.max(0, daysBetween(today, dueDate));
  const baby = babyForWeek(week);
  const ref = useRef<HTMLLIElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [week]);

  return (
    <Card tone="plum" className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Eyebrow>Tu embarazo</Eyebrow>
          <p className="font-display text-3xl font-semibold leading-tight tabular">Semana {week}</p>
          <p className="text-sm text-ink/80 tabular">{week} semanas{extraDays ? ` y ${extraDays} ${extraDays === 1 ? "día" : "días"}` : ""} · trimestre {trimesterOf(week)}</p>
        </div>
        <div className="shrink-0 whitespace-nowrap text-right text-sm tabular">
          <p className="font-display text-xl font-semibold">{Math.floor(left / 7)} sem {left % 7} d</p>
          <p className="text-ink/70">para el parto</p>
        </div>
      </div>
      {baby ? (
        <div className="flex items-center gap-4 rounded-2xl bg-paper/70 p-3">
          <BabyFruit item={baby.key} className="h-24 w-28 shrink-0" />
          <div>
            <p className="font-display text-lg font-semibold leading-snug">Tu bebé es del tamaño de {baby.label}</p>
            <p className="text-sm text-ink/80 tabular">Mide cerca de {num(baby.cm, 1)} cm{baby.grams ? ` y pesa unos ${num(baby.grams)} g` : ""} ({MEASURE_NOTE(week)}).</p>
          </div>
        </div>
      ) : (
        <p className="rounded-2xl bg-paper/70 p-3 text-sm">En las primeras semanas el bebé es microscópico. Desde la semana 4 verás con qué se compara.</p>
      )}
      {!compact && (
        <>
          <ul className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" aria-label="Tamaño por semana">
            {BABY_WEEKS.filter((b) => b.week >= 8).map((b) => (
              <li key={b.week} ref={baby && b.week === baby.week ? ref : undefined} className={cx("w-20 shrink-0 rounded-2xl p-2 text-center", baby && b.week === baby.week ? "bg-brand text-brand-ink" : "bg-paper/70")}>
                <BabyFruit item={b.key} className="mx-auto h-12 w-14" />
                <p className="text-xs font-medium tabular">Sem. {b.week}</p>
                <p className="text-[10px] leading-tight opacity-80">{b.label.replace(/^(un|una) /, "")}</p>
              </li>
            ))}
          </ul>
          <p className="text-xs text-ink/70">Fecha probable de parto: {longDate(dueDate)}. Las medidas son promedios: cada bebé es distinto. Tu ginecólogo te dirá cómo va el tuyo.</p>
        </>
      )}
    </Card>
  );
}
