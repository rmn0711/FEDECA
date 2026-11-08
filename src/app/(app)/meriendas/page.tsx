import Link from "next/link";
import { SNACK_LIBRARY } from "@/data/recipes";
import { snackHeading } from "@/lib/menu/core";
import { H1 } from "@/components/ui";

export const metadata = { title: "Meriendas de solo proteína" };

export default function Snacks() {
  return (
    <div className="space-y-5">
      <header className="space-y-2"><H1>Meriendas de solo proteína</H1><p className="text-muted">{SNACK_LIBRARY.length} opciones con gramaje exacto para media mañana y media tarde. La app ajusta el gramaje a tu meta de cada toma.</p></header>
      <ul className="space-y-2">
        {SNACK_LIBRARY.map((r) => (
          <li key={r.slug}><Link href={`/receta/${r.slug}`} className="block rounded-2xl bg-surface px-4 py-3 transition-colors hover:bg-surface-2"><p className="font-medium">{snackHeading(r, r.lines).title}</p><p className="text-sm text-muted">{snackHeading(r, r.lines).detail}</p><p className="text-xs text-muted">{r.timeMin} min · {Math.round(r.macros.kcal)} kcal</p></Link></li>
        ))}
      </ul>
    </div>
  );
}
