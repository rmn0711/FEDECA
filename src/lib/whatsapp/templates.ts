/**
 * Mensajes de WhatsApp que se envían desde el número del líder (sin API de Meta: el servicio
 * vinculado los envía como si los escribiera él, o se envían a mano con el botón).
 * Formato de WhatsApp: *negrita*, _cursiva_.
 */
export type WaPref = "solicitudes" | "mis_solicitudes" | "tareas" | "recordatorios" | "resumen";

export const WA_PREF_LABELS: Record<WaPref, { label: string; description: string; staffOnly?: boolean }> = {
  mis_solicitudes: { label: "Mis solicitudes", description: "Respuestas y cambios de estado en las solicitudes que yo radiqué" },
  solicitudes: { label: "Solicitudes a mi cargo", description: "Nuevas, asignadas, respondidas por el solicitante y vencidas", staffOnly: true },
  tareas: { label: "Tareas y aprobaciones", description: "Tareas asignadas y piezas para aprobar o con decisión", staffOnly: true },
  recordatorios: { label: "Recordatorios de seguimiento", description: "Los seguimientos que programé, a la hora indicada", staffOnly: true },
  resumen: { label: "Resumen diario", description: "Lo vencido y lo que vence hoy, a las 7:00 a. m.", staffOnly: true },
};

export const WA_FOOTER = "_Conecta ACF · responde este mensaje para agregar un comentario · escribe BAJA para no recibir más alertas_";

/** Une las líneas de un mensaje y agrega el pie. */
export function waMessage(lines: Array<string | null | undefined | false>, footer = true) {
  return [...lines.filter(Boolean), "", footer ? WA_FOOTER : null].filter((l) => l !== null).join("\n").trim();
}
