import { ExerciseArt } from "./ExerciseArt";
import { Chip } from "./ui";
import { DX_LABEL, repsLabel, romFor } from "@/lib/exercise/knee";
import type { Exercise, KneeDx, Phase } from "@/lib/types";
import { PHASE_INFO } from "@/lib/exercise/knee";

export function ExerciseInfo({ ex, dx, phase }: { ex: Exercise; dx: KneeDx; phase: Phase }) {
  const rom = romFor(ex, dx, phase);
  const [rpeLo, rpeHi] = PHASE_INFO[phase].rpe;
  return (
    <div className="space-y-4">
      <ExerciseArt art={ex.art} label={`Ilustración: ${ex.name}`} className="w-full rounded-3xl" />
      <dl className="grid grid-cols-4 gap-2 text-center">
        {[["Series", String(ex.sets)], ["Reps", repsLabel(ex)], ["Descanso", `${ex.restSec} s`], ["RPE", `${rpeLo}–${rpeHi}`]].map(([k, v]) => (
          <div key={k} className="rounded-2xl bg-surface px-1 py-2"><dd className="font-display tabular text-base font-semibold">{v}</dd><dt className="text-[10px] text-muted">{k}</dt></div>
        ))}
      </dl>
      <p className="text-sm"><span className="font-medium">Tempo:</span> {ex.tempo}{ex.unilateral ? " · por lado" : ""}</p>
      <div className="rounded-2xl bg-brand-soft p-3 text-sm"><p className="font-medium text-brand">Rango seguro para tu rodilla</p><p>{rom ? `${rom.minDeg}° a ${rom.maxDeg}° de flexión. ` : ""}{ex.safeRomText}</p></div>
      <div><p className="mb-1 text-sm font-medium">3 claves de técnica</p><ol className="list-decimal space-y-1 pl-5 text-sm">{ex.cues.map((c) => <li key={c}>{c}</li>)}</ol></div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-2xl bg-surface p-3"><p className="font-medium">Más fácil</p><p className="text-muted">{ex.easier}</p></div>
        <div className="rounded-2xl bg-surface p-3"><p className="font-medium">Más difícil</p><p className="text-muted">{ex.harder}</p></div>
      </div>
      <div className="flex flex-wrap gap-1.5">{ex.muscles.map((m) => <Chip key={m}>{m}</Chip>)}{ex.blockedFor.length > 0 && <Chip tone="clay">Bloqueado en: {ex.blockedFor.map((d) => DX_LABEL[d].toLowerCase()).join(", ")}</Chip>}</div>
    </div>
  );
}
