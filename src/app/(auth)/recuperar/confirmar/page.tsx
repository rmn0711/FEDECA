import { ConfirmResetForm } from "@/components/auth/reset-forms";

export const metadata = { title: "Nueva contraseña" };

export default async function ConfirmResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <ConfirmResetForm token={token ?? ""} />;
}
