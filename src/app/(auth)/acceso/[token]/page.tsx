import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { findByAccessToken } from "@/lib/auth/access";
import { AccessForm } from "@/components/auth/access-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Acceso" };

export default async function AccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { token } = await params;
  const { next } = await searchParams;
  const user = await findByAccessToken(token);
  if (!user || !user.active) {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Enlace no válido</CardTitle>
          <CardDescription>Este enlace de acceso ya no funciona. Pide uno nuevo al administrador de la mesa de ayuda.</CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    );
  }
  const current = await getCurrentUser();
  if (current?.id === user.id) redirect(next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
  return <AccessForm token={token} name={user.name} email={user.email} needsPassword={!user.passwordHash} next={next} />;
}
