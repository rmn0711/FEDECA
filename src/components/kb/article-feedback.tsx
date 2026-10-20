"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { articleFeedbackAction } from "@/lib/actions/kb";
import { Button } from "@/components/ui/button";

export function ArticleFeedback({ id, fromTicket, category }: { id: number; fromTicket: boolean; category: string | null }) {
  const router = useRouter();
  const [sent, setSent] = useState<"helpful" | "not_helpful" | null>(null);

  if (fromTicket) {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-[#1baf7a]/40 bg-[#1baf7a]/[0.06] p-4 sm:flex-row sm:items-center">
        <p className="flex-1 text-sm font-medium">¿Este artículo resolvió lo que ibas a solicitar?</p>
        <div className="flex gap-2">
          <Button
            className="bg-[#1a7f4e] text-white hover:bg-[#156a41]"
            onClick={async () => {
              await articleFeedbackAction(id, "deflection");
              toast.success("¡Qué bien! No fue necesario crear la solicitud.");
              router.push("/dashboard");
            }}
          >
            <CheckCircle2 className="size-4" />
            Sí, ya se resolvió
          </Button>
          <Button variant="outline" render={<Link href={`/solicitudes/nueva${category ? `?categoria=${category}` : ""}`}>No, crear la solicitud</Link>} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border p-4">
      {sent ? (
        <p className="text-sm text-muted-foreground">
          ¡Gracias por tu opinión!{" "}
          {sent === "not_helpful" && (
            <Link href={`/solicitudes/nueva${category ? `?categoria=${category}` : ""}`} className="font-medium text-[#d9342c] hover:underline">
              Crear una solicitud
            </Link>
          )}
        </p>
      ) : (
        <>
          <p className="flex-1 text-sm font-medium">¿Te sirvió este artículo?</p>
          {(["helpful", "not_helpful"] as const).map((k) => (
            <Button
              key={k}
              variant="outline"
              size="sm"
              onClick={async () => {
                setSent(k);
                await articleFeedbackAction(id, k);
              }}
            >
              {k === "helpful" ? <ThumbsUp className="size-3.5" /> : <ThumbsDown className="size-3.5" />}
              {k === "helpful" ? "Sí" : "No"}
            </Button>
          ))}
        </>
      )}
    </div>
  );
}
