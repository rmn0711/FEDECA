"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import {
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  PlusCircle,
  Settings,
  Tags,
  Timer,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/constants";
import { logout } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useSession } from "@/components/shared/session-provider";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type NavLink = { href: string; label: string; icon: LucideIcon };
type NavGroup = { label: string; links: NavLink[] };

// Igual que en el cotizador: el colapso es una preferencia de este navegador.
const COLLAPSE_KEY = "acf-helpdesk:sidebar-collapsed";

function buildGroups({ isAdmin, isStaff }: { isAdmin: boolean; isStaff: boolean }): NavGroup[] {
  const groups: NavGroup[] = [
    {
      label: "Espacio",
      links: [
        { href: "/dashboard", label: "Inicio", icon: LayoutDashboard },
        { href: "/solicitudes/nueva", label: "Nueva solicitud", icon: PlusCircle },
        { href: "/solicitudes", label: isStaff ? "Solicitudes" : "Mis solicitudes", icon: FolderKanban },
        { href: "/tiempos-de-respuesta", label: "Prioridades y tiempos", icon: Timer },
      ],
    },
  ];
  if (isAdmin) {
    groups.push({
      label: "Configuración",
      links: [
        { href: "/admin/categorias", label: "Categorías y responsables", icon: Tags },
        { href: "/admin/usuarios", label: "Usuarios", icon: Users },
        { href: "/admin/correos", label: "Registro de correos", icon: Mail },
        { href: "/admin/configuracion", label: "Notificaciones", icon: Settings },
      ],
    });
  }
  return groups;
}

// Estilo "glass" del cotizador: panel flotante de vidrio oscuro con destellos de marca; el activo va en rojo ACF.
const GLASS_LINEA = "h-px bg-gradient-to-r from-transparent via-white/25 to-transparent";

function NavItem({ link, active, collapsed, onNavigate }: { link: NavLink; active: boolean; collapsed: boolean; onNavigate?: () => void }) {
  const Icon = link.icon;
  const item = (
    <Link
      href={link.href}
      onClick={onNavigate}
      className={cn(
        "group flex items-center gap-3 rounded-xl px-2 py-1.5 text-sm font-medium transition-all",
        collapsed && "justify-center px-0",
        active ? "bg-[#d9342c] text-white shadow-[0_6px_20px_rgba(217,52,44,0.45)]" : "text-white/70 hover:bg-white/10 hover:text-white"
      )}
    >
      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full transition-colors",
          active ? "bg-white/25" : "bg-white/10 group-hover:bg-white/15"
        )}
      >
        <Icon className="size-4" />
      </span>
      {!collapsed && <span className="truncate">{link.label}</span>}
    </Link>
  );
  if (!collapsed) return item;
  return (
    <Tooltip>
      <TooltipTrigger render={item} />
      <TooltipContent side="right">{link.label}</TooltipContent>
    </Tooltip>
  );
}

function SidebarContent({
  onNavigate,
  collapsed = false,
  onToggleCollapsed,
}: {
  onNavigate?: () => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}) {
  const pathname = usePathname();
  const { session, isAdmin, isStaff } = useSession();
  const [, startLogoutTransition] = useTransition();
  const groups = buildGroups({ isAdmin, isStaff });
  const allHrefs = groups.flatMap((g) => g.links.map((l) => l.href));
  // El enlace activo es el más específico que coincide (así "Nueva solicitud" no marca también "Solicitudes").
  const activeHref = allHrefs
    .filter((h) => pathname === h || pathname.startsWith(`${h}/`))
    .sort((a, b) => b.length - a.length)[0];

  function handleLogout() {
    startLogoutTransition(async () => {
      await logout();
    });
  }

  const userTrigger = (
    <button
      type="button"
      className={cn(
        "flex w-full items-center gap-2.5 rounded-2xl border border-white/15 bg-white/[0.07] p-2 text-left transition-colors hover:bg-white/15",
        collapsed && "justify-center px-0"
      )}
    >
      <UserAvatar fullName={session.name} />
      {!collapsed && (
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-white">{session.name}</span>
          <span className="block truncate text-xs text-white/55">{ROLE_LABELS[session.role]}</span>
        </span>
      )}
    </button>
  );

  return (
    <div className="flex h-full flex-col gap-3 p-3 text-white">
      <div className={cn("flex items-center", collapsed && "flex-col gap-2")}>
        {!collapsed && onToggleCollapsed && <div className="size-7 shrink-0" />}
        <Link href="/dashboard" onClick={onNavigate} className={cn("flex flex-1 flex-col items-center justify-center gap-2", collapsed && "flex-none")}>
          <span className={cn("flex items-center justify-center rounded-2xl bg-white/90 shadow-lg", collapsed ? "size-10" : "size-[72px]")}>
            <Image src="/logo-acf.svg" alt="ACF" width={64} height={64} className={cn("shrink-0", collapsed ? "size-7" : "size-14")} />
          </span>
          {!collapsed && (
            <span className="text-xs font-semibold tracking-[0.18em] text-white/70 uppercase">
              Mesa de <span className="text-[#ff5a50]">Ayuda</span>
            </span>
          )}
        </Link>
        {onToggleCollapsed && (
          <Button
            variant="ghost"
            size="icon"
            className="size-7 shrink-0 text-white/60 hover:bg-white/10 hover:text-white"
            onClick={onToggleCollapsed}
            title={collapsed ? "Mostrar panel" : "Ocultar panel"}
          >
            {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          </Button>
        )}
      </div>

      <div className={GLASS_LINEA} />

      <nav
        className={cn(
          "min-h-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden pr-1",
          "[scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.35)_transparent]"
        )}
      >
        {groups.map((group, gi) => (
          <div key={group.label} className="space-y-1">
            {gi > 0 && <div className={cn(GLASS_LINEA, "mb-3")} />}
            {!collapsed && <p className="px-2 pb-0.5 text-[10px] font-semibold tracking-[0.18em] text-white/40 uppercase">{group.label}</p>}
            {group.links.map((link) => (
              <NavItem key={link.href} link={link} active={link.href === activeHref} collapsed={collapsed} onNavigate={onNavigate} />
            ))}
          </div>
        ))}
      </nav>

      <div className={GLASS_LINEA} />

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            collapsed ? (
              <Tooltip>
                <TooltipTrigger render={userTrigger} />
                <TooltipContent side="right">{session.name}</TooltipContent>
              </Tooltip>
            ) : (
              userTrigger
            )
          }
        />
        <DropdownMenuContent align="start" className="w-52">
          <DropdownMenuItem render={<Link href="/perfil" onClick={onNavigate} />}>
            <UserRound className="size-4" />
            Mi perfil
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleLogout} variant="destructive">
            <LogOut className="size-4" />
            Cerrar sesión
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

const PANEL_GLASS =
  "relative overflow-hidden rounded-3xl border border-white/10 bg-[#19191b]/90 shadow-[0_10px_40px_rgba(0,0,0,0.35)] backdrop-blur-2xl";

function Brillos() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div className="absolute -top-16 -left-16 size-60 rounded-full bg-[#d9342c]/30 blur-3xl" />
      <div className="absolute -right-20 bottom-10 size-64 rounded-full bg-white/[0.08] blur-3xl" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
    </div>
  );
}

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (window.localStorage.getItem(COLLAPSE_KEY) === "1") setCollapsed(true);
    } catch {
      // sin almacenamiento local: se queda expandido
    }
  }, []);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        // ignorar
      }
      return next;
    });
  }

  return (
    <aside className={cn("hidden shrink-0 transition-[width] duration-200 ease-in-out md:block", collapsed ? "w-[92px]" : "w-[272px]")}>
      <div className="sticky top-0 h-screen p-3">
        <div className={cn("h-full", PANEL_GLASS)}>
          <Brillos />
          <div className="relative h-full">
            <SidebarContent collapsed={collapsed} onToggleCollapsed={toggle} />
          </div>
        </div>
      </div>
    </aside>
  );
}

export function AppSidebarMobile() {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 hover:text-white md:hidden">
            <Menu className="size-5" />
          </Button>
        }
      />
      <SheetContent side="left" showCloseButton={false} className="w-[280px] bg-transparent p-3 shadow-none data-[side=left]:border-r-0">
        <SheetTitle className="sr-only">Navegación</SheetTitle>
        <div className={cn("h-full", PANEL_GLASS)}>
          <Brillos />
          <div className="relative h-full">
            <SidebarContent onNavigate={() => setOpen(false)} />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
