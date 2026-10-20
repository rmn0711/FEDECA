export const CHAT_STICKERS = [
  { id: "listo", label: "¡Listo!", emoji: "✅", color: "#dcfce7", ink: "#166534" },
  { id: "gracias", label: "¡Gracias!", emoji: "🙌", color: "#fef3c7", ink: "#92400e" },
  { id: "recibido", label: "Recibido", emoji: "👍", color: "#dbeafe", ink: "#1e40af" },
  { id: "vamos", label: "¡Vamos!", emoji: "🚀", color: "#ede9fe", ink: "#6d28d9" },
  { id: "buen-trabajo", label: "¡Buen trabajo!", emoji: "⭐", color: "#ffedd5", ink: "#9a3412" },
  { id: "en-proceso", label: "En proceso", emoji: "⚙️", color: "#e0f2fe", ink: "#075985" },
  { id: "genial", label: "¡Genial!", emoji: "🎉", color: "#fce7f3", ink: "#9d174d" },
  { id: "cafe", label: "Un cafecito", emoji: "☕", color: "#f5ebe0", ink: "#78350f" },
] as const;

export type ChatSticker = (typeof CHAT_STICKERS)[number];

export function stickerSource(sticker: ChatSticker) {
  return `/stickers/${sticker.id}.svg`;
}

export function stickerMessage(id: string) {
  if (!CHAT_STICKERS.some((sticker) => sticker.id === id)) throw new Error("Sticker no disponible.");
  return `[[conecta-sticker:${id}]]`;
}

/** Solo interpreta mensajes completos del catálogo; el resto conserva su texto normal. */
export function messageSticker(body: string): ChatSticker | undefined {
  return CHAT_STICKERS.find((sticker) => body === `[[conecta-sticker:${sticker.id}]]`);
}

export function isUploadedSticker(file: { filename: string; mime: string }) {
  return file.filename.startsWith("sticker-") && ["image/png", "image/webp", "image/gif", "image/jpeg"].includes(file.mime);
}
