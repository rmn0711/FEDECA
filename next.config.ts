import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  serverExternalPackages: ["@electric-sql/pglite"],
  experimental: {
    serverActions: {
      // Permite adjuntar archivos en las solicitudes (máx. 5 archivos de 10 MB).
      bodySizeLimit: "55mb",
    },
    proxyClientMaxBodySize: "55mb",
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

export default nextConfig;
