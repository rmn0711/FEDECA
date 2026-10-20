import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/auth/register-form";
import { registrationEnabled } from "@/lib/actions/auth";

export const metadata = { title: "Crear cuenta" };
// Depende de ALLOWED_EMAIL_DOMAINS en tiempo de ejecución.
export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  if (!(await registrationEnabled())) redirect("/login");
  return <RegisterForm />;
}
