import type { Metadata, Viewport } from "next";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/schibsted-grotesk";
import "./globals.css";
import { AppProvider } from "@/lib/app-context";
import { Shell } from "@/components/Shell";
import { SwRegister } from "@/components/SwRegister";

export const metadata: Metadata = {
  title: { default: "Fedeca", template: "%s · Fedeca" },
  description: "Nutrición, ejercicio y seguimiento para dos, en casa.",
  applicationName: "Fedeca",
  appleWebApp: { capable: true, title: "Fedeca", statusBarStyle: "default" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#f8f6f0",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CO">
      <body>
        <SwRegister />
        <AppProvider>
          <Shell>{children}</Shell>
        </AppProvider>
      </body>
    </html>
  );
}
