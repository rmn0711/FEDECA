import { timingSafeEqual } from "node:crypto";

/** Compara un secreto en tiempo constante (no revela cuántos caracteres coinciden). */
export function secretMatches(given: string | null | undefined, expected: string | null | undefined) {
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Solo rutas internas ("/algo"): evita redirigir a otro sitio con "//sitio" o "/\sitio". */
export function safeNextPath(next: unknown) {
  const n = typeof next === "string" ? next : "";
  return n.startsWith("/") && !n.startsWith("//") && !/[\\\s\x00-\x1f]/.test(n) ? n : "/dashboard";
}

/** Servicios de notificaciones push de los navegadores (Chrome/Edge, Firefox, Safari, Windows). */
const PUSH_HOSTS = [/\.googleapis\.com$/, /\.mozilla\.com$/, /\.mozaws\.net$/, /\.push\.apple\.com$/, /\.notify\.windows\.com$/];

export function isPushEndpoint(endpoint: string) {
  try {
    const u = new URL(endpoint);
    return u.protocol === "https:" && PUSH_HOSTS.some((h) => h.test(u.hostname));
  } catch {
    return false;
  }
}
