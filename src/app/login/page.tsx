"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, H1, Input, Notice } from "@/components/ui";
import { isSupabaseConfigured, supabaseBrowser } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!isSupabaseConfigured) {
    return (
      <div className="space-y-6">
        <H1>Fedeca</H1>
        <Notice tone="sky" title="Modo demostración">
          Supabase no está configurado, así que los datos se guardan solo en este navegador. Para usar cuentas y sincronizar entre celulares, sigue el README (variables NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY).
        </Notice>
        <Button size="lg" className="w-full" onClick={() => router.replace("/")}>Entrar en modo demostración</Button>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const sb = supabaseBrowser();
    const { data, error } = mode === "in" ? await sb.auth.signInWithPassword({ email, password }) : await sb.auth.signUp({ email, password });
    setBusy(false);
    if (error) return setMsg(error.message);
    if (mode === "up" && !data.session) return setMsg("Te enviamos un correo para confirmar tu cuenta. Después vuelve e inicia sesión.");
    router.replace("/");
  }

  async function magic() {
    if (!email) return setMsg("Escribe tu correo primero.");
    setBusy(true);
    const { error } = await supabaseBrowser().auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
    setBusy(false);
    setMsg(error ? error.message : "Revisa tu correo: te enviamos un enlace para entrar.");
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <H1>{mode === "in" ? "Bienvenidos" : "Crea tu cuenta"}</H1>
        <p className="mt-1 text-muted">Nutrición, ejercicio y seguimiento para dos.</p>
      </div>
      <Field label="Correo"><Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
      <Field label="Contraseña" hint="Mínimo 8 caracteres."><Input type="password" autoComplete={mode === "in" ? "current-password" : "new-password"} minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
      {msg && <Notice tone="sky">{msg}</Notice>}
      <Button type="submit" size="lg" className="w-full" disabled={busy}>{mode === "in" ? "Entrar" : "Crear cuenta"}</Button>
      <div className="flex justify-between">
        <Button variant="ghost" size="sm" onClick={() => setMode(mode === "in" ? "up" : "in")}>{mode === "in" ? "Crear cuenta" : "Ya tengo cuenta"}</Button>
        <Button variant="ghost" size="sm" onClick={magic}>Enviarme un enlace</Button>
      </div>
    </form>
  );
}
