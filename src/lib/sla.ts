import type { BadgeVariant } from "@/lib/constants";

export type SlaState = { label: string; variant: BadgeVariant; breached: boolean };

/** Estado de un compromiso (primera respuesta o solución) frente a su vencimiento. */
export function slaState(
  startedAt: Date,
  dueAt: Date,
  doneAt: Date | null,
  now = new Date()
): SlaState {
  if (doneAt) {
    return doneAt <= dueAt
      ? { label: "Cumplido", variant: "success", breached: false }
      : { label: "Fuera de tiempo", variant: "destructive", breached: true };
  }
  if (now > dueAt) return { label: "Vencido", variant: "destructive", breached: true };
  const total = dueAt.getTime() - startedAt.getTime();
  const left = dueAt.getTime() - now.getTime();
  if (total > 0 && left / total < 0.25) return { label: "Por vencer", variant: "warning", breached: false };
  return { label: "A tiempo", variant: "info", breached: false };
}
