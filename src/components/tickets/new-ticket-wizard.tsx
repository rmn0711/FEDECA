"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { ArrowLeft, BookOpen, Check, Clock3, Paperclip, Send, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { CATEGORIES, getCategory, type CategoryField } from "@/lib/categories";
import { MAX_FILE_BYTES, MAX_FILES, URGENCIES, URGENCY_META, addBusinessHours, type Urgency } from "@/lib/constants";
import { createTicketAction } from "@/lib/actions/tickets";
import { suggestArticlesAction } from "@/lib/actions/kb";
import type { FormState } from "@/lib/actions/auth";
import { formatBytes, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CategoryIcon } from "./badges";

type CategoryOption = { slug: string; responsibleName: string | null };

const initialState: FormState = { error: null };

function FieldInput({ field }: { field: CategoryField }) {
  const name = `f_${field.key}`;
  switch (field.type) {
    case "textarea":
      return <Textarea id={name} name={name} required={field.required} placeholder={field.placeholder} rows={3} maxLength={4000} />;
    case "select":
      return (
        <Select name={name} required={field.required}>
          <SelectTrigger id={name} className="w-full">
            <SelectValue placeholder="Selecciona una opción" />
          </SelectTrigger>
          <SelectContent>
            {field.options?.map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case "multiselect":
      return (
        <div className="flex flex-wrap gap-2">
          {field.options?.map((o) => (
            <label
              key={o}
              className="cursor-pointer rounded-full border px-3 py-1 text-sm transition-colors select-none hover:bg-accent has-[:checked]:border-[#d9342c] has-[:checked]:bg-[#d9342c]/10 has-[:checked]:text-[#d9342c]"
            >
              <input type="checkbox" name={name} value={o} className="sr-only" />
              {o}
            </label>
          ))}
        </div>
      );
    case "date":
      return <Input id={name} name={name} type="date" required={field.required} />;
    case "datetime":
      return <Input id={name} name={name} type="datetime-local" required={field.required} />;
    case "number":
      return <Input id={name} name={name} type="number" min={0} step="any" inputMode="decimal" required={field.required} placeholder={field.placeholder} />;
    default:
      return <Input id={name} name={name} required={field.required} placeholder={field.placeholder} maxLength={field.type === "url" ? 1000 : 300} />;
  }
}

export function NewTicketWizard({ categories, initialCategory }: { categories: CategoryOption[]; initialCategory?: string }) {
  const available = CATEGORIES.filter((c) => categories.some((x) => x.slug === c.slug));
  const [slug, setSlug] = useState<string | null>(available.some((c) => c.slug === initialCategory) ? initialCategory! : null);
  const [urgency, setUrgency] = useState<Urgency>("media");
  const [files, setFiles] = useState<File[]>([]);
  const [state, formAction] = useActionState(createTicketAction, initialState);
  const [pending, startTransition] = useTransition();
  const def = slug ? getCategory(slug) : null;
  const responsible = categories.find((c) => c.slug === slug)?.responsibleName;

  // Vista previa de los vencimientos si la solicitud se registra ahora.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  const preview = useMemo(
    () => ({
      response: addBusinessHours(now, URGENCY_META[urgency].responseHours),
      solution: addBusinessHours(now, URGENCY_META[urgency].slaHours),
    }),
    [now, urgency]
  );

  useEffect(() => {
    if (state.error) toast.error(state.error);
  }, [state]);

  // Sugerencias de la base de conocimiento según lo que escribe (evita solicitudes que ya tienen respuesta).
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Array<{ id: number; title: string; summary: string | null }>>([]);
  useEffect(() => {
    if (!slug || query.trim().length < 6) return;
    const t = setTimeout(() => {
      suggestArticlesAction(slug, query).then(setSuggestions).catch(() => {});
    }, 450);
    return () => clearTimeout(t);
  }, [slug, query]);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next = [...files];
    for (const f of Array.from(list)) {
      if (f.size > MAX_FILE_BYTES) {
        toast.error(`"${f.name}" supera los 10 MB.`);
        continue;
      }
      if (next.length >= MAX_FILES) {
        toast.error(`Máximo ${MAX_FILES} archivos.`);
        break;
      }
      next.push(f);
    }
    setFiles(next);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.delete("files");
    files.forEach((f) => fd.append("files", f));
    // Se envía a mano para que el formulario no se limpie si hay un error de validación.
    startTransition(() => formAction(fd));
  }

  if (!def) {
    return (
      <div className="space-y-3">
        <p className="text-sm font-medium text-muted-foreground">1. ¿Con qué área necesitas apoyo?</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {available.map((c) => {
            const r = categories.find((x) => x.slug === c.slug)?.responsibleName;
            return (
              <button
                key={c.slug}
                type="button"
                onClick={() => setSlug(c.slug)}
                className="group flex flex-col gap-3 rounded-2xl bg-card p-4 text-left shadow-xs ring-1 ring-foreground/10 transition-all hover:-translate-y-0.5 hover:shadow-md hover:ring-[#d9342c]/40"
              >
                <div className="flex items-center gap-3">
                  <CategoryIcon slug={c.slug} className="size-10" />
                  <p className="font-semibold">{c.name}</p>
                </div>
                <p className="text-sm text-muted-foreground">{c.description}</p>
                <p className="mt-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                  <UserRound className="size-3.5" />
                  {r ? `Responsable: ${r}` : "Responsable por asignar"}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <input type="hidden" name="category" value={def.slug} />
      <input type="hidden" name="urgency" value={urgency} />

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3">
          <CategoryIcon slug={def.slug} className="size-10" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{def.name}</p>
            <p className="text-sm text-muted-foreground">{responsible ? `Responsable: ${responsible}` : "Responsable por asignar"}</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setSlug(null)}>
            <ArrowLeft className="size-3.5" />
            Cambiar área
          </Button>
        </CardContent>
      </Card>

      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Prioridad</CardTitle>
          <CardDescription>Elige según el impacto real en tu trabajo. Los tiempos se cuentan en horas hábiles (lunes a viernes, 8:00 a. m. – 5:00 p. m.).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3" role="radiogroup" aria-label="Prioridad">
            {URGENCIES.map((u) => {
              const m = URGENCY_META[u];
              const active = urgency === u;
              return (
                <button
                  key={u}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setUrgency(u)}
                  className={cn(
                    "flex flex-col gap-2 rounded-xl border p-3 text-left transition-all",
                    active ? "border-[#d9342c] bg-[#d9342c]/[0.04] ring-2 ring-[#d9342c]/30" : "hover:bg-accent"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 font-semibold">
                      <span className={cn("size-2.5 rounded-full", m.dot)} />
                      {m.label}
                    </span>
                    {active && <Check className="size-4 text-[#d9342c]" />}
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">{m.definition}</p>
                  <div className="mt-auto space-y-0.5 rounded-lg bg-muted/60 px-2 py-1.5 text-xs">
                    <p>
                      <span className="text-muted-foreground">Primera respuesta:</span> <strong>{m.responseLabel}</strong>
                    </p>
                    <p>
                      <span className="text-muted-foreground">Solución:</span> <strong>{m.slaLabel}</strong>
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="flex flex-col gap-1 rounded-lg border border-dashed px-3 py-2 text-sm sm:flex-row sm:items-center sm:gap-4">
            <span className="flex items-center gap-1.5 font-medium">
              <Clock3 className="size-4 text-[#d9342c]" />
              Si la registras ahora:
            </span>
            <span>
              respuesta antes de <strong>{formatDateTime(preview.response)}</strong>
            </span>
            <span>
              solución antes de <strong>{formatDateTime(preview.solution)}</strong>
            </span>
          </div>
          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Ver ejemplos de prioridad {URGENCY_META[urgency].label.toLowerCase()}</summary>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
              {URGENCY_META[urgency].examples.map((ex) => (
                <li key={ex}>{ex}</li>
              ))}
            </ul>
          </details>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Detalle de la solicitud</CardTitle>
          <CardDescription>Los campos con * son obligatorios. Entre más detalle, más rápida la solución.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Asunto *</Label>
            <Input
              id="title"
              name="title"
              required
              minLength={5}
              maxLength={160}
              placeholder={def.titlePlaceholder}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {suggestions.length > 0 && query.trim().length >= 6 && (
            <div className="space-y-2 rounded-xl border border-[#2a78d6]/30 bg-[#2a78d6]/[0.05] p-3">
              <p className="flex items-center gap-2 text-sm font-medium">
                <BookOpen className="size-4 text-[#2a78d6]" />
                Antes de enviar, quizás esto lo resuelve:
              </p>
              <ul className="space-y-1">
                {suggestions.map((a) => (
                  <li key={a.id}>
                    <a href={`/ayuda/${a.id}?desde=solicitud`} target="_blank" rel="noreferrer" className="text-sm font-medium text-[#1c5cab] hover:underline">
                      {a.title}
                    </a>
                    {a.summary && <span className="text-xs text-muted-foreground"> · {a.summary}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {def.fields.map((f) => (
              <div key={f.key} className={cn("space-y-2", (f.wide || f.type === "multiselect") && "md:col-span-2")}>
                <Label htmlFor={`f_${f.key}`}>
                  {f.label}
                  {f.required && " *"}
                </Label>
                <FieldInput field={f} />
                {f.help && <p className="text-xs text-muted-foreground">{f.help}</p>}
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción *</Label>
            <Textarea id="description" name="description" required minLength={10} rows={5} placeholder={def.descriptionPlaceholder} />
          </div>

          <div className="space-y-2">
            <Label>Adjuntos</Label>
            <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed px-4 py-5 text-center text-sm text-muted-foreground transition-colors hover:bg-accent">
              <Paperclip className="size-5" />
              <span>
                <span className="font-medium text-foreground">Selecciona archivos</span> (capturas, PDF, Excel, imágenes…)
              </span>
              <span className="text-xs">Máximo {MAX_FILES} archivos de 10 MB</span>
              <input type="file" multiple className="sr-only" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
            </label>
            {files.length > 0 && (
              <ul className="space-y-1">
                {files.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm">
                    <Paperclip className="size-3.5 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{f.name}</span>
                    <span className="text-xs text-muted-foreground">{formatBytes(f.size)}</span>
                    <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-foreground" aria-label={`Quitar ${f.name}`}>
                      <X className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="cc">Copiar a (opcional)</Label>
            <Input id="cc" name="cc" placeholder="correo1@acfcia.com, correo2@acfcia.com" />
            <p className="text-xs text-muted-foreground">Estas personas recibirán copia de todas las actualizaciones por correo.</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          Al enviar, se notificará por correo a la mesa de ayuda con copia a {responsible ?? "el responsable del área"} y a ti.
        </p>
        <Button type="submit" size="lg" disabled={pending} className="bg-[#d9342c] text-white hover:bg-[#c42d26]">
          <Send className="size-4" />
          {pending ? "Enviando..." : "Enviar solicitud"}
        </Button>
      </div>
    </form>
  );
}
