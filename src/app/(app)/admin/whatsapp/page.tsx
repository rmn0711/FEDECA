import { requireRole } from "@/lib/auth";
import { CheckCircle2, Inbox, MessageCircle, PlugZap, QrCode, Smartphone, Users, WifiOff } from "lucide-react";
import { getBridgeState } from "@/lib/whatsapp/send";
import { getWhatsappOverview } from "@/lib/whatsapp/queries";
import { appUrl } from "@/lib/constants";
import { formatDateTime, relativeTime } from "@/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/dashboard/stat-tile";
import { WhatsappOutbox } from "@/components/whatsapp/outbox";
import { BridgeAutoRefresh, TestWhatsappButton } from "@/components/whatsapp/bridge-status";

export const metadata = { title: "WhatsApp" };

const STATUS_LABEL: Record<string, string> = { enviado: "Enviado", enviado_manual: "Enviado a mano", recibido: "Recibido", descartado: "Descartado" };

export default async function WhatsappAdminPage() {
  // Además del layout: cada página valida el rol (las páginas y el layout se generan en paralelo).
  await requireRole("admin");
  const [bridge, o] = await Promise.all([getBridgeState(), getWhatsappOverview()]);
  const connected = bridge.state === "conectado";
  const tokenSet = Boolean(process.env.WHATSAPP_BRIDGE_TOKEN && process.env.WHATSAPP_BRIDGE_TOKEN.length >= 24);

  return (
    <div className="space-y-6">
      <BridgeAutoRefresh seconds={bridge.state === "qr" ? 5 : 30} />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">WhatsApp</h1>
        <p className="text-sm text-muted-foreground">
          Las alertas salen desde tu WhatsApp, sin API y sin costo: automáticamente con el servicio vinculado o a mano con el botón «Enviar por WhatsApp».
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Servicio vinculado" value={connected ? "Conectado" : bridge.state === "qr" ? "Esperando QR" : "Desconectado"} hint={bridge.seenAt ? `Última señal ${relativeTime(bridge.seenAt)}` : "Nunca se ha conectado"} icon={connected ? PlugZap : WifiOff} accent={connected ? "aqua" : "orange"} />
        <StatTile label="Por enviar" value={String(o.queue.length)} hint="Pendientes o con error" icon={Inbox} accent={o.queue.length ? "orange" : "blue"} />
        <StatTile label="Enviados (24 h)" value={String(o.sentToday)} hint={`${o.received} respuestas en 7 días`} icon={MessageCircle} accent="aqua" />
        <StatTile label="Personas con alertas" value={String(o.optedIn)} hint="Aceptaron recibir WhatsApp" icon={Users} accent="violet" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="size-4 text-[#25d366]" />
              Envío automático desde tu número
            </CardTitle>
            <CardDescription>Un servicio pequeño, vinculado a tu WhatsApp como WhatsApp Web, envía las alertas y te trae las respuestas.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {bridge.state === "qr" && bridge.qr ? (
              <div className="flex flex-col items-center gap-2 rounded-2xl border p-4 text-center">
                <QrCode className="size-5 text-muted-foreground" />
                <p className="font-medium">Escanéalo desde tu WhatsApp Business</p>
                <p className="text-xs text-muted-foreground">WhatsApp → Dispositivos vinculados → Vincular un dispositivo</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={bridge.qr} alt="Código QR para vincular WhatsApp" className="size-56 rounded-lg bg-white p-2" />
              </div>
            ) : connected ? (
              <div className="flex items-center gap-3 rounded-2xl border border-[#1baf7a]/40 bg-[#1baf7a]/[0.06] p-3">
                <CheckCircle2 className="size-5 text-[#1a7f4e]" />
                <div>
                  <p className="font-medium">Conectado{bridge.me ? ` como +${bridge.me}` : ""}</p>
                  <p className="text-xs text-muted-foreground">Las alertas salen solas. Última señal {bridge.seenAt ? relativeTime(bridge.seenAt) : ""}.</p>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-[#eb6834]/40 bg-[#eb6834]/[0.06] p-3">
                <p className="font-medium">El servicio no está conectado</p>
                <p className="text-xs text-muted-foreground">Mientras tanto, envía las alertas a mano desde la bandeja de la derecha.</p>
              </div>
            )}
            <ol className="list-decimal space-y-1.5 pl-5 text-muted-foreground">
              <li>
                En un PC de la oficina que permanezca encendido, instala Node.js 20 o superior y copia la carpeta <code className="rounded bg-muted px-1">whatsapp-bridge</code> del proyecto.
              </li>
              <li>
                Crea el archivo <code className="rounded bg-muted px-1">.env</code> con <code className="rounded bg-muted px-1">PLATFORM_URL={appUrl("")}</code> y el mismo{" "}
                <code className="rounded bg-muted px-1">WHATSAPP_BRIDGE_TOKEN</code> de la plataforma {tokenSet ? <Badge variant="success">configurado</Badge> : <Badge variant="warning">falta configurarlo</Badge>}.
              </li>
              <li>
                Ejecuta <code className="rounded bg-muted px-1">npm install</code> y <code className="rounded bg-muted px-1">npm start</code>. El código QR aparece aquí: escanéalo una sola vez.
              </li>
            </ol>
            <p className="rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
              ⚠️ Es una conexión no oficial (como WhatsApp Web). Para cuidar tu número, envía con pausas y límites, solo a quienes aceptaron alertas, y solo lee las respuestas a
              las alertas (no tus otros chats). WhatsApp puede suspender números que automatizan envíos masivos.
            </p>
            <TestWhatsappButton />
          </CardContent>
        </Card>

        <Card className="gap-0 pb-0">
          <CardHeader className="pb-3">
            <CardTitle>Bandeja de salida</CardTitle>
            <CardDescription>Alertas pendientes. Si el servicio está desconectado, envíalas con el botón: se abre tu WhatsApp con el mensaje listo.</CardDescription>
          </CardHeader>
          <CardContent className="max-h-[560px] overflow-y-auto border-t p-0">
            <WhatsappOutbox items={o.queue} />
          </CardContent>
        </Card>
      </div>

      <Card className="gap-0 pb-0">
        <CardHeader className="pb-3">
          <CardTitle>Historial</CardTitle>
          <CardDescription>Últimos mensajes enviados y respuestas recibidas.</CardDescription>
        </CardHeader>
        <CardContent className="border-t p-0">
          {o.recent.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Aún no hay mensajes.</p>
          ) : (
            <ul className="divide-y">
              {o.recent.map((m) => (
                <li key={m.id} className="flex gap-3 px-4 py-2.5 text-sm">
                  <span className="w-28 shrink-0 text-xs text-muted-foreground">{formatDateTime(m.statusAt ?? m.createdAt)}</span>
                  <Badge variant={m.direction === "in" ? "info" : m.status === "descartado" ? "neutral" : "success"} className="shrink-0">
                    {m.direction === "in" ? "← Recibido" : `→ ${STATUS_LABEL[m.status] ?? m.status}`}
                  </Badge>
                  <span className="shrink-0 font-medium">{m.userName ?? `+${m.phone}`}</span>
                  <span className="min-w-0 truncate text-muted-foreground">{m.body?.split("\n")[0]}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
