/**
 * Catálogo de categorías de la mesa de ayuda y los campos específicos que
 * se solicitan en cada una. El responsable de cada categoría se asigna desde
 * Administración → Categorías y responsables (se guarda en la base de datos).
 */

export type FieldType = "text" | "textarea" | "select" | "multiselect" | "date" | "datetime" | "number" | "url";

export interface CategoryField {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
  placeholder?: string;
  help?: string;
  /** Ocupa todo el ancho del formulario */
  wide?: boolean;
}

export interface CategoryDef {
  slug: string;
  name: string;
  description: string;
  icon: "palette" | "sparkles" | "calculator" | "megaphone" | "monitor" | "database" | "contact";
  /** Clases de color para el ícono (paleta de marca ACF, igual que el cotizador) */
  accent: string;
  titlePlaceholder: string;
  descriptionPlaceholder: string;
  fields: CategoryField[];
}

export const CATEGORIES: CategoryDef[] = [
  {
    slug: "diseno",
    name: "Diseño gráfico",
    description: "Piezas gráficas, presentaciones, material impreso, identidad visual y video.",
    icon: "palette",
    accent: "bg-[#d9342c]/10 text-[#d9342c] ring-[#d9342c]/15",
    titlePlaceholder: "Ej: Pieza para lanzamiento del proyecto Torres del Parque",
    descriptionPlaceholder:
      "Describa el objetivo de la pieza, el público al que va dirigida, el mensaje principal y cualquier lineamiento a tener en cuenta.",
    fields: [
      {
        key: "tipo_pieza",
        label: "Tipo de pieza",
        type: "select",
        required: true,
        options: [
          "Post para redes sociales",
          "Flyer / volante",
          "Brochure / catálogo",
          "Presentación corporativa",
          "Pendón / valla / banner",
          "Logo / identidad visual",
          "Tarjeta de presentación",
          "Firma de correo",
          "Infografía",
          "Video / animación",
          "Otro",
        ],
      },
      {
        key: "formato",
        label: "Formato de salida",
        type: "select",
        required: true,
        options: ["Digital", "Impreso", "Digital e impreso"],
      },
      { key: "medidas", label: "Medidas / dimensiones", type: "text", placeholder: "Ej: 1080 x 1350 px, 1 x 2 m" },
      { key: "cantidad", label: "Cantidad de piezas o versiones", type: "number", placeholder: "1" },
      { key: "fecha_entrega", label: "Fecha requerida de entrega", type: "date", required: true },
      {
        key: "marca",
        label: "Marca / línea",
        type: "select",
        options: ["Marca corporativa", "Proyecto / sub-marca", "Evento", "Campaña interna"],
      },
      {
        key: "textos",
        label: "Textos que debe incluir la pieza",
        type: "textarea",
        wide: true,
        placeholder: "Título, subtítulo, llamado a la acción, datos de contacto, legales…",
      },
      {
        key: "referencias",
        label: "Enlaces de referencia",
        type: "url",
        wide: true,
        placeholder: "https://… (Drive, Pinterest, Behance, piezas anteriores)",
      },
    ],
  },
  {
    slug: "ia",
    name: "Inteligencia Artificial",
    description: "Automatizaciones, asistentes, análisis con IA, licencias y capacitación en herramientas.",
    icon: "sparkles",
    accent: "bg-[#2a78d6]/10 text-[#1c5cab] ring-[#2a78d6]/15 dark:text-[#6ba6ec]",
    titlePlaceholder: "Ej: Automatizar el resumen semanal de informes de obra",
    descriptionPlaceholder:
      "Cuéntenos qué necesita lograr con IA, quiénes lo usarán y cómo se hace hoy.",
    fields: [
      {
        key: "tipo_solicitud",
        label: "Tipo de solicitud",
        type: "select",
        required: true,
        options: [
          "Automatización de un proceso",
          "Asistente / chatbot",
          "Análisis de datos o documentos",
          "Generación de contenido",
          "Licencia o acceso a herramienta de IA",
          "Capacitación / acompañamiento",
          "Error o falla en una solución de IA",
          "Otro",
        ],
      },
      {
        key: "herramienta",
        label: "Herramienta relacionada",
        type: "select",
        options: ["Claude", "ChatGPT", "Microsoft Copilot", "Gemini", "Otra", "Por definir"],
      },
      {
        key: "frecuencia",
        label: "Frecuencia de uso",
        type: "select",
        options: ["Diaria", "Semanal", "Mensual", "Una única vez"],
      },
      { key: "usuarios", label: "Número de usuarios beneficiados", type: "number", placeholder: "Ej: 5" },
      {
        key: "datos_sensibles",
        label: "¿Involucra información confidencial o datos personales?",
        type: "select",
        required: true,
        options: ["No", "Sí", "No estoy seguro"],
        help: "Nos permite definir las herramientas y controles adecuados.",
      },
      {
        key: "proceso_actual",
        label: "¿Cómo se hace hoy?",
        type: "textarea",
        wide: true,
        placeholder: "Pasos, tiempo que toma, herramientas que utiliza…",
      },
      {
        key: "resultado_esperado",
        label: "Resultado esperado",
        type: "textarea",
        required: true,
        wide: true,
        placeholder: "¿Qué debería entregar la solución y cómo sabremos que funciona?",
      },
    ],
  },
  {
    slug: "cotizador",
    name: "Cotizador",
    description: "Cotizaciones, ajustes, actualización de precios, accesos y fallas del cotizador.",
    icon: "calculator",
    accent: "bg-[#1a7f4e]/10 text-[#1a7f4e] ring-[#1a7f4e]/15 dark:text-[#4fd3a3]",
    titlePlaceholder: "Ej: Ajuste de tarifas en cotización para cliente Constructora ABC",
    descriptionPlaceholder:
      "Indique el detalle de lo que necesita cotizar o ajustar, condiciones especiales y cualquier observación del cliente.",
    fields: [
      {
        key: "tipo_solicitud",
        label: "Tipo de solicitud",
        type: "select",
        required: true,
        options: [
          "Nueva cotización",
          "Ajuste a cotización existente",
          "Actualización de precios / tarifas",
          "Error o falla en el cotizador",
          "Acceso / usuario del cotizador",
          "Capacitación",
        ],
      },
      { key: "cliente", label: "Cliente", type: "text", placeholder: "Nombre o razón social", required: true },
      { key: "nit", label: "NIT / documento del cliente", type: "text", placeholder: "Ej: 900.123.456-7" },
      { key: "producto", label: "Producto / servicio / proyecto", type: "text", placeholder: "¿Qué se cotiza?" },
      { key: "numero_cotizacion", label: "N.º de cotización (si existe)", type: "text", placeholder: "Ej: COT-2026-0451" },
      { key: "valor_estimado", label: "Valor estimado (COP)", type: "number", placeholder: "Ej: 25000000" },
      { key: "fecha_requerida", label: "Fecha límite para enviar al cliente", type: "date", required: true },
      {
        key: "condiciones",
        label: "Condiciones comerciales especiales",
        type: "textarea",
        wide: true,
        placeholder: "Descuentos, forma de pago, anticipos, vigencia…",
      },
    ],
  },
  {
    slug: "crm",
    name: "CRM",
    description: "Contactos, pipeline de negocios, tareas, reportes, usuarios y automatizaciones del CRM.",
    icon: "contact",
    accent: "bg-[#0f8a8a]/10 text-[#0f8a8a] ring-[#0f8a8a]/15 dark:text-[#4fd3d3]",
    titlePlaceholder: "Ej: Importar base de contactos de la feria inmobiliaria al pipeline",
    descriptionPlaceholder:
      "Explique qué necesita en el CRM, en qué contacto, negocio o pantalla ocurre y qué resultado espera.",
    fields: [
      {
        key: "tipo",
        label: "Tipo de solicitud",
        type: "select",
        required: true,
        options: [
          "Error / falla",
          "Creación de usuario o permisos",
          "Importar o depurar contactos",
          "Pipeline / etapas de negocio",
          "Reporte o tablero",
          "Automatización / integración (WhatsApp, correo, formularios)",
          "Capacitación",
          "Mejora / nueva funcionalidad",
        ],
      },
      {
        key: "modulo",
        label: "Módulo",
        type: "select",
        required: true,
        options: ["Contactos", "Pipeline", "Tareas", "Reportes", "Conversaciones", "Otro"],
      },
      { key: "proyecto", label: "Proyecto / campaña", type: "text", placeholder: "Ej: Torres del Parque" },
      { key: "registro", label: "Contacto o negocio afectado", type: "text", placeholder: "Nombre del contacto o del negocio" },
      { key: "usuario_crm", label: "Usuario del CRM afectado", type: "text", placeholder: "Ej: asesor@acfcia.com" },
      { key: "fecha_requerida", label: "Fecha requerida", type: "date" },
      {
        key: "mensaje_error",
        label: "Mensaje de error / pasos para reproducir",
        type: "textarea",
        wide: true,
        placeholder: "Texto exacto del error y los pasos que realizó",
      },
    ],
  },
  {
    slug: "redes",
    name: "Redes sociales",
    description: "Publicaciones, pauta, historias, transmisiones y gestión de comunidad.",
    icon: "megaphone",
    accent: "bg-[#eb6834]/10 text-[#b84f22] ring-[#eb6834]/15 dark:text-[#f0925f]",
    titlePlaceholder: "Ej: Publicación sobre la entrega de apartamentos etapa 2",
    descriptionPlaceholder:
      "Describa qué se quiere comunicar, el contexto y los resultados esperados de la publicación o campaña.",
    fields: [
      {
        key: "redes",
        label: "Redes sociales",
        type: "multiselect",
        required: true,
        options: ["Instagram", "Facebook", "LinkedIn", "TikTok", "YouTube", "X (Twitter)", "WhatsApp"],
      },
      {
        key: "tipo_publicacion",
        label: "Tipo de publicación",
        type: "select",
        required: true,
        options: [
          "Post (imagen)",
          "Carrusel",
          "Historia",
          "Reel / video corto",
          "Pauta pagada",
          "Transmisión en vivo",
          "Respuesta a comentarios / mensajes",
          "Informe de resultados",
        ],
      },
      {
        key: "objetivo",
        label: "Objetivo",
        type: "select",
        options: ["Informar", "Promocionar / vender", "Evento", "Reconocimiento de marca", "Reclutamiento", "Comunicación interna"],
      },
      { key: "fecha_publicacion", label: "Fecha y hora de publicación", type: "datetime", required: true },
      { key: "presupuesto", label: "Presupuesto de pauta (COP)", type: "number", placeholder: "Opcional" },
      {
        key: "material",
        label: "Material gráfico",
        type: "select",
        required: true,
        options: ["Lo adjunto en esta solicitud", "Requiere diseño (se coordina con Diseño gráfico)", "Usar material existente"],
      },
      {
        key: "copy",
        label: "Texto / copy sugerido",
        type: "textarea",
        wide: true,
        placeholder: "Mensaje, hashtags, menciones, enlace de destino…",
      },
    ],
  },
  {
    slug: "sistemas",
    name: "Sistemas",
    description: "Equipos, software, red, correo, usuarios, accesos, telefonía y seguridad.",
    icon: "monitor",
    accent: "bg-[#222224]/[0.06] text-[#222224] ring-[#222224]/10 dark:bg-white/10 dark:text-white",
    titlePlaceholder: "Ej: El computador no enciende después de la actualización",
    descriptionPlaceholder:
      "Describa el problema: qué estaba haciendo, qué mensaje aparece, desde cuándo ocurre y qué ha intentado.",
    fields: [
      {
        key: "tipo",
        label: "Tipo de solicitud",
        type: "select",
        required: true,
        options: [
          "Equipo de cómputo / hardware",
          "Impresora / escáner",
          "Instalación o falla de software",
          "Red / internet / VPN",
          "Correo electrónico / Microsoft 365",
          "Creación de usuario / accesos / contraseñas",
          "Telefonía / celular corporativo",
          "Seguridad (virus, correo sospechoso)",
          "Compra o asignación de equipo",
          "Otro",
        ],
      },
      { key: "activo", label: "Placa / serial del equipo", type: "text", placeholder: "Ej: PC-0142" },
      { key: "ubicacion", label: "Sede / oficina / obra", type: "text", required: true, placeholder: "Ej: Oficina principal, piso 3" },
      {
        key: "afectados",
        label: "¿A quién afecta?",
        type: "select",
        required: true,
        options: ["Solo a mí", "A mi área", "A varias áreas", "A toda la empresa"],
      },
      {
        key: "puede_trabajar",
        label: "¿Puede seguir trabajando?",
        type: "select",
        required: true,
        options: ["Sí", "Parcialmente", "No"],
      },
      { key: "acceso_remoto", label: "ID de acceso remoto (AnyDesk / TeamViewer)", type: "text", placeholder: "Opcional" },
      {
        key: "mensaje_error",
        label: "Mensaje de error (si aparece)",
        type: "textarea",
        wide: true,
        placeholder: "Copie el texto exacto o adjunte una captura de pantalla",
      },
    ],
  },
  {
    slug: "sinco",
    name: "Sinco Soft",
    description: "ERP SINCO: módulos, usuarios y permisos, errores, reportes, parametrización y capacitación.",
    icon: "database",
    accent: "bg-[#6b6b6e]/10 text-[#6b6b6e] ring-[#6b6b6e]/15 dark:text-white/70",
    titlePlaceholder: "Ej: Error al aprobar orden de compra en el módulo de Compras",
    descriptionPlaceholder:
      "Explique qué necesita o qué está fallando en SINCO, en qué pantalla y con qué datos.",
    fields: [
      {
        key: "modulo",
        label: "Módulo",
        type: "select",
        required: true,
        options: [
          "Contabilidad",
          "Tesorería",
          "Presupuesto / control de obra (ADPRO)",
          "Compras",
          "Inventarios / almacén",
          "Contratos / subcontratos",
          "Nómina",
          "Facturación",
          "Activos fijos",
          "Comercial / ventas (CBR)",
          "Postventa / PQR",
          "Otro",
        ],
      },
      {
        key: "tipo",
        label: "Tipo de solicitud",
        type: "select",
        required: true,
        options: [
          "Error / falla",
          "Creación de usuario o permisos",
          "Reporte / informe",
          "Parametrización / configuración",
          "Capacitación",
          "Mejora / desarrollo",
        ],
      },
      { key: "empresa", label: "Empresa / proyecto / obra", type: "text", required: true, placeholder: "Ej: Proyecto Altos del Río" },
      { key: "usuario_sinco", label: "Usuario SINCO afectado", type: "text", placeholder: "Ej: jperez" },
      { key: "documento", label: "N.º de documento / comprobante", type: "text", placeholder: "Ej: OC-15873, CE-2201" },
      {
        key: "mensaje_error",
        label: "Mensaje de error",
        type: "textarea",
        wide: true,
        placeholder: "Copie el texto exacto del mensaje",
      },
      {
        key: "pasos",
        label: "Pasos para reproducir",
        type: "textarea",
        wide: true,
        placeholder: "1. Ingresé a…  2. Seleccioné…  3. Al guardar aparece…",
      },
    ],
  },
];

export function getCategory(slug: string): CategoryDef | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}

/** Convierte el valor guardado de un campo a texto legible. */
export function formatFieldValue(field: CategoryField, value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  if (Array.isArray(value)) return value.join(", ");
  const s = String(value);
  // Las fechas se guardan tal como las escribe el usuario (sin zona horaria),
  // por eso se interpretan y muestran en UTC para no desplazarlas.
  if (field.type === "date") {
    const d = new Date(`${s}T00:00:00Z`);
    return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString("es-CO", { dateStyle: "long", timeZone: "UTC" });
  }
  if (field.type === "datetime") {
    const d = new Date(`${s}Z`);
    return Number.isNaN(d.getTime())
      ? s
      : d.toLocaleString("es-CO", { dateStyle: "long", timeStyle: "short", timeZone: "UTC" });
  }
  if (field.type === "number" && /valor|presupuesto/.test(field.key)) {
    const n = Number(s);
    return Number.isFinite(n)
      ? n.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 })
      : s;
  }
  return s;
}
