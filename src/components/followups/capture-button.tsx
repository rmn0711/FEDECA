"use client";

import { useState } from "react";
import { BellPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { QuickCapture } from "./quick-capture";

type Member = { id: number; name: string };
type ProjectOption = { id: number; name: string; icon: string };

/** Botón para anotar un seguimiento desde cualquier pantalla (barra superior o detalle de solicitud). */
export function CaptureButton({
  members,
  projects,
  ticketId,
  initialText,
  className,
  label = "Seguimiento",
  variant = "outline",
}: {
  members: Member[];
  projects: ProjectOption[];
  ticketId?: number;
  initialText?: string;
  className?: string;
  label?: string;
  variant?: "outline" | "default";
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} size="sm" className={className} onClick={() => setOpen(true)}>
        <BellPlus className="size-4" />
        <span className="hidden sm:inline">{label}</span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Anotar seguimiento</DialogTitle>
            <DialogDescription>Escríbelo como lo dirías. Lo convertimos en recordatorio o en tarea con fecha.</DialogDescription>
          </DialogHeader>
          <QuickCapture members={members} projects={projects} ticketId={ticketId} initialText={initialText} onDone={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
