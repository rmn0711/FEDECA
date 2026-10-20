import { getSetting } from "@/lib/tickets/queries";
import { getNotifyEmails } from "@/lib/tickets/notifications";
import { smtpConfigured } from "@/lib/email/send";
import { appUrl } from "@/lib/constants";
import { SettingsForm } from "@/components/admin/settings-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Notificaciones" };

export default async function SettingsPage() {
  const [notify, effective] = await Promise.all([getSetting("notify_emails"), getNotifyEmails()]);
  const inbound = Boolean(process.env.INBOUND_EMAIL_SECRET);
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Notificaciones</h1>
        <p className="text-sm text-muted-foreground">Quién recibe los correos de la mesa de ayuda y cómo se reciben respuestas por correo.</p>
      </div>
      <SettingsForm notifyEmails={notify ?? ""} effective={effective} />
      <Card>
        <CardHeader>
          <CardTitle>¿Quién recibe cada correo?</CardTitle>
          <CardDescription>Todos los correos incluyen el código [HD-xxxxx] en el asunto y un botón para abrir la solicitud.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {[
            ["Nueva solicitud", "Para: mesa de ayuda · CC: responsable de la categoría, solicitante y copias"],
            ["Respuesta del equipo", "Para: solicitante · CC: responsable, mesa de ayuda y copias"],
            ["Respuesta del solicitante", "Para: responsable asignado · CC: solicitante, mesa de ayuda y copias"],
            ["Cambio de estado / resuelta", "Para: solicitante · CC: responsable, mesa de ayuda y copias"],
            ["Asignación", "Para: nuevo responsable · CC: solicitante y mesa de ayuda"],
            ["Nota interna", "Para: responsable · CC: mesa de ayuda (nunca al solicitante)"],
            ["Calificación", "Para: responsable · CC: mesa de ayuda"],
          ].map(([k, v]) => (
            <div key={k} className="flex flex-col gap-0.5 rounded-lg border px-3 py-2 sm:flex-row sm:gap-4">
              <span className="w-56 shrink-0 font-medium">{k}</span>
              <span className="text-muted-foreground">{v}</span>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Integración de correo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span>Envío (SMTP Microsoft 365)</span>
            <Badge variant={smtpConfigured() ? "success" : "warning"}>{smtpConfigured() ? "Configurado" : "Sin configurar"}</Badge>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span>Respuestas por correo (webhook de entrada)</span>
            <Badge variant={inbound ? "success" : "neutral"}>{inbound ? "Activo" : "Inactivo"}</Badge>
          </div>
          <p className="text-muted-foreground">
            Para que las respuestas a los correos queden en la plataforma, un flujo de Power Automate (o el proveedor de correo) debe enviar
            cada correo recibido a <code className="rounded bg-muted px-1 py-0.5 text-xs">{appUrl("/api/inbound-email?secret=…")}</code>. Ver
            README.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
