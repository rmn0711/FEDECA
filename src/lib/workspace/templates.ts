import type { Urgency } from "@/lib/constants";

/**
 * Plantillas de campaña: crean de una vez todas las tareas típicas con fechas
 * relativas a la fecha clave (lanzamiento, inicio de pauta, día del evento…) y
 * responsables según el área. "lider" es quien aplica la plantilla.
 */
export type TemplateRole = "lider" | "diseno" | "redes" | "crm" | "ia";

export type TemplateTask = {
  title: string;
  /** Días respecto a la fecha clave (negativo = antes) */
  offset: number;
  role: TemplateRole;
  priority?: Urgency;
  tags?: string[];
  checklist?: string[];
  description?: string;
};

export type CampaignTemplate = {
  id: string;
  name: string;
  icon: string;
  description: string;
  keyDateLabel: string;
  tasks: TemplateTask[];
};

export const ROLE_LABELS: Record<TemplateRole, string> = {
  lider: "Líder (tú)",
  diseno: "Responsable de Diseño",
  redes: "Responsable de Redes",
  crm: "Responsable de CRM",
  ia: "Responsable de IA",
};

export const TEMPLATES: CampaignTemplate[] = [
  {
    id: "lanzamiento",
    name: "Lanzamiento de proyecto",
    icon: "🚀",
    description: "De brief a informe de resultados: piezas, landing, CRM, pauta y evento de lanzamiento.",
    keyDateLabel: "Fecha de lanzamiento",
    tasks: [
      { title: "Brief de lanzamiento", offset: -30, role: "lider", priority: "alta", tags: ["Contenido"], checklist: ["Público objetivo", "Propuesta de valor", "Precio desde", "Presupuesto de pauta", "KPI de leads"] },
      { title: "Concepto creativo y key visual", offset: -25, role: "diseno", priority: "alta", tags: ["Diseño"] },
      { title: "Landing page del proyecto", offset: -15, role: "lider", tags: ["Landing page", "SEO / Web"], checklist: ["Textos", "Galería", "Formulario", "Política de datos", "Píxel y analítica"] },
      { title: "Formulario y pipeline del proyecto en el CRM", offset: -12, role: "crm", tags: ["CRM"], checklist: ["Etapas del pipeline", "Fuente de lead", "Asignación a asesores", "Respuesta automática"] },
      { title: "Calendario de publicaciones de lanzamiento", offset: -10, role: "redes", tags: ["Instagram", "Facebook", "TikTok"] },
      { title: "Material impreso para sala de ventas", offset: -10, role: "diseno", tags: ["Diseño", "Evento / feria"], checklist: ["Brochure", "Pendones", "Volantes", "Tarjetas"] },
      { title: "Piezas para redes (posts, historias y reel)", offset: -8, role: "diseno", tags: ["Diseño", "Instagram"] },
      { title: "Campaña Meta Ads", offset: -5, role: "redes", priority: "alta", tags: ["Meta Ads"], checklist: ["Audiencias", "Presupuesto", "Creativos", "Formulario instantáneo / WhatsApp"] },
      { title: "Campaña Google Ads", offset: -5, role: "redes", tags: ["Google Ads"] },
      { title: "Evento de lanzamiento", offset: 0, role: "lider", priority: "alta", tags: ["Evento / feria"] },
      { title: "Publicación del día de lanzamiento", offset: 0, role: "redes", priority: "alta", tags: ["Instagram", "Facebook", "LinkedIn"] },
      { title: "Seguimiento de leads de las primeras 48 horas", offset: 2, role: "crm", priority: "alta", tags: ["CRM"] },
      { title: "Informe de resultados semana 1", offset: 7, role: "lider", tags: ["Analítica"], checklist: ["Leads por canal", "CPL", "Visitas a sala", "Aprendizajes"] },
    ],
  },
  {
    id: "pauta",
    name: "Campaña de pauta digital",
    icon: "📈",
    description: "Objetivo, audiencias, creativos, configuración, medición y optimización.",
    keyDateLabel: "Inicio de la pauta",
    tasks: [
      { title: "Objetivo, presupuesto y KPI de la campaña", offset: -10, role: "lider", priority: "alta", tags: ["Analítica"] },
      { title: "Audiencias y segmentación", offset: -7, role: "redes", tags: ["Meta Ads", "Google Ads"] },
      { title: "Creativos y copies (3 variantes)", offset: -5, role: "diseno", tags: ["Diseño"] },
      { title: "Píxel, conversiones y fuente en el CRM", offset: -3, role: "crm", tags: ["CRM", "Analítica"] },
      { title: "Configurar y publicar campañas", offset: 0, role: "redes", priority: "alta", tags: ["Meta Ads", "Google Ads"] },
      { title: "Optimización semana 1", offset: 7, role: "redes", tags: ["Meta Ads"] },
      { title: "Informe final de la campaña", offset: 30, role: "lider", tags: ["Analítica"] },
    ],
  },
  {
    id: "evento",
    name: "Evento / feria",
    icon: "🎪",
    description: "Logística, material, captura de leads, cubrimiento en vivo y seguimiento comercial.",
    keyDateLabel: "Día del evento",
    tasks: [
      { title: "Reserva, logística y presupuesto del evento", offset: -21, role: "lider", priority: "alta", tags: ["Evento / feria"] },
      { title: "Material POP y stand", offset: -14, role: "diseno", tags: ["Diseño", "Evento / feria"] },
      { title: "Formulario de captura de leads (con autorización de datos)", offset: -7, role: "crm", tags: ["CRM"] },
      { title: "Publicaciones de expectativa", offset: -5, role: "redes", tags: ["Instagram", "Facebook"] },
      { title: "Cubrimiento en vivo (historias y reel)", offset: 0, role: "redes", priority: "alta", tags: ["Instagram", "TikTok"] },
      { title: "Carga de leads al CRM", offset: 1, role: "crm", priority: "alta", tags: ["CRM"] },
      { title: "Seguimiento comercial de los leads del evento", offset: 3, role: "crm", tags: ["CRM", "WhatsApp"] },
      { title: "Informe del evento", offset: 5, role: "lider", tags: ["Analítica"] },
    ],
  },
  {
    id: "contenido",
    name: "Mes de contenido",
    icon: "🗓️",
    description: "Planeación, producción semanal, aprobación e informe del calendario editorial.",
    keyDateLabel: "Primer día del mes",
    tasks: [
      { title: "Planear el calendario editorial del mes", offset: -10, role: "redes", priority: "alta", tags: ["Contenido"] },
      { title: "Aprobar el calendario editorial", offset: -7, role: "lider", tags: ["Contenido"] },
      { title: "Producción de piezas — semana 1", offset: -3, role: "diseno", tags: ["Diseño"] },
      { title: "Producción de piezas — semana 2", offset: 4, role: "diseno", tags: ["Diseño"] },
      { title: "Producción de piezas — semana 3", offset: 11, role: "diseno", tags: ["Diseño"] },
      { title: "Producción de piezas — semana 4", offset: 18, role: "diseno", tags: ["Diseño"] },
      { title: "Informe mensual de redes", offset: 30, role: "redes", tags: ["Analítica"] },
    ],
  },
];

export function getTemplate(id: string) {
  return TEMPLATES.find((t) => t.id === id);
}
