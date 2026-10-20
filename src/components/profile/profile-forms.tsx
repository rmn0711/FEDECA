"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { changePassword, updateProfile, type FormState } from "@/lib/actions/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: FormState = { error: null };

function useToast(state: FormState) {
  useEffect(() => {
    if (state.error) toast.error(state.error);
    if (state.ok) toast.success(state.ok);
  }, [state]);
}

export function ProfileForms({ name, department, phone }: { name: string; department: string; phone: string }) {
  const [profileState, profileAction, profilePending] = useActionState(updateProfile, initialState);
  const [pwState, pwAction, pwPending] = useActionState(changePassword, initialState);
  useToast(profileState);
  useToast(pwState);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Datos personales</CardTitle>
          <CardDescription>Se muestran al responsable que atiende tus solicitudes.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={profileAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre completo</Label>
              <Input id="name" name="name" defaultValue={name} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="department">Área / cargo</Label>
              <Input id="department" name="department" defaultValue={department} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono / extensión</Label>
              <Input id="phone" name="phone" defaultValue={phone} />
            </div>
            <Button type="submit" disabled={profilePending}>
              {profilePending ? "Guardando..." : "Guardar"}
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Cambiar contraseña</CardTitle>
          <CardDescription>Mínimo 8 caracteres, con letras y números.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={pwAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current">Contraseña actual</Label>
              <Input id="current" name="current" type="password" autoComplete="current-password" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Nueva contraseña</Label>
              <Input id="password" name="password" type="password" autoComplete="new-password" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirmar</Label>
              <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
            </div>
            <Button type="submit" disabled={pwPending}>
              {pwPending ? "Guardando..." : "Cambiar contraseña"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
