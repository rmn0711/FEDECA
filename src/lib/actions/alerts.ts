"use server";

import { requireUser } from "@/lib/auth";
import { getAlerts, type AlertsResult } from "@/lib/alerts";
import { deliverDueReminders } from "@/lib/followups/service";
import { deliverOverdueAlerts } from "@/lib/tickets/overdue";
import { kickMetaOutbox } from "@/lib/whatsapp/meta";

export async function getAlertsAction(): Promise<AlertsResult> {
  const user = await requireUser();
  // Con la plataforma abierta, los recordatorios se entregan al minuto aunque no corra el cron.
  if (user.role !== "user") {
    await deliverDueReminders(user.id).catch(() => 0);
    await deliverOverdueAlerts().catch(() => 0);
    // Reintenta los WhatsApp que quedaron pendientes (no hace nada si no está la API de Meta).
    await kickMetaOutbox();
  }
  return getAlerts(user);
}
