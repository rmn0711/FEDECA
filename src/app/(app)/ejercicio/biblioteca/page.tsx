"use client";
import Link from "next/link";
import { Chip, H1 } from "@/components/ui";
import { ExerciseArt } from "@/components/ExerciseArt";
import { EXERCISES } from "@/data/exercises";
import { useApp } from "@/lib/app-context";
import { availability, phaseFor } from "@/lib/exercise/knee";
import type { ExerciseGroup } from "@/lib/types";

const SECTIONS: [ExerciseGroup, string][] = [
  ["warmup", "Calentamiento"], ["knee_block", "Bloque de rodilla"], ["leg_a", "Pierna A"], ["leg_b", "Pierna B"], ["upper_a", "Superior A"], ["upper_b", "Superior B"], ["core", "Core"], ["cardio", "Cardio de bajo impacto"], ["stretch", "Estiramientos"], ["mobility", "Movilidad"],
];

export default function Library() {
  const { knee, today } = useApp();
  if (!knee) return null;
  const phase = phaseFor(knee, today);
  return (
    <div className="space-y-6">
      <header className="space-y-1"><H1>Biblioteca de ejercicios</H1><p className="text-muted">{EXERCISES.length} ejercicios. Los bloqueados o aún no habilitados se marcan según tu rodilla y tu fase ({phase}).</p></header>
      {SECTIONS.map(([g, title]) => (
        <section key={g} className="space-y-2">
          <h2 className="font-display text-xl font-semibold">{title}</h2>
          <ul className="grid grid-cols-2 gap-3">
            {EXERCISES.filter((e) => e.groups[0] === g).map((e) => {
              const av = availability(e, knee, phase);
              return (
                <li key={e.slug}>
                  <Link href={`/ejercicio/ver/${e.slug}`} className="block space-y-2 rounded-3xl bg-surface p-3 transition-colors hover:bg-surface-2">
                    <ExerciseArt art={e.art} className={`w-full rounded-2xl ${av.available ? "" : "opacity-50"}`} />
                    <p className="text-sm font-medium leading-snug">{e.name}</p>
                    {!av.available && <Chip tone="sun">{av.reason}</Chip>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
