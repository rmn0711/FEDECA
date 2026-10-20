"use client";

import { TrendChart } from "@/components/charts/chart-kit";

export function ReportTrend({ data }: { data: Array<{ label: string; recibidas: number; resueltas: number }> }) {
  return (
    <TrendChart
      data={data}
      series={[
        { key: "recibidas", name: "Recibidas" },
        { key: "resueltas", name: "Resueltas" },
      ]}
    />
  );
}
