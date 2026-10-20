import Link from "next/link";
import { findLoginLink } from "@/lib/auth/login-link";
import { EnterWithLinkForm } from "@/components/auth/login-link-forms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Entrar" };

export default async function EnterWithLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const link = await findLoginLink(token);
  if (!link || (link.user && !link.user.active)) {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Enlace vencido</CardTitle>
          <CardDescription>Este enlace ya se usó o venció (duran 30 minutos y sirven una sola vez).</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/solicitar" className="text-sm font-medium text-[#d9342c] hover:underline">
            Pedir un enlace nuevo
          </Link>
        </CardContent>
      </Card>
    );
  }
  return <EnterWithLinkForm token={token} email={link.email} name={link.user?.name ?? null} />;
}
