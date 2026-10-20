"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { saveSettingsAction } from "@/lib/actions/admin";
import type { FormState } from "@/lib/actions/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: FormState = { error: null };

export function SettingsForm({ notifyEmails, effective }: { notifyEmails: string; effective: string[] }) {
  const [state, action, pending] = useActionState(saveSettingsAction, initialState);
  useEffect(() => {
    if (state.error) toast.error(state.error);
    if (state.ok) toast.success(state.ok);
  }, [state]);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Correo de la mesa de ayuda</CardTitle>
        <CardDescription>
          Reciben todas las solicitudes nuevas y copia de las respuestas. Si se deja vacío, se usan los correos de los administradores.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="notifyEmails">Correos (separados por coma)</Label>
            <Input id="notifyEmails" name="notifyEmails" defaultValue={notifyEmails} placeholder="mesadeayuda@acfcia.com" />
            <p className="text-xs text-muted-foreground">Actualmente: {effective.join(", ") || "—"}</p>
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Guardando..." : "Guardar"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
