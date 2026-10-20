import Link from "next/link";
import { BookOpen, Eye, Plus, Search, ThumbsUp } from "lucide-react";
import { isStaff, requireUser } from "@/lib/auth";
import { listArticles, searchArticles } from "@/lib/kb/queries";
import { CATEGORIES } from "@/lib/categories";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { CategoryIcon } from "@/components/tickets/badges";
import { cn } from "@/lib/utils";

export const metadata = { title: "Base de conocimiento" };

export default async function HelpCenter({ searchParams }: { searchParams: Promise<{ q?: string; categoria?: string }> }) {
  const user = await requireUser();
  const staff = isStaff(user);
  const { q, categoria } = await searchParams;
  const all = await listArticles({ includeDrafts: staff, category: categoria });
  const found = q?.trim() ? await searchArticles(q, { category: categoria, limit: 20, includeDrafts: staff }) : null;
  const items = found ? all.filter((a) => found.some((f) => f.id === a.id)).sort((a, b) => found.findIndex((f) => f.id === a.id) - found.findIndex((f) => f.id === b.id)) : all;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Card className="relative overflow-hidden border-none bg-gradient-to-br from-[#242426] via-[#1b1b1d] to-[#141415] text-white shadow-lg">
        <div className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-[#d9342c] opacity-25 blur-3xl" />
        <CardContent className="relative space-y-4 p-6 sm:p-8">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              ¿En qué te <span className="text-[#ff5a4f]">ayudamos</span>?
            </h1>
            <p className="mt-1 text-sm text-white/70">Guías rápidas para resolverlo tú mismo. Si no encuentras la respuesta, crea una solicitud.</p>
          </div>
          <form action="/ayuda" className="flex max-w-xl gap-2">
            {categoria && <input type="hidden" name="categoria" value={categoria} />}
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input name="q" defaultValue={q} placeholder="Ej: contraseña SINCO, VPN, pedir un post…" className="h-10 bg-white pl-9 text-foreground" />
            </div>
            <Button type="submit" className="h-10 bg-[#d9342c] text-white hover:bg-[#c42d26]">
              Buscar
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <Link href={q ? `/ayuda?q=${encodeURIComponent(q)}` : "/ayuda"} className={cn("rounded-full border px-3 py-1 text-sm", !categoria ? "border-[#d9342c] bg-[#d9342c]/10 text-[#d9342c]" : "hover:bg-accent")}>
          Todas
        </Link>
        {CATEGORIES.map((c) => (
          <Link
            key={c.slug}
            href={`/ayuda?categoria=${c.slug}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            className={cn("rounded-full border px-3 py-1 text-sm", categoria === c.slug ? "border-[#d9342c] bg-[#d9342c]/10 text-[#d9342c]" : "hover:bg-accent")}
          >
            {c.name}
          </Link>
        ))}
        {staff && (
          <Button className="ml-auto" render={<Link href="/ayuda/nuevo"><Plus className="size-4" />Nuevo artículo</Link>} />
        )}
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed">
          <EmptyState
            icon={BookOpen}
            title={q ? "No encontramos artículos para tu búsqueda" : "Aún no hay artículos"}
            description="Puedes crear una solicitud y el equipo te ayudará."
          />
          <div className="pb-8 text-center">
            <Button render={<Link href="/solicitudes/nueva">Crear solicitud</Link>} />
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((a) => (
            <Link key={a.id} href={`/ayuda/${a.id}`} className="group flex gap-3 rounded-2xl bg-card p-4 shadow-xs ring-1 ring-foreground/10 transition-all hover:-translate-y-0.5 hover:shadow-md">
              {a.categorySlug ? <CategoryIcon slug={a.categorySlug} className="size-9" /> : <span className="flex size-9 items-center justify-center rounded-lg bg-muted"><BookOpen className="size-4" /></span>}
              <div className="min-w-0 flex-1 space-y-1">
                <p className="font-semibold group-hover:text-[#d9342c]">
                  {a.title} {!a.published && <Badge variant="neutral">Borrador</Badge>}
                </p>
                {a.summary && <p className="line-clamp-2 text-sm text-muted-foreground">{a.summary}</p>}
                <p className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{a.categoryName ?? "General"}</span>
                  <span className="flex items-center gap-1"><Eye className="size-3" />{a.views}</span>
                  {a.helpful > 0 && <span className="flex items-center gap-1"><ThumbsUp className="size-3" />{a.helpful}</span>}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
