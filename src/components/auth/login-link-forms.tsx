"use client";

import Link from "next/link";
import { useActionState } from "react";
import { LogIn, Mail, MailCheck } from "lucide-react";
import { enterWithLinkAction, requestLoginLinkAction } from "@/lib/actions/login-link";
import type { FormState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

const initialState: FormState = { error: null };

/** Enlace general de solicitudes: solo el correo, sin registro ni contraseña. */
export function RequestLinkForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(requestLoginLinkAction, initialState);
  if (state.ok) {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <span className="mx-auto mb-1 flex size-12 items-center justify-center rounded-2xl bg-[#d9342c]/10">
            <MailCheck className="size-6 text-[#d9342c]" />
          </span>
          <CardTitle>Revisa tu correo</CardTitle>
          <CardDescription>{state.ok}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center text-xs text-muted-foreground">¿No llegó? Revisa la carpeta de correo no deseado o vuelve a intentarlo en un minuto.</p>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Registrar una solicitud</CardTitle>
        <CardDescription>Escribe tu correo de ACF. Te enviamos un enlace para entrar sin contraseña ni registro.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          {state.error && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
          <input type="hidden" name="next" value={next ?? ""} />
          <div className="space-y-2">
            <Label htmlFor="email">Correo corporativo</Label>
            <Input id="email" name="email" type="email" autoComplete="email" placeholder="nombre@acfcia.com" required autoFocus />
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            <Mail className="size-4" />
            {pending ? "Enviando..." : "Enviarme el enlace"}
          </Button>
          <p className="text-center text-sm">
            <Link href="/login" className="text-muted-foreground hover:underline">
              Entrar con contraseña
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

/** Página del enlace del correo: un botón para entrar (y nombre/área si es la primera vez). */
export function EnterWithLinkForm({ token, email, name }: { token: string; email: string; name: string | null }) {
  const [state, action, pending] = useActionState(enterWithLinkAction, initialState);
  const isNew = !name;
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{isNew ? "Bienvenido a Conecta ACF" : `Hola, ${name.split(" ")[0]}`}</CardTitle>
        <CardDescription>
          {isNew ? "Es tu primera vez. Cuéntanos quién eres y entra." : "Toca el botón para entrar."} <span className="font-medium text-foreground">{email}</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          {state.error && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
          <input type="hidden" name="token" value={token} />
          {isNew && (
            <>
              <div className="space-y-2">
                <Label htmlFor="name">Nombre completo</Label>
                <Input id="name" name="name" autoComplete="name" required minLength={3} autoFocus />
              </div>
              <div className="space-y-2">
                <Label htmlFor="department">Área u obra (opcional)</Label>
                <Input id="department" name="department" placeholder="Ej. Obra Altos del Río, Comercial" />
              </div>
            </>
          )}
          <Button type="submit" className="w-full" disabled={pending}>
            <LogIn className="size-4" />
            {pending ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
