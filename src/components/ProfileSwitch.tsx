"use client";
import { useApp } from "@/lib/app-context";
import { cx } from "./ui";

export function ProfileSwitch() {
  const { profiles, active, setActive } = useApp();
  if (profiles.length < 2) return null;
  const order = [...profiles].sort((a) => (a.slug === "jose" ? -1 : 1));
  return (
    <div role="radiogroup" aria-label="Perfil activo" className="inline-flex gap-1 rounded-full bg-surface p-1">
      {order.map((p) => (
        <button key={p.id} role="radio" aria-checked={p.id === active?.id} onClick={() => setActive(p.id)} className={cx("h-9 rounded-full px-4 text-sm font-medium transition-colors", p.id === active?.id ? "bg-brand text-brand-ink" : "text-muted")}>
          {p.name}
        </button>
      ))}
    </div>
  );
}
