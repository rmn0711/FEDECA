"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { discardWhatsappAction, markManualSentAction, retryWhatsappAction } from "@/lib/actions/whatsapp";
import { ticketCode } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { CheckCircle2 } from "lucide-react";

type Item = {
  id: number;
  phone: string;
  body: string | null;
  status: string;
  error: string | null;
  ticketId: number | null;
  createdAt: Date;
  userName: string | null;
};

const STATUS: Record<string, { label: string; variant: "warning" | "info" | "destructive" }> = {
  pendiente: { label: "Pendiente", variant: "warning" },
  enviando: { label: "Enviando…", variant: "info" },
  fallido: { label: "Falló", variant: "destructive" },
};

/** Bandeja: alertas por enviar. El botón abre tu WhatsApp con el mensaje listo (respaldo manual). */
export function WhatsappOutbox({ items }: { items: Item[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  if (items.length === 0) {
    return <EmptyState icon={CheckCircle2} title="No hay alertas por enviar" description="Todo lo pendiente ya salió por WhatsApp." />;
  }
  return (
    <ul className="divide-y">
      {items.map((m) => (
        <li key={m.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start">
          <div className="min-w-0 flex-1 space-y-1">
            <p className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold">{m.userName ?? `+${m.phone}`}</span>
              <span className="text-xs text-muted-foreground">+{m.phone}</span>
              <Badge variant={STATUS[m.status]?.variant ?? "info"}>{STATUS[m.status]?.label ?? m.status}</Badge>
              {m.ticketId && (
                <Link href={`/solicitudes/${m.ticketId}`} className="text-xs font-medium text-[#d9342c] hover:underline">
                  {ticketCode(m.ticketId)}
                </Link>
              )}
              <span className="text-xs text-muted-foreground">{formatDateTime(m.createdAt)}</span>
            </p>
            <p className="line-clamp-3 text-sm whitespace-pre-wrap text-muted-foreground">{m.body}</p>
            {m.error && <p className="text-xs text-destructive">{m.error}</p>}
          </div>
          <div className="flex shrink-0 gap-1">
            <Button
              size="sm"
              className="bg-[#25d366] text-white hover:bg-[#1ebe5a]"
              onClick={() => {
                window.open(`https://wa.me/${m.phone}?text=${encodeURIComponent(m.body ?? "")}`, "_blank", "noopener");
                startTransition(async () => {
                  await markManualSentAction(m.id);
                  toast.success("Marcado como enviado.");
                  router.refresh();
                });
              }}
            >
              <MessageCircle className="size-4" />
              Enviar por WhatsApp
            </Button>
            {m.status === "fallido" && (
              <Button variant="outline" size="icon-sm" aria-label="Reintentar automático" title="Reintentar automático" onClick={() => startTransition(async () => { await retryWhatsappAction(m.id); router.refresh(); })}>
                <RotateCcw className="size-4" />
              </Button>
            )}
            <Button variant="ghost" size="icon-sm" aria-label="Descartar" title="Descartar" onClick={() => startTransition(async () => { await discardWhatsappAction(m.id); router.refresh(); })}>
              <X className="size-4" />
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
