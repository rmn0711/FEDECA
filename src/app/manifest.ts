import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Fedeca",
    short_name: "Fedeca",
    description: "Nutrición, ejercicio y seguimiento para dos, en casa.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f8f6f0",
    theme_color: "#f8f6f0",
    lang: "es-CO",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Mi próxima comida", url: "/" },
      { name: "Lista de mercado", url: "/mercado" },
      { name: "Mi progreso", url: "/progreso" },
    ],
  };
}
