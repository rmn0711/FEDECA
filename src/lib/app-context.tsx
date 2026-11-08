"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getDb, type Db } from "./db";
import { LOCAL_HOUSEHOLD_ID } from "./db/local";
import { isSupabaseConfigured, supabaseBrowser } from "./supabase/client";
import { nowHHMM, todayISO } from "./format";
import { defaultMealTimes } from "./nutrition/meals";
import { needsProteinRecalc } from "./nutrition/calc";
import { DEFAULT_TRAINING_DAYS } from "./exercise/plan";
import type { KneeProfile, Profile, WeightLog } from "./types";

interface Ctx {
  db: Db;
  ready: boolean;
  error: string | null;
  householdId: string;
  inviteCode: string | null;
  profiles: Profile[];
  active: Profile | null;
  knee: KneeProfile | null;
  setActive: (id: string) => void;
  patchProfile: (id: string, patch: Partial<Profile>) => Promise<Profile>;
  saveKnee: (patch: Partial<KneeProfile>) => Promise<KneeProfile>;
  logWeight: (kg: number, date?: string) => Promise<void>;
  signOut: () => Promise<void>;
  today: string;
  nowTime: string;
}

const AppCtx = createContext<Ctx | null>(null);
export const useApp = () => {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp fuera de AppProvider");
  return c;
};

const ACTIVE_KEY = "fedeca:active";
const PUBLIC_PATHS = ["/login"];

async function seedLocal(db: Db): Promise<void> {
  const existing = await db.select<Profile>("profiles");
  if (existing.length) return;
  const base = { household_id: LOCAL_HOUSEHOLD_ID, meal_times: defaultMealTimes(), onboarding_done: false, medical_ack: false, uses_glp1: false, waist_cm: null, hip_cm: null, neck_cm: null, training_time: null, training_place: null, goal_weight_kg: null, pre_pregnancy_weight_kg: null, age: null };
  const jose = await db.insert<Profile>("profiles", { ...base, slug: "jose", name: "Jose", mode: "fat_loss", sex: "male", height_cm: 178, start_weight_kg: 123, current_weight_kg: 123, protein_anchor_weight_kg: 123, training_days: DEFAULT_TRAINING_DAYS, due_date: null });
  await db.insert<Profile>("profiles", { ...base, slug: "esposa", name: "Esposa", mode: "pregnancy", sex: "female", height_cm: 160, start_weight_kg: null, current_weight_kg: null, protein_anchor_weight_kg: null, training_days: [], due_date: "2027-04-15" });
  await db.insert<KneeProfile>("knee_profiles", { household_id: LOCAL_HOUSEHOLD_ID, profile_id: jose.id, side: "right", diagnosis: "none", surgery_type: null, surgery_months_ago: null, pain_rest: 0, pain_stairs: 0, pain_chair: 0, ortho_clearance: false, start_date: todayISO(), phase_override: null });
}

export function AppProvider({ children }: { children: ReactNode }) {
  const db = useMemo(() => getDb(), []);
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [householdId, setHouseholdId] = useState("");
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [knee, setKnee] = useState<KneeProfile | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  const isPublic = PUBLIC_PATHS.includes(pathname);

  useEffect(() => {
    if (isPublic) return;
    let cancelled = false;
    (async () => {
      try {
        let hid = LOCAL_HOUSEHOLD_ID;
        let code: string | null = null;
        if (isSupabaseConfigured) {
          const sb = supabaseBrowser();
          const { data } = await sb.auth.getSession();
          if (!data.session) {
            router.replace("/login");
            return;
          }
          const { data: members, error: e1 } = await sb.from("household_members").select("household_id").limit(1);
          if (e1) throw new Error(e1.message);
          if (members?.length) hid = members[0].household_id;
          else {
            const { data: created, error: e2 } = await sb.rpc("bootstrap_household");
            if (e2) throw new Error(e2.message);
            hid = created as string;
          }
          const { data: hh } = await sb.from("households").select("invite_code").eq("id", hid).maybeSingle();
          code = hh?.invite_code ?? null;
        } else {
          await seedLocal(db);
        }
        const profs = await db.select<Profile>("profiles", { match: { household_id: hid }, order: { col: "slug", asc: false } });
        const stored = typeof localStorage !== "undefined" ? localStorage.getItem(ACTIVE_KEY) : null;
        const act = profs.find((p) => p.id === stored) ?? profs.find((p) => p.slug === "jose") ?? profs[0];
        const kn = profs.find((p) => p.slug === "jose") ? (await db.select<KneeProfile>("knee_profiles", { match: { profile_id: profs.find((p) => p.slug === "jose")!.id } }))[0] ?? null : null;
        if (cancelled) return;
        setHouseholdId(hid);
        setInviteCode(code);
        setProfiles(profs);
        setActiveId(act?.id ?? null);
        setKnee(kn);
        setReady(true);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error al cargar");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [db, isPublic, router]);

  const active = profiles.find((p) => p.id === activeId) ?? null;

  // Onboarding obligatorio para el perfil activo.
  useEffect(() => {
    if (ready && active && !active.onboarding_done && pathname !== "/onboarding" && !isPublic) router.replace("/onboarding");
  }, [ready, active, pathname, isPublic, router]);

  const setActive = useCallback((id: string) => {
    setActiveId(id);
    try {
      localStorage.setItem(ACTIVE_KEY, id);
    } catch {
      /* ignorar */
    }
  }, []);

  const patchProfile = useCallback(
    async (id: string, patch: Partial<Profile>) => {
      const updated = await db.update<Profile>("profiles", id, patch);
      setProfiles((ps) => ps.map((p) => (p.id === id ? { ...p, ...updated } : p)));
      return updated;
    },
    [db],
  );

  const saveKnee = useCallback(
    async (patch: Partial<KneeProfile>) => {
      const jose = profiles.find((p) => p.slug === "jose");
      if (!jose) throw new Error("Perfil no encontrado");
      const saved = knee
        ? await db.update<KneeProfile>("knee_profiles", knee.id, patch)
        : await db.insert<KneeProfile>("knee_profiles", { household_id: householdId, profile_id: jose.id, ...patch });
      setKnee(saved);
      return saved;
    },
    [db, knee, profiles, householdId],
  );

  const logWeight = useCallback(
    async (kgValue: number, date = todayISO()) => {
      if (!active) return;
      await db.upsert<WeightLog>("weight_logs", { household_id: householdId, profile_id: active.id, date, weight_kg: kgValue }, ["profile_id", "date"]);
      const patch: Partial<Profile> = { current_weight_kg: kgValue };
      if (active.mode === "fat_loss" && needsProteinRecalc(active.protein_anchor_weight_kg, kgValue)) patch.protein_anchor_weight_kg = kgValue;
      if (active.mode === "fat_loss" && active.start_weight_kg == null) patch.start_weight_kg = kgValue;
      await patchProfile(active.id, patch);
    },
    [db, householdId, active, patchProfile],
  );

  const signOut = useCallback(async () => {
    if (isSupabaseConfigured) await supabaseBrowser().auth.signOut();
    router.replace("/login");
  }, [router]);

  const value: Ctx = {
    db,
    ready,
    error,
    householdId,
    inviteCode,
    profiles,
    active,
    knee,
    setActive,
    patchProfile,
    saveKnee,
    logWeight,
    signOut,
    today: todayISO(now),
    nowTime: nowHHMM(now),
  };
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
