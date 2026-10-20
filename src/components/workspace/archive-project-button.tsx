"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore } from "lucide-react";
import { toast } from "sonner";
import { archiveProjectAction } from "@/lib/actions/workspace";
import { Button } from "@/components/ui/button";

export function ArchiveProjectButton({ id, archived }: { id: number; archived: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (!archived && !confirm("¿Archivar este proyecto? Dejará de aparecer en el espacio de equipo (no se borra nada).")) return;
        startTransition(async () => {
          const r = await archiveProjectAction(id, !archived);
          if (!r.ok) return void toast.error(r.error);
          toast.success(archived ? "Proyecto restaurado." : "Proyecto archivado.");
          router.push(archived ? `/equipo/proyectos/${id}` : "/equipo");
          router.refresh();
        });
      }}
    >
      {archived ? <ArchiveRestore className="size-3.5" /> : <Archive className="size-3.5" />}
      {archived ? "Restaurar" : "Archivar"}
    </Button>
  );
}
