import { requireUser } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/constants";
import { ProfileForms } from "@/components/profile/profile-forms";
import { PushSettings } from "@/components/shared/push-toggle";
import { WhatsappForm } from "@/components/profile/whatsapp-form";
import { isStaff } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Mi perfil" };

export default async function ProfilePage() {
  const user = await requireUser();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Mi perfil</h1>
        <p className="text-sm text-muted-foreground">
          {user.email} · {ROLE_LABELS[user.role]}
        </p>
      </div>
      <ProfileForms name={user.name} department={user.department ?? ""} phone={user.phone ?? ""} />
      <Card>
        <CardHeader>
          <CardTitle>Notificaciones en este dispositivo</CardTitle>
          <CardDescription>Recibe avisos en el celular o el computador aunque la plataforma esté cerrada.</CardDescription>
        </CardHeader>
        <CardContent>
          <PushSettings />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Alertas por WhatsApp</CardTitle>
          <CardDescription>Te llegan desde el WhatsApp de la Mesa de Ayuda. Puedes responder el mensaje y tu respuesta queda en la solicitud.</CardDescription>
        </CardHeader>
        <CardContent>
          <WhatsappForm phone={user.whatsappPhone ?? ""} optIn={user.whatsappOptIn} prefs={user.whatsappPrefs ?? {}} staff={isStaff(user)} />
        </CardContent>
      </Card>
    </div>
  );
}
