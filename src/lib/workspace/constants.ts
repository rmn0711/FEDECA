import type { BadgeVariant } from "@/lib/constants";

export const TASK_STATUSES = ["por_hacer", "en_curso", "en_revision", "hecho"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_META: Record<TaskStatus, { label: string; variant: BadgeVariant; dot: string }> = {
  por_hacer: { label: "Por hacer", variant: "neutral", dot: "bg-[#6b6b6e]" },
  en_curso: { label: "En curso", variant: "info", dot: "bg-[#2a78d6]" },
  en_revision: { label: "En revisión", variant: "warning", dot: "bg-[#eb6834]" },
  hecho: { label: "Hecho", variant: "success", dot: "bg-[#1baf7a]" },
};

export type ChecklistItem = { id: string; text: string; done: boolean };

/** Canales sugeridos para etiquetar tareas de marketing digital y generación de demanda. */
export const CHANNEL_TAGS = [
  "Instagram",
  "Facebook",
  "TikTok",
  "LinkedIn",
  "YouTube",
  "Meta Ads",
  "Google Ads",
  "SEO / Web",
  "Email marketing",
  "WhatsApp",
  "Landing page",
  "CRM",
  "Evento / feria",
  "Contenido",
  "Diseño",
  "Analítica",
];

export const PROJECT_COLORS = ["#d9342c", "#2a78d6", "#1a7f4e", "#eb6834", "#7c4dce", "#0f8a8a", "#222224", "#c2185b"];

export const PROJECT_ICONS = ["📣", "🎯", "📈", "🗓️", "🎨", "🤖", "🏗️", "💡", "🚀", "📁", "🧲", "📊"];
export const PAGE_ICONS = ["📄", "📝", "📌", "📚", "🧭", "🗓️", "🎯", "📣", "💡", "✅", "📊", "🧲", "🔗", "⭐"];

export function todayISO() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Bogota" }).format(new Date());
}

/** "2026-10-24" → "24 oct" (o con año si no es el actual). */
export function formatShortDate(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  const sameYear = iso.slice(0, 4) === todayISO().slice(0, 4);
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  }).format(d);
}

/** Estado de la fecha de entrega frente a hoy. */
export function dueState(iso: string | null, done: boolean): "vencida" | "hoy" | "pronto" | "normal" | null {
  if (!iso || done) return null;
  const today = todayISO();
  if (iso < today) return "vencida";
  if (iso === today) return "hoy";
  const diff = (new Date(`${iso}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) / 86_400_000;
  return diff <= 3 ? "pronto" : "normal";
}

export function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

/** Primer y último día visibles en la cuadrícula del mes (semanas de lunes a domingo). */
export function monthRange(month: string) {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const start = new Date(first);
  start.setUTCDate(1 - ((first.getUTCDay() + 6) % 7));
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 41);
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
}
