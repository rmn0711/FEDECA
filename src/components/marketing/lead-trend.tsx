"use client";

import { TrendChart } from "@/components/charts/chart-kit";

export function LeadTrend({ data }: { data: Array<{ label: string; leads: number; calificados: number }> }) {
  return (
    <TrendChart
      data={data}
      series={[
        { key: "leads", name: "Leads" },
        { key: "calificados", name: "Leads calificados" },
      ]}
    />
  );
}
