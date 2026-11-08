"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LineChart, Settings } from "lucide-react";
import { useApp } from "@/lib/app-context";
import { cx, Loading } from "./ui";

const NAV = [
  { href: "/", label: "Inicio", Icon: Home },
  { href: "/progreso", label: "Progreso", Icon: LineChart },
  { href: "/ajustes", label: "Ajustes", Icon: Settings },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { ready, error } = useApp();
  if (pathname === "/login") return <main className="mx-auto min-h-dvh max-w-md px-4 py-10">{children}</main>;
  if (error) return <main className="mx-auto max-w-md px-4 py-16"><p role="alert" className="rounded-2xl bg-clay-soft p-4">No pudimos cargar tus datos: {error}</p></main>;
  if (!ready) return <main className="mx-auto max-w-md px-4 py-16"><Loading /></main>;
  const showNav = pathname !== "/onboarding";
  return (
    <>
      <main className={cx("mx-auto max-w-md px-4 pt-[max(1.25rem,env(safe-area-inset-top))]", showNav ? "pb-32" : "pb-12")}>{children}</main>
      {showNav && (
        <nav aria-label="Principal" className="fixed inset-x-0 bottom-0 z-20 bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
          <ul className="mx-auto flex max-w-md justify-around px-4 py-2">
            {NAV.map(({ href, label, Icon }) => {
              const on = href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <li key={href}>
                  <Link href={href} aria-current={on ? "page" : undefined} className={cx("flex min-w-20 flex-col items-center gap-0.5 rounded-2xl px-4 py-2 text-xs font-medium", on ? "bg-brand-soft text-brand" : "text-muted")}>
                    <Icon size={22} strokeWidth={on ? 2.4 : 1.8} aria-hidden />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </>
  );
}
