import Link from "next/link";
import { Plus } from "lucide-react";
import { isStaff, requireUser } from "@/lib/auth";
import { unreadTotal } from "@/lib/chat/service";
import { getAlerts } from "@/lib/alerts";
import { AlertsButton } from "@/components/shared/alerts-button";
import { CaptureButton } from "@/components/followups/capture-button";
import { getStaff } from "@/lib/tickets/queries";
import { projectOptions } from "@/lib/followups/service";
import { SessionProvider } from "@/components/shared/session-provider";
import { AppSidebar, AppSidebarMobile } from "@/components/shared/app-sidebar";
import { Button } from "@/components/ui/button";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const unreadChat = isStaff(user) ? await unreadTotal(user).catch(() => 0) : 0;
  // Si las alertas fallan, la barra superior no debe tumbar toda la app (igual que en el cotizador).
  const [team, teamProjects] = isStaff(user) ? await Promise.all([getStaff(), projectOptions()]) : [[], []];
  const alerts = await getAlerts(user).catch((error) => {
    console.error("No se pudieron cargar las alertas:", error);
    return { alerts: [], total: 0, overdue: 0 };
  });

  return (
    <SessionProvider
      session={{ id: user.id, name: user.name, email: user.email, role: user.role, department: user.department, unreadChat }}
    >
      <div className="flex min-h-screen">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Barra superior "glass" del cotizador. */}
          <header className="sticky top-3 z-20 mx-3 mt-3 flex h-14 items-center gap-2 rounded-2xl border border-white/10 bg-[#19191b]/90 px-3 text-white shadow-[0_10px_40px_rgba(0,0,0,0.35)] backdrop-blur-2xl md:mx-6 md:px-4">
            <AppSidebarMobile />
            <p className="text-sm font-semibold tracking-wide text-white/90">
              Conecta <span className="text-[#ff5a50]">ACF</span>
            </p>
            <div className="ml-auto flex items-center gap-2">
              {isStaff(user) && (
                <CaptureButton
                  members={team.filter((t) => t.id !== user.id).map((t) => ({ id: t.id, name: t.name }))}
                  projects={teamProjects}
                  className="border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                />
              )}
              <AlertsButton initial={alerts} className="border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white" />
              <Button
                size="sm"
                className="bg-[#d9342c] text-white shadow-[0_6px_20px_rgba(217,52,44,0.45)] hover:bg-[#c42d26]"
                render={
                  <Link href="/solicitudes/nueva">
                    <Plus className="size-4" />
                    <span className="hidden sm:inline">Nueva solicitud</span>
                  </Link>
                }
              />
            </div>
          </header>
          <main className="min-w-0 flex-1 px-4 py-6 md:px-6 md:py-8">{children}</main>
        </div>
      </div>
    </SessionProvider>
  );
}
