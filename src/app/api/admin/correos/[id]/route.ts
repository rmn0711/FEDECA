import { getCurrentUser } from "@/lib/auth";
import { getEmailHtml } from "@/lib/tickets/queries";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return new Response("No autorizado", { status: 401 });
  const html = await getEmailHtml(Number((await params).id));
  if (!html) return new Response("No encontrado", { status: 404 });
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // Vista previa aislada: sin scripts ni formularios.
      "Content-Security-Policy": "sandbox; default-src 'none'; img-src * data:; style-src 'unsafe-inline'",
    },
  });
}
