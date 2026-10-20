import { CalendarClock, Clock3, MessageSquareReply, Wrench } from "lucide-react";
import { BUSINESS_HOURS, STATUSES, STATUS_META, URGENCIES, URGENCY_META } from "@/lib/constants";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PriorityBadge, StatusBadge } from "@/components/tickets/badges";
import { cn } from "@/lib/utils";

export const metadata = { title: "Prioridades y tiempos de respuesta" };

const hour = (h: number) => `${h > 12 ? h - 12 : h}:00 ${h >= 12 ? "p. m." : "a. m."}`;

export default function SlaPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Prioridades y tiempos de respuesta</h1>
        <p className="text-sm text-muted-foreground">
          Acuerdos de nivel de servicio (ANS) de la mesa de ayuda. Aplican a todas las categorías: Diseño gráfico, IA, Cotizador,
          Redes sociales, Sistemas y Sinco Soft.
        </p>
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Prioridad</TableHead>
                <TableHead>Primera respuesta</TableHead>
                <TableHead>Solución</TableHead>
                <TableHead className="min-w-[260px]">Cuándo usarla</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {URGENCIES.map((u) => (
                <TableRow key={u}>
                  <TableCell>
                    <PriorityBadge urgency={u} />
                  </TableCell>
                  <TableCell className="font-medium">{URGENCY_META[u].responseLabel}</TableCell>
                  <TableCell className="font-medium">{URGENCY_META[u].slaLabel}</TableCell>
                  <TableCell className="whitespace-normal text-muted-foreground">{URGENCY_META[u].definition}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {URGENCIES.map((u) => {
          const m = URGENCY_META[u];
          return (
            <Card key={u} className={cn(u === "alta" && "ring-[#d9342c]/30")}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className={cn("size-2.5 rounded-full", m.dot)} />
                  Prioridad {m.label}
                </CardTitle>
                <CardDescription>{m.definition}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-muted/60 p-2.5">
                    <MessageSquareReply className="mb-1 size-4 text-[#d9342c]" />
                    <p className="text-xs text-muted-foreground">Respuesta</p>
                    <p className="font-semibold">{m.responseLabel}</p>
                  </div>
                  <div className="rounded-lg bg-muted/60 p-2.5">
                    <Wrench className="mb-1 size-4 text-[#d9342c]" />
                    <p className="text-xs text-muted-foreground">Solución</p>
                    <p className="font-semibold">{m.slaLabel}</p>
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold text-muted-foreground uppercase">Ejemplos</p>
                  <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
                    {m.examples.map((ex) => (
                      <li key={ex}>{ex}</li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="size-4 text-[#d9342c]" />
              ¿Cómo se cuentan los tiempos?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              En <strong className="text-foreground">horas hábiles</strong>: lunes a viernes de {hour(BUSINESS_HOURS.startHour)} a{" "}
              {hour(BUSINESS_HOURS.endHour)} (hora de Colombia). Fuera de ese horario el reloj se detiene.
            </p>
            <p>
              <strong className="text-foreground">Primera respuesta:</strong> el responsable confirma que recibió la solicitud y cuál es el
              siguiente paso.
            </p>
            <p>
              <strong className="text-foreground">Solución:</strong> la solicitud queda resuelta o entregada. Si el responsable necesita
              información tuya, la pondrá <em>En espera</em>.
            </p>
            <p>Si la prioridad se ajusta, los tiempos se recalculan desde la fecha de registro.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock3 className="size-4 text-[#d9342c]" />
              Estados de una solicitud
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {STATUSES.map((s) => (
              <div key={s} className="flex items-start gap-3 text-sm">
                <span className="w-24 shrink-0">
                  <StatusBadge status={s} />
                </span>
                <span className="text-muted-foreground">{STATUS_META[s].description}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
