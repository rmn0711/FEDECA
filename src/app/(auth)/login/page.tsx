import { cookies } from "next/headers";
import { LoginForm } from "@/components/auth/login-form";
import { AccessForm } from "@/components/auth/access-form";
import { registrationEnabled } from "@/lib/actions/auth";
import { REMEMBER_COOKIE, findByAccessToken } from "@/lib/auth/access";

export const metadata = { title: "Iniciar sesión" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const params = await searchParams;
  // Si este navegador ya entró con un enlace personal, solo se pide la contraseña.
  const remembered = (await cookies()).get(REMEMBER_COOKIE)?.value;
  const user = remembered ? await findByAccessToken(remembered) : null;
  if (user?.active && remembered) {
    return <AccessForm token={remembered} name={user.name} email={user.email} needsPassword={!user.passwordHash} next={params.next} remembered />;
  }
  return <LoginForm next={params.next} canRegister={await registrationEnabled()} />;
}
