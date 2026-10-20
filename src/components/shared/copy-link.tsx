"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/** Muestra un enlace con un botón para copiarlo. */
export function CopyLink({ url }: { url: string }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <code className="min-w-0 flex-1 truncate rounded-lg bg-muted px-3 py-2 text-sm">{url}</code>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          navigator.clipboard.writeText(url).then(
            () => toast.success("Enlace copiado."),
            () => toast.error("No se pudo copiar. Selecciónalo y cópialo a mano.")
          )
        }
      >
        <Copy className="size-4" />
        Copiar enlace
      </Button>
    </div>
  );
}
