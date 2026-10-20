import { Calculator, Database, Megaphone, Monitor, Palette, Sparkles, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { STATUS_META, URGENCY_META, type Status, type Urgency } from "@/lib/constants";
import { getCategory, type CategoryDef } from "@/lib/categories";
import { slaState } from "@/lib/sla";
import { cn } from "@/lib/utils";

export const CATEGORY_ICONS: Record<CategoryDef["icon"], LucideIcon> = {
  palette: Palette,
  sparkles: Sparkles,
  calculator: Calculator,
  megaphone: Megaphone,
  monitor: Monitor,
  database: Database,
};

export function StatusBadge({ status }: { status: Status }) {
  return <Badge variant={STATUS_META[status].variant}>{STATUS_META[status].label}</Badge>;
}

export function PriorityBadge({ urgency }: { urgency: Urgency }) {
  const meta = URGENCY_META[urgency];
  return (
    <Badge variant={meta.variant}>
      <span className={cn("size-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </Badge>
  );
}

export function CategoryIcon({ slug, className }: { slug: string; className?: string }) {
  const def = getCategory(slug);
  const Icon = def ? CATEGORY_ICONS[def.icon] : Monitor;
  return (
    <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg ring-1", def?.accent, className)}>
      <Icon className="size-4" />
    </span>
  );
}

export function SlaBadge({
  createdAt,
  dueAt,
  doneAt,
  prefix,
}: {
  createdAt: Date;
  dueAt: Date;
  doneAt: Date | null;
  prefix?: string;
}) {
  const s = slaState(createdAt, dueAt, doneAt);
  return (
    <Badge variant={s.variant}>
      {prefix ? `${prefix}: ` : ""}
      {s.label}
    </Badge>
  );
}
