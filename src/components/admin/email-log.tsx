"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { Eye, MailCheck, MailX, Send } from "lucide-react";
import { toast } from "sonner";
import { sendTestEmailAction } from "@/lib/actions/admin";
import type { FormState } from "@/lib/actions/auth";
import { ticketCode } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type EmailRow = {
  id: number;
  ticketId: number | null;
  kind: string;
  to: string;
  cc: string | null;
  subject: string;
  status: string;
  error: string | null;
  createdAt: string;
};

const KIND_LABELS: Record<string, string> = {
  created: "Nueva solicitud",
  comment: "Respuesta",
  note: "Nota interna",
  status: "Cambio de estado",
  assign: "Asignación",
  rating: "Calificación",
  password: "Contraseña",
  welcome: "Bienvenida",
  test: "Prueba",
};

const initialState: FormState = { error: null };

export function EmailLog({ emails, smtp }: { emails: EmailRow[]; smtp: boolean }) {
  const [preview, setPreview] = useState<EmailRow | null>(null);
  const [state, action, pending] = useActionState(sendTestEmailAction, initialState);
  useEffect(() => {
    if (state.error) toast.error(state.error);
    if (state.ok) toast.success(state.ok);
  }, [state]);

  return (
    <div className="space-y-4">
      {!smtp && (
        <Alert>
          <MailX className="size-4" />
          <AlertTitle>El envío de correos no está configurado</AlertTitle>
          <AlertDescription>
            Configura SMTP_USER y SMTP_PASSWORD (la casilla de Microsoft 365, igual que el cotizador). Mientras tanto los correos se registran
            como “simulado” y la plataforma funciona normalmente.
          </AlertDescription>
        </Alert>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Correo de prueba</CardTitle>
          <CardDescription>Verifica que las notificaciones lleguen correctamente.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={action} className="flex flex-wrap gap-2">
            <Input name="to" type="email" required placeholder="destinatario@acfcia.com" className="w-full sm:w-72" />
            <Button type="submit" disabled={pending}>
              <Send className="size-4" />
              {pending ? "Enviando..." : "Enviar prueba"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Asunto</TableHead>
              <TableHead className="hidden lg:table-cell">Para / Copia</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {emails.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="p-0">
                  <EmptyState icon={MailCheck} title="Aún no se han enviado correos" />
                </TableCell>
              </TableRow>
            ) : (
              emails.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-muted-foreground">{formatDateTime(e.createdAt)}</TableCell>
                  <TableCell>
                    <Badge variant="neutral">{KIND_LABELS[e.kind] ?? e.kind}</Badge>
                  </TableCell>
                  <TableCell className="max-w-[320px]">
                    <p className="truncate">{e.subject}</p>
                    {e.ticketId && (
                      <Link href={`/solicitudes/${e.ticketId}`} className="text-xs text-[#d9342c] hover:underline">
                        {ticketCode(e.ticketId)}
                      </Link>
                    )}
                  </TableCell>
                  <TableCell className="hidden max-w-[320px] text-xs lg:table-cell">
                    <p className="truncate">Para: {e.to}</p>
                    {e.cc && <p className="truncate text-muted-foreground">CC: {e.cc}</p>}
                  </TableCell>
                  <TableCell>
                    <Badge variant={e.status === "enviado" ? "success" : e.status === "fallido" ? "destructive" : "neutral"} title={e.error ?? undefined}>
                      {e.status === "enviado" ? "Enviado" : e.status === "fallido" ? "Fallido" : "Simulado"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" aria-label="Ver correo" onClick={() => setPreview(e)}>
                      <Eye className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={preview !== null} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="pr-6">{preview?.subject}</DialogTitle>
            <p className="text-xs text-muted-foreground">
              Para: {preview?.to}
              {preview?.cc ? ` · CC: ${preview.cc}` : ""}
            </p>
            {preview?.error && <p className="text-xs text-destructive">Error: {preview.error}</p>}
          </DialogHeader>
          {preview && <iframe title="Vista previa" src={`/api/admin/correos/${preview.id}`} className="h-[65vh] w-full rounded-lg border bg-white" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
