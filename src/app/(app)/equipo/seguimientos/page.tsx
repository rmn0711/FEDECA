import { requireUser } from "@/lib/auth";
import { getStaff } from "@/lib/tickets/queries";
import { listFollowups, projectOptions } from "@/lib/followups/service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { QuickCapture } from "@/components/followups/quick-capture";
import { FollowupList } from "@/components/followups/followup-list";

export const metadata = { title: "Seguimientos" };

export default async function FollowupsPage() {
  const user = await requireUser();
  const [items, staff, projects] = await Promise.all([listFollowups(user.id), getStaff(), projectOptions()]);
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Seguimientos</h1>
        <p className="text-sm text-muted-foreground">
          Anota lo que debes hacer o revisar. Te avisamos a la hora indicada en la plataforma, en el celular y por correo, o lo convertimos en una tarea asignada.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>¿Qué debes hacer o a qué hacerle seguimiento?</CardTitle>
          <CardDescription>Escríbelo como lo dirías: «Llamar a Claribel mañana en la tarde», «Revisar leads el viernes a las 10».</CardDescription>
        </CardHeader>
        <CardContent>
          <QuickCapture members={staff.filter((s) => s.id !== user.id).map((s) => ({ id: s.id, name: s.name }))} projects={projects} />
        </CardContent>
      </Card>
      <FollowupList items={items} />
    </div>
  );
}
