import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { safeNextPath } from "@/lib/secure";
import { RequestLinkForm } from "@/components/auth/login-link-forms";

export const metadata = { title: "Registrar una solicitud" };

/** Enlace general para compartir: quien ya entró en este navegador va directo al formulario. */
export default async function PublicRequestPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (await getCurrentUser()) redirect(safeNextPath(next || "/solicitudes/nueva"));
  return <RequestLinkForm next={next} />;
}
