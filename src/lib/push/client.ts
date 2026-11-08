"use client";
import { isSupabaseConfigured, supabaseBrowser } from "../supabase/client";

const b64ToUint8 = (b64: string) => {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

export type PushResult = "ok" | "unsupported" | "denied" | "no-key" | "no-supabase" | "error";

/** Pide permiso, suscribe el dispositivo y guarda la suscripción (RLS por hogar). */
export async function enablePush(householdId: string, profileId: string | null): Promise<PushResult> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key) return "no-key";
  if (!isSupabaseConfigured) return "no-supabase";
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return "denied";
  try {
    const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js"));
    await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(key) }));
    const json = sub.toJSON();
    const sb = supabaseBrowser();
    const { data: u } = await sb.auth.getUser();
    if (!u.user) return "error";
    const { error } = await sb.from("push_subscriptions").upsert({ household_id: householdId, user_id: u.user.id, profile_id: profileId, endpoint: json.endpoint, p256dh: json.keys?.p256dh, auth: json.keys?.auth }, { onConflict: "endpoint" });
    return error ? "error" : "ok";
  } catch {
    return "error";
  }
}

export async function pushEnabled(): Promise<boolean> {
  if (!("serviceWorker" in navigator)) return false;
  const reg = await navigator.serviceWorker.getRegistration();
  return Boolean(await reg?.pushManager.getSubscription());
}
