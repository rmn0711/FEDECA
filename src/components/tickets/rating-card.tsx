"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { rateAction } from "@/lib/actions/tickets";
import type { FormState } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const LABELS = ["", "Muy mala", "Mala", "Regular", "Buena", "Excelente"];
const initialState: FormState = { error: null };

export function RatingCard({ ticketId }: { ticketId: number }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [state, formAction] = useActionState(rateAction, initialState);
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    if (state.error) toast.error(state.error);
    if (state.ok) toast.success(state.ok);
  }, [state]);
  const shown = hover || rating;

  return (
    <Card className="ring-[#1baf7a]/40">
      <CardHeader>
        <CardTitle>¿Cómo fue la atención?</CardTitle>
        <CardDescription>Tu calificación cierra la solicitud y nos ayuda a mejorar.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!rating) return toast.error("Selecciona de 1 a 5 estrellas.");
            const fd = new FormData(e.currentTarget);
            startTransition(() => formAction(fd));
          }}
          className="space-y-3"
        >
          <input type="hidden" name="ticketId" value={ticketId} />
          <input type="hidden" name="rating" value={rating} />
          <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                aria-label={`${n} estrellas`}
                onMouseEnter={() => setHover(n)}
                onClick={() => setRating(n)}
                className="p-0.5"
              >
                <Star className={cn("size-7 transition-colors", n <= shown ? "fill-[#eb6834] text-[#eb6834]" : "text-muted-foreground/40")} />
              </button>
            ))}
            <span className="ml-2 text-sm font-medium text-muted-foreground">{LABELS[shown]}</span>
          </div>
          <Textarea name="comment" rows={2} placeholder="Comentario (opcional)" />
          <Button type="submit" disabled={pending}>
            {pending ? "Enviando..." : "Calificar y cerrar"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
