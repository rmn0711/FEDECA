import { getCurrentUser, isStaff } from "@/lib/auth";
import { getReviewFile } from "@/lib/reviews/queries";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !isStaff(user)) return new Response("No autorizado", { status: 401 });
  const file = await getReviewFile(Number((await params).id));
  if (!file) return new Response("No encontrado", { status: 404 });
  return new Response(Buffer.from(file.data), {
    headers: {
      "Content-Type": file.mime,
      "Content-Length": String(file.size),
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=86400",
    },
  });
}
