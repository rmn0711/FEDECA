"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BellRing, CalendarClock, ListPlus, Sparkles, UserRound } from "lucide-react";
import { toast } from "sonner";
import { captureAction } from "@/lib/actions/followups";
import { parseFollowup } from "@/lib/followups/parse";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Member = { id: number; name: string };
type ProjectOption = { id: number; name: string; icon: string };

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Captura rápida: escribe en lenguaje natural ("revisar con Elías el informe el jueves a las 3pm")
 * y se crea un recordatorio para ti o una tarea asignada, con la fecha detectada.
 */
export function QuickCapture({
  members,
  projects,
  ticketId,
  initialText = "",
  onDone,
  compact,
}: {
  members: Member[];
  projects: ProjectOption[];
  ticketId?: number;
  initialText?: string;
  onDone?: () => void;
  compact?: boolean;
}) {
  const router = useRouter();
  const [text, setText] = useState(initialText);
  const [notes, setNotes] = useState("");
  const [kind, setKind] = useState<"recordatorio" | "tarea">("recordatorio");
  const [manualDate, setManualDate] = useState<string | null>(null);
  const [manualTime, setManualTime] = useState<string | null>(null);
  const [manualPerson, setManualPerson] = useState<string | null>(null);
  const [projectId, setProjectId] = useState(projects[0] ? String(projects[0].id) : "");
  const [pending, startTransition] = useTransition();

  const parsed = useMemo(() => parseFollowup(text), [text]);
  const detectedPerson = useMemo(() => {
    const t = fold(text);
    return members.find((m) => new RegExp(`(^|[^a-z])${fold(m.name.split(" ")[0])}([^a-z]|$)`).test(t)) ?? null;
  }, [text, members]);
  const date = manualDate ?? parsed.date ?? "";
  const time = manualTime ?? parsed.time ?? (date ? "09:00" : "");
  const personId = manualPerson ?? (detectedPerson ? String(detectedPerson.id) : "none");

  function reset() {
    setText("");
    setNotes("");
    setManualDate(null);
    setManualTime(null);
    setManualPerson(null);
  }

  function save() {
    startTransition(async () => {
      const r = await captureAction({
        title: parsed.title,
        notes,
        date: date || null,
        time: date ? time || null : null,
        kind,
        personId: personId !== "none" ? Number(personId) : null,
        projectId: kind === "tarea" ? Number(projectId) : null,
        ticketId: ticketId ?? null,
      });
      if (!r.ok) return void toast.error(r.error);
      toast.success(
        r.data.kind === "tarea"
          ? "Tarea creada y asignada. Te recordaremos revisarla ese día."
          : date
            ? "Seguimiento programado. Te avisaremos a la hora indicada."
            : "Seguimiento guardado (sin fecha)."
      );
      reset();
      router.refresh();
      onDone?.();
    });
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Sparkles className="pointer-events-none absolute top-3 left-3 size-4 text-[#d9342c]" />
        <Textarea
          value={text}
          autoFocus={!compact}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && parsed.title.length >= 3) {
              e.preventDefault();
              save();
            }
          }}
          rows={2}
          placeholder="Ej: Revisar con Elías el informe de pauta el jueves a las 3pm"
          className="min-h-14 pl-9 text-base"
          aria-label="¿Qué debes hacer o a qué hacerle seguimiento?"
        />
      </div>

      {text.trim().length > 2 && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">Entendí:</span>
          <span className="rounded-full bg-muted px-2.5 py-1 font-medium">{parsed.title}</span>
          {parsed.date && (
            <span className="flex items-center gap-1 rounded-full bg-[#2a78d6]/10 px-2.5 py-1 font-medium text-[#1c5cab]">
              <CalendarClock className="size-3" />
              {new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${parsed.date}T00:00:00Z`))}
              {parsed.time ? ` · ${parsed.time}` : ""}
            </span>
          )}
          {detectedPerson && (
            <span className="flex items-center gap-1 rounded-full bg-[#1a7f4e]/10 px-2.5 py-1 font-medium text-[#1a7f4e]">
              <UserRound className="size-3" />
              {detectedPerson.name}
            </span>
          )}
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        {(
          [
            { v: "recordatorio", icon: BellRing, t: "Recordatorio para mí", d: "Te avisa a la hora indicada" },
            { v: "tarea", icon: ListPlus, t: "Crear como tarea", d: "Se asigna a alguien en un proyecto" },
          ] as const
        ).map((o) => (
          <button
            key={o.v}
            type="button"
            onClick={() => setKind(o.v)}
            className={cn("flex items-start gap-2 rounded-xl border p-2.5 text-left transition-all", kind === o.v ? "border-[#d9342c] ring-2 ring-[#d9342c]/25" : "hover:bg-accent")}
          >
            <o.icon className="mt-0.5 size-4 text-[#d9342c]" />
            <span>
              <span className="block text-sm font-semibold">{o.t}</span>
              <span className="block text-xs text-muted-foreground">{o.d}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="space-y-1 text-xs text-muted-foreground">
          Fecha
          <Input type="date" value={date} onChange={(e) => setManualDate(e.target.value)} className="w-40" aria-label="Fecha del seguimiento" />
        </label>
        <label className="space-y-1 text-xs text-muted-foreground">
          Hora
          <Input type="time" value={time} onChange={(e) => setManualTime(e.target.value)} className="w-28" disabled={!date} aria-label="Hora del seguimiento" />
        </label>
        <label className="space-y-1 text-xs text-muted-foreground">
          {kind === "tarea" ? "Responsable" : "Persona (opcional)"}
          <Select value={personId} onValueChange={(v) => setManualPerson(String(v))}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{kind === "tarea" ? "Sin asignar" : "Nadie en particular"}</SelectItem>
              {members.map((m) => (
                <SelectItem key={m.id} value={String(m.id)}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        {kind === "tarea" && (
          <label className="space-y-1 text-xs text-muted-foreground">
            Proyecto
            <Select value={projectId} onValueChange={(v) => setProjectId(String(v))}>
              <SelectTrigger className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.icon} {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        )}
      </div>
      {!compact && <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Notas (opcional): contexto, enlaces, acuerdos…" />}
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">Enter para guardar · reconoce «mañana», «el jueves», «en 2 semanas», «a las 3pm», «28/10»…</p>
        <Button onClick={save} disabled={pending || parsed.title.length < 3} className="bg-[#d9342c] text-white hover:bg-[#c42d26]">
          {pending ? "Guardando..." : kind === "tarea" ? "Crear tarea" : "Guardar seguimiento"}
        </Button>
      </div>
    </div>
  );
}
