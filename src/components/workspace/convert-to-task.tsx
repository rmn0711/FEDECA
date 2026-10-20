"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FolderKanban } from "lucide-react";
import { toast } from "sonner";
import { createTaskFromTicketAction } from "@/lib/actions/workspace";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/** En el detalle de una solicitud: la lleva al tablero del equipo como tarea. */
export function ConvertToTask({
  ticketId,
  projects,
  linked,
}: {
  ticketId: number;
  projects: Array<{ id: number; name: string; icon: string }>;
  linked: { id: number; projectId: number } | null;
}) {
  const router = useRouter();
  const [projectId, setProjectId] = useState(projects[0] ? String(projects[0].id) : "");
  const [pending, startTransition] = useTransition();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FolderKanban className="size-4 text-[#d9342c]" />
          Espacio de equipo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {linked ? (
          <>
            <p className="text-muted-foreground">Esta solicitud ya está en el tablero del equipo.</p>
            <Button variant="outline" className="w-full" render={<Link href={`/equipo/proyectos/${linked.projectId}?tarea=${linked.id}`}>Abrir tarea #{linked.id}</Link>} />
          </>
        ) : projects.length === 0 ? (
          <p className="text-muted-foreground">Crea un proyecto en el Espacio de equipo para convertir solicitudes en tareas.</p>
        ) : (
          <>
            <p className="text-muted-foreground">Llévala al tablero para planificarla con el equipo.</p>
            <Select value={projectId} onValueChange={(v) => setProjectId(String(v))}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.icon} {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              className="w-full"
              disabled={pending || !projectId}
              onClick={() =>
                startTransition(async () => {
                  const r = await createTaskFromTicketAction(ticketId, Number(projectId));
                  if (!r.ok) return void toast.error(r.error);
                  toast.success("Tarea creada en el tablero del equipo.");
                  router.refresh();
                })
              }
            >
              {pending ? "Creando..." : "Convertir en tarea"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
