"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { CATEGORIES } from "@/lib/categories";
import { STATUSES, STATUS_META, URGENCIES, URGENCY_META } from "@/lib/constants";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const ALL = "__all__";

export function TicketFiltersBar({
  staff,
  isAdmin,
  staffList,
}: {
  staff: boolean;
  isAdmin: boolean;
  staffList: Array<{ id: number; name: string }>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");

  function update(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value === null || value === "" || value === ALL) next.delete(key);
    else next.set(key, value);
    next.delete("pagina");
    startTransition(() => router.replace(`${pathname}?${next.toString()}`));
  }

  // Búsqueda con espera corta para no consultar en cada tecla.
  useEffect(() => {
    const current = params.get("q") ?? "";
    if (q === current) return;
    const t = setTimeout(() => update("q", q.trim() || null), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const vista = params.get("vista") ?? "todas";
  const estado = params.get("estado") ?? "abiertas";
  const hasFilters = ["categoria", "prioridad", "responsable", "q"].some((k) => params.get(k)) || estado !== "abiertas";

  const vistas = staff
    ? [
        { v: "todas", label: isAdmin ? "Todas" : "Mi bandeja" },
        { v: "asignadas", label: "Asignadas a mí" },
        { v: "sin-asignar", label: "Sin asignar" },
        { v: "vencidas", label: "Vencidas" },
        { v: "mias", label: "Creadas por mí" },
      ]
    : [];

  return (
    <Card className={pending ? "opacity-70 transition-opacity" : undefined}>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <SlidersHorizontal className="size-4" />
            Filtros
          </div>
          {staff && (
            <Tabs value={vista} onValueChange={(v) => update("vista", v === "todas" ? null : String(v))}>
              <TabsList>
                {vistas.map((x) => (
                  <TabsTrigger key={x.v} value={x.v}>
                    {x.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          )}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar por código, asunto o solicitante…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-8" />
          </div>
          <Select value={estado} onValueChange={(v) => update("estado", v === "abiertas" ? null : String(v))}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="abiertas">Abiertas</SelectItem>
              <SelectItem value="todas">Todos los estados</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_META[s].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={params.get("categoria") ?? ALL} onValueChange={(v) => update("categoria", String(v))}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todas las categorías</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c.slug} value={c.slug}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={params.get("prioridad") ?? ALL} onValueChange={(v) => update("prioridad", String(v))}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Toda prioridad</SelectItem>
              {URGENCIES.map((u) => (
                <SelectItem key={u} value={u}>
                  {URGENCY_META[u].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {staff && (
            <Select value={params.get("responsable") ?? ALL} onValueChange={(v) => update("responsable", String(v))}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos los responsables</SelectItem>
                <SelectItem value="ninguno">Sin asignar</SelectItem>
                {staffList.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQ("");
                startTransition(() => router.replace(vista !== "todas" ? `${pathname}?vista=${vista}` : pathname));
              }}
            >
              <X className="size-3.5" />
              Limpiar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
