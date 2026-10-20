"use client";

import Link from "next/link";
import { useActionState } from "react";
import { KeyRound, LogIn } from "lucide-react";
import { accessLoginAction, forgetDeviceAction } from "@/lib/actions/access";
import type { FormState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { UserAvatar } from "@/components/shared/user-avatar";

const initialState: FormState = { error: null };

/** Ingreso solo con contraseña para quien abre su enlace personal (o ya fue recordado en este navegador). */
export function AccessForm({
  token,
  name,
  email,
  needsPassword,
  next,
  remembered,
}: {
  token: string;
  name: string;
  email: string;
  needsPassword: boolean;
  next?: string;
  remembered?: boolean;
}) {
  const [state, action, pending] = useActionState(accessLoginAction, initialState);
  const first = name.split(" ")[0];
  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="items-center text-center">
        <div className="mx-auto mb-1">
          <UserAvatar fullName={name} size="lg" />
        </div>
        <CardTitle>Hola, {first}</CardTitle>
        <CardDescription>{needsPassword ? "Crea tu contraseña para entrar a la Mesa de Ayuda." : "Escribe tu contraseña para continuar."}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="next" value={next ?? ""} />
          <input type="hidden" name="username" value={email} autoComplete="username" />
          {state.error && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="password">{needsPassword ? "Nueva contraseña" : "Contraseña"}</Label>
            <Input id="password" name="password" type="password" autoFocus required autoComplete={needsPassword ? "new-password" : "current-password"} />
            {needsPassword && <p className="text-xs text-muted-foreground">Mínimo 8 caracteres, con letras y números.</p>}
          </div>
          {needsPassword && (
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirmar contraseña</Label>
              <Input id="confirm" name="confirm" type="password" required autoComplete="new-password" />
            </div>
          )}
          <Button type="submit" className="w-full" disabled={pending}>
            {needsPassword ? <KeyRound className="size-4" /> : <LogIn className="size-4" />}
            {pending ? "Ingresando..." : needsPassword ? "Crear contraseña y entrar" : "Entrar"}
          </Button>
          <div className="flex flex-col items-center gap-1 text-center text-sm">
            {!needsPassword && (
              <Link href="/recuperar" className="text-muted-foreground hover:underline">
                ¿Olvidaste tu contraseña?
              </Link>
            )}
            {remembered && (
              <button type="button" onClick={() => forgetDeviceAction()} className="text-muted-foreground hover:underline">
                No soy {first} · usar otra cuenta
              </button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
