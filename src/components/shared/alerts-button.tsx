"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, CheckCircle2 } from "lucide-react";
import type { Alert, AlertCategory, AlertsResult } from "@/lib/alerts";
import { getAlertsAction } from "@/lib/actions/alerts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

// Mismo panel de alertas del cotizador, con las categorías de la mesa de ayuda.
const CATEGORY_LABEL: Record<AlertCategory, string> = {
  seguimientos: "Mis seguimientos",
  solicitudes: "Solicitudes por resolver",
  tareas: "Tareas del equipo",
  equipo: "Equipo (vista de líder)",
  chat: "Chat",
  mis_solicitudes: "Mis solicitudes",
};

const ORDEN_CATEGORIAS: AlertCategory[] = ["seguimientos", "solicitudes", "tareas", "equipo", "chat", "mis_solicitudes"];
const POLL_MS = 60_000;

export function AlertsButton({ initial, className }: { initial: AlertsResult; className?: string }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(initial);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") getAlertsAction().then(setData).catch(() => {});
    };
    const t = setInterval(refresh, POLL_MS);
    return () => clearInterval(t);
  }, []);

  // Al abrir el panel se refresca de inmediato.
  useEffect(() => {
    if (open) getAlertsAction().then(setData).catch(() => {});
  }, [open]);

  const porCategoria = ORDEN_CATEGORIAS.map((categoria) => ({
    categoria,
    alertas: data.alerts.filter((a) => a.category === categoria),
  })).filter((g) => g.alertas.length > 0);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button variant="outline" size="sm" className={cn("gap-1.5", className)}>
            <span className="relative inline-flex">
              <Bell className="size-4" />
              {data.overdue > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex size-1.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-destructive opacity-75 [animation-duration:2.5s]" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-destructive" />
                </span>
              )}
            </span>
            <span className="hidden sm:inline">Alertas</span>
            {data.total > 0 && <Badge variant={data.overdue > 0 ? "destructive" : "neutral"}>{data.total}</Badge>}
          </Button>
        }
      />
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Alertas</SheetTitle>
        </SheetHeader>
        <div className="space-y-5 overflow-y-auto px-4 pb-6">
          {data.alerts.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <CheckCircle2 className="size-8 text-muted-foreground" strokeWidth={1.5} />
              <p className="text-sm font-medium">Todo al día</p>
              <p className="text-sm text-muted-foreground">No hay solicitudes vencidas, tareas pendientes ni mensajes sin leer.</p>
            </div>
          ) : (
            porCategoria.map(({ categoria, alertas }) => (
              <div key={categoria} className="space-y-2">
                <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                  {CATEGORY_LABEL[categoria]} ({alertas.length})
                </p>
                {alertas.map((alerta) => (
                  <AlertRow key={alerta.id} alerta={alerta} onNavigate={() => setOpen(false)} />
                ))}
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function AlertRow({ alerta, onNavigate }: { alerta: Alert; onNavigate: () => void }) {
  return (
    <Link href={alerta.href} onClick={onNavigate} className="block rounded-md border p-2.5 transition-colors hover:bg-accent">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium">{alerta.title}</p>
        <Badge variant={alerta.severity === "overdue" ? "destructive" : alerta.severity === "today" ? "warning" : "info"}>
          {alerta.severity === "overdue" ? "Vencido" : alerta.severity === "today" ? "Hoy" : "Revisar"}
        </Badge>
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">{alerta.detail}</p>
    </Link>
  );
}
