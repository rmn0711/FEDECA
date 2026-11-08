// Recordatorios push 10 minutos antes de cada toma.
// Se invoca cada minuto (Supabase pg_cron + pg_net, Vercel Cron en plan Pro o cualquier cron externo)
// con el encabezado `Authorization: Bearer $CRON_SECRET`.
import { NextResponse } from "next/server";
import * as webpush from "web-push";
import { supabaseAdmin } from "@/lib/supabase/server";
import { bogotaParts, timeToMin } from "@/lib/format";
import { computeDay } from "@/lib/day";
import { plateSummary } from "@/lib/menu/core";
import { reminderText } from "@/lib/nutrition/meals";
import { marinateReminder, prepForDay } from "@/lib/menu/prep";
import { addDays } from "@/lib/format";
import type { MealLog, MenuOverride, Profile } from "@/lib/types";
import { buildPrefs, type FoodPrefRow } from "@/lib/prefs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LEAD_MIN = 10;
/** Tolerancia por si el cron se retrasa: se envía si faltan entre 6 y 10 minutos (con deduplicación). */
const WINDOW_MIN = 4;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new NextResponse("No autorizado", { status: 401 });
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return NextResponse.json({ error: "Faltan las claves VAPID" }, { status: 500 });
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:admin@example.com", pub, priv);

  const sb = supabaseAdmin();
  const { date, time } = bogotaParts();
  const nowMin = timeToMin(time);

  const { data: subs } = await sb.from("push_subscriptions").select("*");
  if (!subs?.length) return NextResponse.json({ sent: 0 });
  const households = [...new Set(subs.map((s) => s.household_id as string))];

  let sent = 0;
  for (const hid of households) {
    const [{ data: profs }, { data: ovs }, { data: prefRows }] = await Promise.all([
      sb.from("profiles").select("*").eq("household_id", hid).eq("onboarding_done", true),
      sb.from("menu_overrides").select("*").eq("household_id", hid).gte("date", date).lte("date", date),
      sb.from("food_preferences").select("food_key,pref").eq("household_id", hid),
    ]);
    const prefs = buildPrefs((prefRows ?? []) as Pick<FoodPrefRow, "food_key" | "pref">[]);
    const overrides = Object.fromEntries(((ovs ?? []) as MenuOverride[]).map((o) => [`${o.date}:${o.slot}`, o.recipe_slug]));
    for (const p of (profs ?? []) as Profile[]) {
      const { data: logs } = await sb.from("meal_logs").select("*").eq("profile_id", p.id).eq("date", date);
      const day = computeDay({ profile: p, date, today: date, overrides, logs: (logs ?? []) as MealLog[], prefs });
      for (const s of day.slots) {
        if (s.status !== "pending" || s.dropped) continue;
        const untilMeal = timeToMin(s.time) - nowMin;
        if (untilMeal > LEAD_MIN || untilMeal < LEAD_MIN - WINDOW_MIN) continue;
        const { error: dup } = await sb.from("push_sent").insert({ profile_id: p.id, date, slot: s.slot });
        if (dup) continue; // ya enviado
        const grams = s.proteinOnly ? `${Math.round(s.portion.macros.p)} g de proteína: ${plateSummary(s.portion.lines, 3)}` : `${plateSummary(s.portion.lines)} · ${Math.round(s.portion.macros.p)} g de proteína`;
        const msg = reminderText(`${s.label} de ${p.name}`, s.proteinOnly ? "Solo proteína" : s.recipe.name, grams);
        const targets = subs.filter((x) => x.household_id === hid && (!x.profile_id || x.profile_id === p.id));
        await Promise.all(
          targets.map(async (t) => {
            try {
              await webpush.sendNotification({ endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } }, JSON.stringify({ ...msg, url: `/receta/${s.recipe.slug}?slot=${s.slot}`, tag: `meal-${p.id}-${s.slot}` }));
              sent++;
            } catch (e) {
              const status = (e as { statusCode?: number }).statusCode;
              if (status === 404 || status === 410) await sb.from("push_subscriptions").delete().eq("id", t.id);
            }
          }),
        );
      }
    }
  }
  // Aviso de las 8 p. m.: qué adobar para mañana (una vez por hogar).
  if (nowMin >= 20 * 60 && nowMin < 20 * 60 + 5) {
    const tomorrow = addDays(date, 1);
    for (const hid of households) {
      const [{ data: profs }, { data: ovs }, { data: prefRows }] = await Promise.all([
        sb.from("profiles").select("*").eq("household_id", hid).eq("onboarding_done", true),
        sb.from("menu_overrides").select("*").eq("household_id", hid).eq("date", tomorrow),
        sb.from("food_preferences").select("food_key,pref").eq("household_id", hid),
      ]);
      const list = ((profs ?? []) as Profile[]).sort((a) => (a.slug === "jose" ? -1 : 1));
      if (!list.length) continue;
      const overrides = Object.fromEntries(((ovs ?? []) as MenuOverride[]).map((o) => [`${o.date}:${o.slot}`, o.recipe_slug]));
      const msg = marinateReminder(prepForDay({ date: tomorrow, profiles: list, overrides, prefs: buildPrefs((prefRows ?? []) as Pick<FoodPrefRow, "food_key" | "pref">[]), today: date }));
      if (!msg) continue;
      const { error: dup } = await sb.from("push_sent").insert({ profile_id: list[0].id, date, slot: 90 });
      if (dup) continue;
      await Promise.all(
        subs.filter((x) => x.household_id === hid).map(async (t) => {
          try {
            await webpush.sendNotification({ endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } }, JSON.stringify({ ...msg, url: "/manana", tag: `prep-${tomorrow}` }));
            sent++;
          } catch (e) {
            const status = (e as { statusCode?: number }).statusCode;
            if (status === 404 || status === 410) await sb.from("push_subscriptions").delete().eq("id", t.id);
          }
        }),
      );
    }
  }
  return NextResponse.json({ sent, at: `${date} ${time}` });
}
