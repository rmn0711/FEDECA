import { getCurrentUser } from "@/lib/auth";
import { getAttachmentForUser } from "@/lib/tickets/queries";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("No autorizado", { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("No encontrado", { status: 404 });
  const file = await getAttachmentForUser(user, id);
  if (!file) return new Response("No encontrado", { status: 404 });

  // Solo imágenes y PDF se muestran en el navegador; el resto se descarga.
  const inline = /^(image\/(png|jpe?g|gif|webp)|application\/pdf)$/.test(file.mime);
  return new Response(Buffer.from(file.data), {
    headers: {
      "Content-Type": inline ? file.mime : "application/octet-stream",
      "Content-Length": String(file.size),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
