import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { canDecide, getReviewDetail } from "@/lib/reviews/queries";
import { ReviewViewer } from "@/components/workspace/review-viewer";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const r = await getReviewDetail(Number((await params).id));
  return { title: r ? `Aprobación v${r.version} · ${r.taskTitle}` : "Aprobación" };
}

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole("admin", "agent");
  const review = await getReviewDetail(Number((await params).id));
  if (!review) notFound();
  return <ReviewViewer review={review} canDecide={canDecide(user, review)} meId={user.id} />;
}
