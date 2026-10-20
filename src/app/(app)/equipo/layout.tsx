import { requireRole } from "@/lib/auth";

// El espacio de equipo es solo para el líder y los responsables (no para solicitantes).
export default async function TeamLayout({ children }: { children: React.ReactNode }) {
  await requireRole("admin", "agent");
  return children;
}
