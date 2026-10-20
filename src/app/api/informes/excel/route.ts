import ExcelJS from "exceljs";
import { getCurrentUser } from "@/lib/auth";
import { getMonthlyReport } from "@/lib/reports";
import { audit } from "@/lib/audit";

const RED = "FFD9342C";

/** Informe mensual en Excel (varias hojas), solo para administradores. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return new Response("No autorizado", { status: 401 });
  const mes = new URL(request.url).searchParams.get("mes") ?? "";
  if (!/^\d{4}-\d{2}$/.test(mes)) return new Response("Mes no válido", { status: 400 });
  const r = await getMonthlyReport(mes);

  const wb = new ExcelJS.Workbook();
  wb.creator = "Conecta ACF";
  wb.created = new Date();
  const pct = (v: number | null) => (v === null ? "" : v / 100);
  const styleHeader = (ws: ExcelJS.Worksheet) => {
    const row = ws.getRow(1);
    row.font = { bold: true, color: { argb: "FFFFFFFF" } };
    row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF19191B" } };
    row.alignment = { vertical: "middle" };
    row.height = 20;
    ws.views = [{ state: "frozen", ySplit: 1 }];
  };

  const resumen = wb.addWorksheet("Resumen");
  resumen.columns = [
    { header: "Indicador", key: "k", width: 34 },
    { header: "Valor", key: "v", width: 18 },
  ];
  styleHeader(resumen);
  const t = r.total;
  resumen.addRows([
    { k: "Mes", v: r.label },
    { k: "Solicitudes recibidas", v: t.received },
    { k: "Solicitudes resueltas", v: t.resolved },
    { k: "Recibidas aún abiertas", v: t.openNow },
    { k: "Primera respuesta a tiempo", v: pct(t.responseCompliance) },
    { k: "Solución a tiempo", v: pct(t.resolutionCompliance) },
    { k: "Tiempo promedio de solución (horas)", v: t.avgResolutionHours === null ? "" : Number(t.avgResolutionHours.toFixed(1)) },
    { k: "Satisfacción promedio (1-5)", v: t.satisfaction === null ? "" : Number(t.satisfaction.toFixed(2)) },
  ]);
  [6, 7].forEach((i) => (resumen.getCell(`B${i}`).numFmt = "0%"));
  resumen.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: RED } };

  const people = wb.addWorksheet("Por responsable");
  people.columns = [
    { header: "Responsable", key: "name", width: 26 },
    { header: "Recibidas", key: "received", width: 11 },
    { header: "Resueltas", key: "resolved", width: 11 },
    { header: "Abiertas", key: "openNow", width: 10 },
    { header: "Respuesta a tiempo", key: "resp", width: 18, style: { numFmt: "0%" } },
    { header: "Solución a tiempo", key: "sol", width: 17, style: { numFmt: "0%" } },
    { header: "Promedio (h)", key: "avg", width: 13 },
    { header: "Satisfacción", key: "sat", width: 13 },
    { header: "Tareas hechas", key: "tasksDone", width: 14 },
  ];
  styleHeader(people);
  for (const p of r.people) {
    people.addRow({
      name: p.name,
      received: p.received,
      resolved: p.resolved,
      openNow: p.openNow,
      resp: pct(p.responseCompliance),
      sol: pct(p.resolutionCompliance),
      avg: p.avgResolutionHours === null ? "" : Number(p.avgResolutionHours.toFixed(1)),
      sat: p.satisfaction === null ? "" : Number(p.satisfaction.toFixed(2)),
      tasksDone: p.tasksDone,
    });
  }

  const cats = wb.addWorksheet("Por categoría");
  cats.columns = [
    { header: "Categoría", key: "name", width: 24 },
    { header: "Recibidas", key: "received", width: 11 },
    { header: "Resueltas", key: "resolved", width: 11 },
    { header: "Respuesta a tiempo", key: "resp", width: 18, style: { numFmt: "0%" } },
    { header: "Solución a tiempo", key: "sol", width: 17, style: { numFmt: "0%" } },
    { header: "Promedio (h)", key: "avg", width: 13 },
    { header: "Satisfacción", key: "sat", width: 13 },
  ];
  styleHeader(cats);
  for (const c of r.categories) {
    cats.addRow({
      name: c.name,
      received: c.received,
      resolved: c.resolved,
      resp: pct(c.responseCompliance),
      sol: pct(c.resolutionCompliance),
      avg: c.avgResolutionHours === null ? "" : Number(c.avgResolutionHours.toFixed(1)),
      sat: c.satisfaction === null ? "" : Number(c.satisfaction.toFixed(2)),
    });
  }

  const themes = wb.addWorksheet("Temas frecuentes");
  themes.columns = [
    { header: "Categoría", key: "cat", width: 22 },
    { header: "Tema", key: "label", width: 44 },
    { header: "Solicitudes", key: "count", width: 12 },
  ];
  styleHeader(themes);
  for (const th of r.themes) for (const i of th.items) themes.addRow({ cat: th.name, label: i.label, count: i.count });

  const detail = wb.addWorksheet("Solicitudes del mes");
  detail.columns = [
    { header: "Código", key: "code", width: 11 },
    { header: "Asunto", key: "title", width: 44 },
    { header: "Categoría", key: "category", width: 18 },
    { header: "Tema", key: "theme", width: 26 },
    { header: "Prioridad", key: "urgency", width: 10 },
    { header: "Estado", key: "status", width: 12 },
    { header: "Solicitante", key: "requester", width: 22 },
    { header: "Área", key: "department", width: 18 },
    { header: "Responsable", key: "assignee", width: 22 },
    { header: "Registrada", key: "createdAt", width: 18, style: { numFmt: "dd/mm/yyyy hh:mm" } },
    { header: "Respuesta a tiempo", key: "resp", width: 17 },
    { header: "Resuelta", key: "resolvedAt", width: 18, style: { numFmt: "dd/mm/yyyy hh:mm" } },
    { header: "Solución a tiempo", key: "sol", width: 16 },
    { header: "Calificación", key: "rating", width: 12 },
  ];
  styleHeader(detail);
  // Excel no maneja zonas horarias: se escribe la hora de Colombia.
  const local = (d: Date | null) => (d ? new Date(d.getTime() - 5 * 3_600_000) : null);
  const yesNo = (v: boolean | null) => (v === null ? "" : v ? "Sí" : "No");
  for (const tk of r.tickets) {
    detail.addRow({
      ...tk,
      createdAt: local(tk.createdAt),
      resolvedAt: local(tk.resolvedAt),
      resp: yesNo(tk.responseOnTime),
      sol: yesNo(tk.resolutionOnTime),
      rating: tk.rating ?? "",
    });
  }
  detail.autoFilter = { from: "A1", to: "N1" };

  await audit(user.id, "exportar", "configuracion", null, `Informe de gestión ${r.label} exportado a Excel`);
  const buffer = await wb.xlsx.writeBuffer();
  return new Response(Buffer.from(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="informe-conecta-acf-${mes}.xlsx"`,
    },
  });
}
