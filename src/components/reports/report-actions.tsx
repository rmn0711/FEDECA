"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, FileSpreadsheet, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ReportActions({ month, prev, next }: { month: string; prev: string; next: string | null }) {
  const router = useRouter();
  return (
    <div className="no-print flex flex-wrap items-center gap-2">
      <Button variant="outline" size="icon" aria-label="Mes anterior" onClick={() => router.push(`/admin/informes?mes=${prev}`)}>
        <ChevronLeft className="size-4" />
      </Button>
      <Input type="month" value={month} onChange={(e) => e.target.value && router.push(`/admin/informes?mes=${e.target.value}`)} className="w-44" aria-label="Mes del informe" />
      <Button variant="outline" size="icon" aria-label="Mes siguiente" disabled={!next} onClick={() => next && router.push(`/admin/informes?mes=${next}`)}>
        <ChevronRight className="size-4" />
      </Button>
      <Button variant="outline" render={<a href={`/api/informes/excel?mes=${month}`}><FileSpreadsheet className="size-4" />Excel</a>} />
      <Button onClick={() => window.print()}>
        <Printer className="size-4" />
        PDF / imprimir
      </Button>
    </div>
  );
}
