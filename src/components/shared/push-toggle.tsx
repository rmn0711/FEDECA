"use client";

import { useEffect, useState } from "react";
import { BellOff, BellRing, Smartphone, X } from "lucide-react";
import { toast } from "sonner";
import { removePushSubscriptionAction, savePushSubscriptionAction, testPushAction } from "@/lib/actions/push";
import { Button } from "@/components/ui/button";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const DISMISS_KEY = "acf-helpdesk:push-banner-dismissed";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

type PushState = "unsupported" | "disabled" | "denied" | "off" | "on" | "loading";

function usePush() {
  const [state, setState] = useState<PushState>("loading");
  useEffect(() => {
    if (!PUBLIC_KEY) return void setState("disabled");
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return void setState("unsupported");
    if (Notification.permission === "denied") return void setState("denied");
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setState(sub ? "on" : "off"))
      .catch(() => setState("unsupported"));
  }, []);

  async function enable() {
    setState("loading");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return setState(permission === "denied" ? "denied" : "off");
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(PUBLIC_KEY) });
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      const r = await savePushSubscriptionAction(json, navigator.userAgent);
      if (!r.ok) throw new Error(r.error);
      setState("on");
      toast.success("Notificaciones activadas en este dispositivo.");
      await testPushAction();
    } catch (e) {
      console.error(e);
      toast.error("No se pudieron activar las notificaciones en este navegador.");
      setState("off");
    }
  }

  async function disable() {
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await removePushSubscriptionAction(sub.endpoint);
      await sub.unsubscribe();
    }
    setState("off");
    toast.success("Notificaciones desactivadas en este dispositivo.");
  }

  return { state, enable, disable };
}

/** Tarjeta para el perfil: activar, probar o desactivar en este dispositivo. */
export function PushSettings() {
  const { state, enable, disable } = usePush();
  const isIos = typeof navigator !== "undefined" && /iphone|ipad/i.test(navigator.userAgent);
  return (
    <div className="space-y-3 text-sm">
      {state === "disabled" && <p className="text-muted-foreground">El administrador aún no ha configurado las notificaciones push (claves VAPID).</p>}
      {state === "unsupported" && (
        <p className="text-muted-foreground">
          Este navegador no admite notificaciones.
          {isIos && " En iPhone: abre la plataforma en Safari, toca Compartir → «Agregar a pantalla de inicio» y actívalas desde ese ícono."}
        </p>
      )}
      {state === "denied" && <p className="text-muted-foreground">Bloqueaste las notificaciones para este sitio. Actívalas en la configuración del navegador.</p>}
      {state === "off" && (
        <Button onClick={enable}>
          <BellRing className="size-4" />
          Activar en este dispositivo
        </Button>
      )}
      {state === "on" && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => testPushAction().then(() => toast.success("Enviamos una notificación de prueba."))}>
            <Smartphone className="size-4" />
            Enviar prueba
          </Button>
          <Button variant="ghost" onClick={disable}>
            <BellOff className="size-4" />
            Desactivar
          </Button>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Te avisamos de mensajes directos y menciones, solicitudes nuevas o respondidas, tareas asignadas, piezas para aprobar y recordatorios de seguimiento.
      </p>
    </div>
  );
}

/** Aviso discreto en el inicio para activar las notificaciones (se puede cerrar). */
export function PushBanner() {
  const { state, enable } = usePush();
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHidden(window.localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setHidden(false);
    }
  }, []);
  if (hidden || state !== "off") return null;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#d9342c]/30 bg-[#d9342c]/[0.05] px-4 py-3">
      <BellRing className="size-5 text-[#d9342c]" />
      <p className="min-w-0 flex-1 text-sm">
        <span className="font-semibold">Activa las notificaciones</span> para enterarte al instante en el celular o el computador.
      </p>
      <Button size="sm" onClick={enable} className="bg-[#d9342c] text-white hover:bg-[#c42d26]">
        Activar
      </Button>
      <button
        type="button"
        aria-label="Cerrar"
        className="text-muted-foreground hover:text-foreground"
        onClick={() => {
          setHidden(true);
          try {
            window.localStorage.setItem(DISMISS_KEY, "1");
          } catch {
            // ignorar
          }
        }}
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
