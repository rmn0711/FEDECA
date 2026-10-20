"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Lock, Paperclip, Send, X } from "lucide-react";
import { toast } from "sonner";
import { commentAction } from "@/lib/actions/tickets";
import type { FormState } from "@/lib/actions/auth";
import { MAX_FILE_BYTES, MAX_FILES, type Status } from "@/lib/constants";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const initialState: FormState = { error: null };

export function TicketComposer({
  ticketId,
  canManage,
  isRequester,
  status,
}: {
  ticketId: number;
  canManage: boolean;
  isRequester: boolean;
  status: Status;
}) {
  const [mode, setMode] = useState<"public" | "internal">("public");
  const [files, setFiles] = useState<File[]>([]);
  const [state, formAction] = useActionState(commentAction, initialState);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.error) toast.error(state.error);
    if (state.ok) {
      toast.success(state.ok);
      formRef.current?.reset();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFiles([]);
    }
  }, [state]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.delete("files");
    files.forEach((f) => fd.append("files", f));
    startTransition(() => formAction(fd));
  }

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next = [...files];
    for (const f of Array.from(list)) {
      if (f.size > MAX_FILE_BYTES) toast.error(`"${f.name}" supera los 10 MB.`);
      else if (next.length < MAX_FILES) next.push(f);
    }
    setFiles(next);
  }

  const reopening = isRequester && (status === "resuelto" || status === "cerrado");
  const internal = mode === "internal";

  return (
    <Card className={cn(internal && "ring-[#eb6834]/40")}>
      <CardContent>
        <form ref={formRef} onSubmit={onSubmit} className="space-y-3">
          <input type="hidden" name="ticketId" value={ticketId} />
          <input type="hidden" name="internal" value={internal ? "1" : "0"} />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">{internal ? "Nota interna" : isRequester ? "Responder / agregar información" : "Responder al solicitante"}</p>
            {canManage && (
              <Tabs value={mode} onValueChange={(v) => setMode(v as "public" | "internal")}>
                <TabsList>
                  <TabsTrigger value="public">Respuesta</TabsTrigger>
                  <TabsTrigger value="internal">
                    <Lock className="size-3.5" />
                    Nota interna
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            )}
          </div>
          <Textarea
            name="body"
            required
            rows={4}
            placeholder={
              internal
                ? "Solo visible para el equipo de la mesa de ayuda…"
                : reopening
                  ? "Si la solución no funcionó, cuéntanos qué pasa: la solicitud se reabrirá."
                  : "Escribe tu mensaje. Se publicará aquí y se enviará por correo."
            }
            className={cn(internal && "bg-[#eb6834]/[0.04]")}
          />
          {files.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {files.map((f, i) => (
                <li key={`${f.name}-${i}`} className="flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs">
                  <Paperclip className="size-3" />
                  <span className="max-w-[180px] truncate">{f.name}</span>
                  <span className="text-muted-foreground">{formatBytes(f.size)}</span>
                  <button type="button" aria-label={`Quitar ${f.name}`} onClick={() => setFiles(files.filter((_, j) => j !== i))}>
                    <X className="size-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="flex cursor-pointer items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
              <Paperclip className="size-4" />
              Adjuntar
              <input type="file" multiple className="sr-only" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
            </label>
            <div className="flex items-center gap-3">
              <span className="hidden text-xs text-muted-foreground sm:inline">
                {internal ? "No se envía al solicitante" : "Se notifica por correo a los involucrados"}
              </span>
              <Button type="submit" disabled={pending} className={internal ? "bg-[#eb6834] text-white hover:bg-[#d45a29]" : "bg-[#d9342c] text-white hover:bg-[#c42d26]"}>
                {internal ? <Lock className="size-4" /> : <Send className="size-4" />}
                {pending ? "Enviando..." : internal ? "Guardar nota" : reopening ? "Enviar y reabrir" : "Enviar respuesta"}
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
