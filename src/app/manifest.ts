import type { MetadataRoute } from "next";

// Permite instalar la plataforma en el celular (necesario para notificaciones en iPhone).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mesa de Ayuda ACF",
    short_name: "Mesa ACF",
    description: "Mesa de ayuda, espacio de equipo y chat de Constructora ACF",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#19191b",
    theme_color: "#19191b",
    lang: "es",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
