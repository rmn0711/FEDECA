"use client";

import { useActionState, useEffect } from "react";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { saveMyWhatsappAction } from "@/lib/actions/whatsapp";
import type { FormState } from "@/lib/actions/auth";
import { WA_PREF_LABELS, type WaPref } from "@/lib/whatsapp/templates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: FormState = { error: null };

export function WhatsappForm({ phone, optIn, prefs, staff }: { phone: string; optIn: boolean; prefs: Record<string, boolean>; staff: boolean }) {
  const [state, action, pending] = useActionState(saveMyWhatsappAction, initialState);
  useEffect(() => {
    if (state.error) toast.error(state.error);
    if (state.ok) toast.success(state.ok);
  }, [state]);
  const keys = (Object.keys(WA_PREF_LABELS) as WaPref[]).filter((k) => staff || !WA_PREF_LABELS[k].staffOnly);
  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="wa-phone">Celular con WhatsApp</Label>
        <Input id="wa-phone" name="phone" defaultValue={phone} placeholder="300 123 4567" inputMode="tel" className="max-w-xs" />
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="optIn" defaultChecked={optIn} className="mt-0.5 size-4 accent-[#25d366]" />
        <span>
          <span className="font-medium">Acepto recibir alertas de la Mesa de Ayuda ACF por WhatsApp.</span>
          <span className="block text-xs text-muted-foreground">Puedes darte de baja cuando quieras escribiendo BAJA o desmarcando esta opción.</span>
        </span>
      </label>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">¿Qué alertas quieres recibir?</legend>
        {keys.map((k) => (
          <label key={k} className="flex items-start gap-2 text-sm">
            <input type="checkbox" name={`pref_${k}`} defaultChecked={prefs[k] !== false} className="mt-0.5 size-4 accent-[#d9342c]" />
            <span>
              {WA_PREF_LABELS[k].label}
              <span className="block text-xs text-muted-foreground">{WA_PREF_LABELS[k].description}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <Button type="submit" disabled={pending} className="bg-[#25d366] text-white hover:bg-[#1ebe5a]">
        <MessageCircle className="size-4" />
        {pending ? "Guardando..." : "Guardar"}
      </Button>
    </form>
  );
}
