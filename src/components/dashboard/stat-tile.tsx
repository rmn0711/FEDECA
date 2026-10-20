import type { LucideIcon } from "lucide-react";

// Paleta de marca ACF (gris carbón + rojo + verde de marca), coherente
// con el informe comercial y la tarjeta de bienvenida.
const ACCENTS = {
  blue: { bg: "bg-[#222224]/[0.06]", fg: "text-[#222224]", ring: "ring-[#222224]/10" },
  orange: { bg: "bg-[#d9342c]/10", fg: "text-[#d9342c]", ring: "ring-[#d9342c]/15" },
  aqua: { bg: "bg-[#1a7f4e]/10", fg: "text-[#1a7f4e]", ring: "ring-[#1a7f4e]/15" },
  violet: { bg: "bg-[#6b6b6e]/10", fg: "text-[#6b6b6e]", ring: "ring-[#6b6b6e]/15" },
} as const;

// Tarjeta de KPI sin el borde/barra lateral genérico de antes: icono en
// chip suave arriba, valor grande como protagonista, todo dentro de un
// borde sutil — pensado para que se vea bien también en una captura de
// pantalla (informe comercial, reportes a gerencia).
export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  accent = "blue",
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  accent?: keyof typeof ACCENTS;
}) {
  const colors = ACCENTS[accent];

  return (
    <div className="rounded-2xl bg-card p-4 shadow-xs ring-1 ring-foreground/10 transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
        {Icon && (
          <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ring-1 ${colors.bg} ${colors.ring}`}>
            <Icon className={`size-4 ${colors.fg}`} strokeWidth={2} />
          </span>
        )}
      </div>
      <p className="mt-2 text-[1.85rem] leading-none font-bold tracking-tight tabular-nums">{value}</p>
      {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
