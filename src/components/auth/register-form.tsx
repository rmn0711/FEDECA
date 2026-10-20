"use client";

import Link from "next/link";
import { useActionState } from "react";
import { UserPlus } from "lucide-react";
import { register, type FormState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

const initialState: FormState = { error: null };

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(register, initialState);
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Crear cuenta</CardTitle>
        <CardDescription>Usa tu correo corporativo para registrar solicitudes.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          {state.error && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="name">Nombre completo</Label>
            <Input id="name" name="name" autoComplete="name" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Correo corporativo</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="department">Área / cargo</Label>
            <Input id="department" name="department" placeholder="Ej: Comercial, Contabilidad, Obra…" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input id="password" name="password" type="password" autoComplete="new-password" required />
            <p className="text-xs text-muted-foreground">Mínimo 8 caracteres, con letras y números.</p>
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            <UserPlus className="size-4" />
            {pending ? "Creando..." : "Crear cuenta"}
          </Button>
          <p className="text-center text-sm">
            <Link href="/login" className="text-muted-foreground hover:underline">
              Ya tengo cuenta
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
