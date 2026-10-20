"use server";

import { requireUser } from "@/lib/auth";
import { getAlerts, type AlertsResult } from "@/lib/alerts";

export async function getAlertsAction(): Promise<AlertsResult> {
  const user = await requireUser();
  return getAlerts(user);
}
