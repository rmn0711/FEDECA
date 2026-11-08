// Formato Colombia: coma decimal, punto de miles.
const nf = (d: number) =>
  new Intl.NumberFormat("es-CO", { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: true });

const cache = new Map<number, Intl.NumberFormat>();
function fmt(d: number) {
  let f = cache.get(d);
  if (!f) {
    f = nf(d);
    cache.set(d, f);
  }
  return f;
}

/** Número con coma decimal. 1234.5 → "1.234,5" (es-CO agrupa miles desde 5 dígitos; forzamos manualmente). */
export function num(n: number | null | undefined, decimals = 0): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const fixed = Math.abs(n).toFixed(decimals);
  const [intPart, decPart] = fixed.split(".");
  const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const sign = n < 0 && Number(fixed) !== 0 ? "−" : "";
  return sign + withThousands + (decPart ? "," + decPart : "");
}

export const kg = (n: number | null | undefined, d = 1) => (n == null ? "—" : `${num(n, d)} kg`);
export const g = (n: number | null | undefined, d = 0) => (n == null ? "—" : `${num(n, d)} g`);
export const kcal = (n: number | null | undefined) => (n == null ? "—" : `${num(Math.round(n))} kcal`);
export const pct = (n: number | null | undefined, d = 1) => (n == null ? "—" : `${num(n, d)} %`);
export const cm = (n: number | null | undefined, d = 1) => (n == null ? "—" : `${num(n, d)} cm`);

/** Parsea entradas con coma o punto decimal. */
export function parseNum(s: string): number | null {
  const t = s.trim().replace(/\s/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** "13:00" → "1:00 p. m." */
export function time12(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "p. m." : "a. m.";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

export const timeToMin = (hhmm: string): number => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
export const minToTime = (min: number): string => {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

/* ───────────── Fechas en hora de Bogotá (UTC−5, sin horario de verano) ───────────── */

const TZ = "America/Bogota";

export function bogotaParts(d: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  const hour = get("hour") === "24" ? "00" : get("hour");
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${hour}:${get("minute")}`,
  };
}

export const todayISO = (d: Date = new Date()) => bogotaParts(d).date;
export const nowHHMM = (d: Date = new Date()) => bogotaParts(d).time;

/** Convierte ISO "yyyy-mm-dd" a milisegundos UTC (medianoche UTC; solo para aritmética de días). */
const isoToUTC = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};

export const addDays = (iso: string, n: number): string => {
  const t = new Date(isoToUTC(iso) + n * 86400000);
  return t.toISOString().slice(0, 10);
};

export const daysBetween = (a: string, b: string): number => Math.round((isoToUTC(b) - isoToUTC(a)) / 86400000);

/** 0 = domingo … 6 = sábado */
export const weekday = (iso: string): number => new Date(isoToUTC(iso)).getUTCDay();

/** Lunes de la semana (la semana va de lunes a domingo). */
export const weekStart = (iso: string): string => {
  const wd = weekday(iso);
  return addDays(iso, -((wd + 6) % 7));
};

export const WEEKDAY_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
export const WEEKDAY_LONG = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export function longDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${WEEKDAY_LONG[weekday(iso)]} ${d} de ${MONTHS[m - 1]}${y !== new Date().getUTCFullYear() ? ` de ${y}` : ""}`;
}
export function shortDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1].slice(0, 3)}`;
}

/** Referencia para `nf` por si se necesita Intl directo. */
export const intl = fmt;
