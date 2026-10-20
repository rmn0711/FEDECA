import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

// Componente compartido de "sin resultados" — antes cada tabla/lista tenía
// su propio texto suelto sin ícono, con formato levemente distinto en cada
// pantalla. Se usa dentro de una celda de tabla (colSpan) o directamente en
// un contenedor de lista/card.
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
      <div className="flex size-10 items-center justify-center rounded-full bg-muted">
        <Icon className="size-5 text-muted-foreground" strokeWidth={1.75} />
      </div>
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && (
        <Button variant="outline" size="sm" className="mt-2" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
