export const ORG_NAME = process.env.NEXT_PUBLIC_ORG_NAME || "Constructora ACF";
export const APP_NAME = "Conecta";

/** Variantes del Badge (mismas del cotizador). */
export type BadgeVariant = "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info" | "neutral";

export const ROLES = ["admin", "agent", "user"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrador",
  agent: "Responsable",
  user: "Solicitante",
};

export const URGENCIES = ["alta", "media", "baja"] as const;
export type Urgency = (typeof URGENCIES)[number];

/**
 * Prioridades y acuerdos de nivel de servicio (ANS). Los tiempos se cuentan
 * en horas hábiles (ver BUSINESS_HOURS): una solicitud registrada un viernes
 * a las 4:00 p. m. con prioridad media vence el martes a las 2:00 p. m.
 */
export const URGENCY_META: Record<
  Urgency,
  {
    label: string;
    /** Horas hábiles para la primera respuesta */
    responseHours: number;
    /** Horas hábiles para la solución */
    slaHours: number;
    responseLabel: string;
    slaLabel: string;
    definition: string;
    examples: string[];
    variant: BadgeVariant;
    dot: string;
  }
> = {
  alta: {
    label: "Alta",
    responseHours: 1,
    slaHours: 4,
    responseLabel: "1 hora hábil",
    slaLabel: "4 horas hábiles (mismo día)",
    definition:
      "La operación está detenida o hay impacto directo en clientes, ventas o en varias personas, y no existe una alternativa para continuar trabajando.",
    examples: [
      "SINCO no permite facturar, pagar o aprobar y hay un vencimiento hoy",
      "Sin internet, correo o equipo para trabajar",
      "Cotización o pieza que se debe entregar a un cliente hoy",
      "Publicación urgente o crisis en redes sociales",
    ],
    variant: "destructive",
    dot: "bg-[#d9342c]",
  },
  media: {
    label: "Media",
    responseHours: 4,
    slaHours: 16,
    responseLabel: "4 horas hábiles",
    slaLabel: "2 días hábiles",
    definition:
      "Afecta parcialmente el trabajo de una persona o un área, pero existe una alternativa temporal o la fecha de entrega permite planificarlo.",
    examples: [
      "Error en un módulo de SINCO con un procedimiento alterno",
      "Impresora o programa que falla de forma intermitente",
      "Pieza gráfica o publicación para esta semana",
      "Ajuste de una cotización existente",
    ],
    variant: "warning",
    dot: "bg-[#eb6834]",
  },
  baja: {
    label: "Baja",
    responseHours: 8,
    slaHours: 40,
    responseLabel: "1 día hábil",
    slaLabel: "5 días hábiles",
    definition:
      "Consultas, mejoras, capacitaciones o solicitudes planificadas que no impiden trabajar.",
    examples: [
      "Capacitación en una herramienta o en SINCO",
      "Nuevo reporte, mejora o automatización con IA",
      "Instalación de software no urgente o solicitud de equipo",
      "Contenido de redes para el calendario del próximo mes",
    ],
    variant: "neutral",
    dot: "bg-[#6b6b6e]",
  },
};

/** Jornada laboral usada para calcular los tiempos de respuesta (hora de Colombia, UTC-5 sin horario de verano). */
export const BUSINESS_HOURS = { startHour: 8, endHour: 17, workDays: [1, 2, 3, 4, 5], utcOffsetHours: -5 };

/** Suma horas hábiles a una fecha respetando la jornada laboral. */
export function addBusinessHours(from: Date, hours: number): Date {
  const { startHour, endHour, workDays, utcOffsetHours } = BUSINESS_HOURS;
  const offset = utcOffsetHours * 3_600_000;
  // Se trabaja en "hora local" representada como UTC para no depender de la zona del servidor.
  let t = from.getTime() + offset;
  let remaining = Math.round(hours * 60) * 60_000;
  const dayStart = (ms: number) => ms - (ms % 86_400_000);
  for (let guard = 0; guard < 1000 && remaining > 0; guard++) {
    const d = new Date(t);
    const base = dayStart(t);
    const open = base + startHour * 3_600_000;
    const close = base + endHour * 3_600_000;
    if (!workDays.includes(d.getUTCDay()) || t >= close) {
      t = dayStart(t) + 86_400_000 + startHour * 3_600_000;
      continue;
    }
    if (t < open) t = open;
    const available = close - t;
    const used = Math.min(available, remaining);
    t += used;
    remaining -= used;
  }
  return new Date(t - offset);
}

export const STATUSES = ["abierto", "en_progreso", "en_espera", "resuelto", "cerrado"] as const;
export type Status = (typeof STATUSES)[number];

export const STATUS_META: Record<Status, { label: string; variant: BadgeVariant; description: string }> = {
  abierto: {
    label: "Abierto",
    variant: "info",
    description: "Recibido, pendiente de atención",
  },
  en_progreso: {
    label: "En progreso",
    variant: "warning",
    description: "El responsable está trabajando en la solicitud",
  },
  en_espera: {
    label: "En espera",
    variant: "neutral",
    description: "Esperando información del solicitante o de un tercero",
  },
  resuelto: {
    label: "Resuelto",
    variant: "success",
    description: "Solución entregada, pendiente de confirmación",
  },
  cerrado: {
    label: "Cerrado",
    variant: "outline",
    description: "Solicitud finalizada",
  },
};

export const OPEN_STATUSES: Status[] = ["abierto", "en_progreso", "en_espera"];

export const MAX_FILES = 5;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export function ticketCode(id: number) {
  return `HD-${String(id).padStart(5, "0")}`;
}

export function parseTicketCode(text: string): number | null {
  const m = /HD-(\d{1,9})/i.exec(text);
  return m ? Number(m[1]) : null;
}

export function appUrl(path = "") {
  const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  return `${base}${path}`;
}
