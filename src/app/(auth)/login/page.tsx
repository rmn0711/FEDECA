import { LoginForm } from "@/components/auth/login-form";
import { registrationEnabled } from "@/lib/actions/auth";

export const metadata = { title: "Iniciar sesión" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const params = await searchParams;
  return <LoginForm next={params.next} canRegister={await registrationEnabled()} />;
}
