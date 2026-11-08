"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button, Notice, H1 } from "@/components/ui";
import { ExerciseInfo } from "@/components/ExerciseInfo";
import { EXERCISE_BY_SLUG } from "@/data/exercises";
import { useApp } from "@/lib/app-context";
import { availability, phaseFor } from "@/lib/exercise/knee";

export default function ExerciseDetail() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const { knee, today, saveKnee } = useApp();
  const ex = EXERCISE_BY_SLUG[slug];
  if (!ex || !knee) return <p>No encontramos ese ejercicio.</p>;
  const phase = phaseFor(knee, today);
  const av = availability(ex, knee, phase);
  return (
    <div className="space-y-5">
      <button onClick={() => router.back()} className="inline-flex items-center gap-1 text-sm text-muted"><ArrowLeft size={16} aria-hidden /> Volver</button>
      <H1>{ex.name}</H1>
      {!av.available && <Notice tone="sun" title="No disponible para ti ahora">{av.reason}{av.fallback ? <> Alternativa: <Link className="underline" href={`/ejercicio/ver/${av.fallback.slug}`}>{av.fallback.name}</Link>.</> : null}</Notice>}
      <ExerciseInfo ex={ex} dx={knee.diagnosis} phase={phase} />
      {knee.excluded_exercises?.includes(ex.slug) ? (
        <Button variant="soft" onClick={() => saveKnee({ excluded_exercises: knee.excluded_exercises.filter((x) => x !== ex.slug) })}>Volver a incluir en mi rutina</Button>
      ) : (
        <div className="space-y-2">
          <Button variant="danger" onClick={() => saveKnee({ excluded_exercises: [...(knee.excluded_exercises ?? []), ex.slug] })}>Me molesta la rodilla: quitar de mi rutina</Button>
          <p className="text-xs text-muted">Se reemplaza por una versión más suave. Puedes volver a incluirlo cuando tu fisioterapeuta lo apruebe.</p>
        </div>
      )}
    </div>
  );
}
