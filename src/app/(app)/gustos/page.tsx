"use client";
import { useMemo, useState } from "react";
import { Card, cx, H1, H2, Input, Notice } from "@/components/ui";
import { ProfileSwitch } from "@/components/ProfileSwitch";
import { FOOD_LIST } from "@/data/foods";
import { useApp } from "@/lib/app-context";
import { coverage, getPools } from "@/lib/menu/planner";
import { AISLE_ORDER } from "@/lib/menu/types";
import { NON_PREFERABLE, type PrefValue } from "@/lib/prefs";

const OPTIONS: { v: PrefValue | null; label: string }[] = [
  { v: "like", label: "Me gusta" },
  { v: null, label: "Normal" },
  { v: "dislike", label: "No me gusta" },
];

export default function Gustos() {
  const { active, prefRows, prefs, setPref, profiles } = useApp();
  const [q, setQ] = useState("");
  const mine = useMemo(() => new Map(prefRows.filter((r) => r.profile_id === active?.id).map((r) => [r.food_key, r.pref])), [prefRows, active?.id]);
  if (!active) return null;
  const cov = coverage(prefs);
  const relaxed = getPools(prefs).relaxed;
  const otherDislikes = prefRows.filter((r) => r.pref === "dislike" && r.profile_id !== active.id);
  const nameOf = (id: string) => profiles.find((p) => p.id === id)?.name ?? "";
  const foods = FOOD_LIST.filter((f) => !NON_PREFERABLE.has(f.key) && f.name.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <ProfileSwitch />
        <H1>Gustos de {active.name}</H1>
        <p className="text-muted">Marca lo que no te gusta y desaparece del menú, de las meriendas y de la lista de mercado. Lo que te gusta aparece primero.</p>
      </header>

      <Notice tone="sky" title="Un solo menú para los dos">
        Como cocinan una sola comida, lo que cualquiera de ustedes marque como &quot;No me gusta&quot; sale del menú de ambos. Los demás platos ya se adaptan a las porciones de cada uno.
      </Notice>

      {otherDislikes.length > 0 && (
        <Card className="space-y-1">
          <p className="text-sm font-medium">También excluidos por la otra persona</p>
          <p className="text-sm text-muted">{otherDislikes.map((r) => `${FOOD_LIST.find((f) => f.key === r.food_key)?.name ?? r.food_key} (${nameOf(r.profile_id)})`).join(", ")}</p>
        </Card>
      )}

      <Card className="space-y-2">
        <H2>Opciones que quedan</H2>
        <p className="text-sm text-muted tabular">Desayunos {cov.breakfast} · Almuerzos {cov.lunch} · Cenas {cov.dinner} · Meriendas {cov.snack} · Post-cena {cov.postdinner}</p>
        {relaxed.length > 0 && <Notice tone="clay">Con estos gustos quedan muy pocas opciones en: {relaxed.join(", ")}. Para no repetir platos, en esas tomas se ignoran temporalmente los gustos. Quita alguna exclusión.</Notice>}
      </Card>

      <Input aria-label="Buscar alimento" placeholder="Buscar alimento (avena, maracuyá, cerdo…)" value={q} onChange={(e) => setQ(e.target.value)} />

      {AISLE_ORDER.map((aisle) => {
        const list = foods.filter((f) => f.aisle === aisle);
        if (!list.length) return null;
        return (
          <section key={aisle} className="space-y-2">
            <H2>{aisle}</H2>
            <ul className="space-y-2">
              {list.map((f) => {
                const cur = mine.get(f.key) ?? null;
                return (
                  <li key={f.key} className="rounded-2xl bg-surface p-3">
                    <p className="mb-2 text-sm font-medium capitalize">{f.name}</p>
                    <div role="radiogroup" aria-label={f.name} className="grid grid-cols-3 gap-1">
                      {OPTIONS.map((o) => (
                        <button key={String(o.v)} role="radio" aria-checked={cur === o.v} onClick={() => setPref(active.id, f.key, o.v)} className={cx("h-10 rounded-xl text-xs font-medium", cur === o.v ? (o.v === "dislike" ? "bg-clay text-white" : o.v === "like" ? "bg-brand text-brand-ink" : "bg-ink text-paper") : "bg-paper text-muted")}>
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
