"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClipboardPaste, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteMetricAction, importMetricsCsvAction, saveMetricsAction } from "@/lib/actions/marketing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const KEYS = ["spend", "impressions", "clicks", "leads", "qualified", "visits", "quotes", "sales"] as const;
const LABELS: Record<(typeof KEYS)[number], string> = {
  spend: "Inversión",
  impressions: "Impresiones",
  clicks: "Clics",
  leads: "Leads",
  qualified: "Calificados",
  visits: "Visitas",
  quotes: "Cotizaciones",
  sales: "Separaciones",
};

type Row = { key: string; project: string; channel: string; saved: boolean } & Record<(typeof KEYS)[number], string>;

export function MetricsEditor({
  month,
  initial,
  projects,
  channels,
}: {
  month: string;
  initial: Array<{ project: string; channel: string } & Record<(typeof KEYS)[number], number>>;
  projects: string[];
  channels: string[];
}) {
  const router = useRouter();
  const toRows = () =>
    initial.map((r) => ({
      key: `${r.project}|${r.channel}`,
      project: r.project,
      channel: r.channel,
      saved: true,
      ...Object.fromEntries(KEYS.map((k) => [k, r[k] ? String(r[k]) : ""])),
    })) as Row[];
  const [rows, setRows] = useState<Row[]>(toRows);
  useEffect(() => {
    setRows(toRows());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);
  const [csv, setCsv] = useState("");
  const [pending, startTransition] = useTransition();

  function update(i: number, patch: Partial<Row>) {
    setRows((list) => list.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  function save() {
    startTransition(async () => {
      const r = await saveMetricsAction(rows.map((row) => ({ month, project: row.project, channel: row.channel, ...Object.fromEntries(KEYS.map((k) => [k, Number(row[k] || 0)])) })));
      if (!r.ok) return void toast.error(r.error);
      toast.success(`${r.data.saved} fila(s) guardadas.`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Datos del mes</CardTitle>
          <CardDescription>Una fila por proyecto y canal. Los valores se reemplazan al guardar.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <datalist id="mk-projects">
            {projects.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
          <datalist id="mk-channels">
            {channels.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="px-1 py-1 font-medium">Proyecto / campaña</th>
                  <th className="px-1 py-1 font-medium">Canal</th>
                  {KEYS.map((k) => (
                    <th key={k} className="px-1 py-1 text-right font-medium">
                      {LABELS[k]}
                    </th>
                  ))}
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.key} className="border-t">
                    <td className="px-1 py-1">
                      <Input list="mk-projects" value={r.project} onChange={(e) => update(i, { project: e.target.value })} className="h-8 w-44" aria-label="Proyecto" disabled={r.saved} />
                    </td>
                    <td className="px-1 py-1">
                      <Input list="mk-channels" value={r.channel} onChange={(e) => update(i, { channel: e.target.value })} className="h-8 w-40" aria-label="Canal" disabled={r.saved} />
                    </td>
                    {KEYS.map((k) => (
                      <td key={k} className="px-1 py-1">
                        <Input
                          inputMode="numeric"
                          value={r[k]}
                          onChange={(e) => update(i, { [k]: e.target.value.replace(/[^\d]/g, "") } as Partial<Row>)}
                          className={`h-8 text-right tabular-nums ${k === "spend" ? "w-32" : "w-24"}`}
                          aria-label={LABELS[k]}
                          placeholder="0"
                        />
                      </td>
                    ))}
                    <td className="px-1 py-1">
                      <button
                        type="button"
                        aria-label="Eliminar fila"
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive"
                        onClick={() => {
                          if (!r.saved) return setRows((list) => list.filter((_, j) => j !== i));
                          if (!confirm(`¿Eliminar ${r.project} · ${r.channel}?`)) return;
                          startTransition(async () => {
                            await deleteMetricAction(month, r.project, r.channel);
                            router.refresh();
                          });
                        }}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <Button
              variant="outline"
              onClick={() =>
                setRows((list) => [
                  ...list,
                  { key: crypto.randomUUID(), project: list.at(-1)?.project ?? "", channel: "", saved: false, ...Object.fromEntries(KEYS.map((k) => [k, ""])) } as Row,
                ])
              }
            >
              <Plus className="size-4" />
              Agregar fila
            </Button>
            <Button onClick={save} disabled={pending}>
              <Save className="size-4" />
              {pending ? "Guardando..." : "Guardar datos del mes"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pegar desde Excel o CSV</CardTitle>
          <CardDescription>
            Copia la tabla con encabezados (Proyecto, Canal, Inversión, Leads, Calificados, Visitas, Cotizaciones, Separaciones; opcional Mes,
            Impresiones, Clics) y pégala aquí.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Textarea
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            rows={5}
            className="font-mono text-xs"
            placeholder={"Proyecto\tCanal\tInversión\tLeads\tCalificados\tVisitas\tCotizaciones\tSeparaciones\nTorres del Parque\tMeta Ads\t4500000\t120\t48\t20\t12\t3"}
          />
          <Button
            variant="outline"
            disabled={pending || !csv.trim()}
            onClick={() =>
              startTransition(async () => {
                const r = await importMetricsCsvAction(csv, month);
                if (!r.ok) return void toast.error(r.error);
                toast.success(`${r.data.saved} fila(s) importadas${r.data.skipped ? `, ${r.data.skipped} omitidas` : ""}.`);
                setCsv("");
                router.refresh();
              })
            }
          >
            <ClipboardPaste className="size-4" />
            Importar
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
