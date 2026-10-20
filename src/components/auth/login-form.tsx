"use client";

import Link from "next/link";
import { useActionState } from "react";
import { LogIn } from "lucide-react";
import { login, type FormState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

const initialState: FormState = { error: null };

export function LoginForm({ next, canRegister }: { next?: string; canRegister: boolean }) {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Iniciar sesión</CardTitle>
        <CardDescription>Ingresa con tu correo y contraseña de ACF.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="next" value={next ?? ""} />
          {state.error && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Correo</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input id="password" name="password" type="password" autoComplete="current-password" required />
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            <LogIn className="size-4" />
            {pending ? "Ingresando..." : "Ingresar"}
          </Button>
          <div className="flex flex-col items-center gap-1 text-center text-sm">
            <Link href="/recuperar" className="text-muted-foreground hover:underline">
              ¿Olvidaste tu contraseña?
            </Link>
            <Link href="/solicitar" className="text-muted-foreground hover:underline">
              Entrar sin contraseña (enlace a mi correo)
            </Link>
            {canRegister && (
              <Link href="/registro" className="font-medium text-[#d9342c] hover:underline">
                Crear una cuenta con mi correo corporativo
              </Link>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
