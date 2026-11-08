import { lineViews, type LineView } from "@/lib/menu/core";
import type { RecipeLine } from "@/lib/menu/types";
import { num } from "@/lib/format";
import { Chip } from "./ui";

export function IngredientList({ lines, replaced = {}, onDislike }: { lines: RecipeLine[]; replaced?: Record<string, string>; onDislike?: (food: string, name: string) => void }) {
  const views: LineView[] = lineViews(lines);
  return (
    <ul className="space-y-2">
      {views.map((v) => (
        <li key={v.food} className="flex items-start justify-between gap-3 rounded-2xl bg-surface px-4 py-3">
          <div>
            <p className="font-medium">{v.name}{v.label ? <span className="font-normal text-muted"> · {v.label}</span> : null}</p>
            {replaced[v.food] && <p className="text-xs text-plum">Sustituye a {replaced[v.food]} por seguridad en el embarazo</p>}
            {v.home && <p className="text-xs text-muted">{v.home}</p>}
            {onDislike && !["especias", "aceite", "limon"].includes(v.food) && <button onClick={() => onDislike(v.food, v.name)} className="mt-1 text-xs text-clay underline">No me gusta esto</button>}
          </div>
          <div className="text-right tabular">
            <p className="font-medium">{v.food === "especias" ? "al gusto" : `${num(v.cookedG)} g`}</p>
            {v.rawG != null && v.food !== "especias" && <p className="text-xs text-muted">≈ {num(v.rawG)} g crudo</p>}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function MacroRow({ kcal, p, c, f, fiber }: { kcal: number; p: number; c: number; f: number; fiber: number }) {
  const items = [
    ["Calorías", `${num(Math.round(kcal))}`],
    ["Proteína", `${num(p, 0)} g`],
    ["Carbohidratos", `${num(c, 0)} g`],
    ["Grasa", `${num(f, 0)} g`],
    ["Fibra", `${num(fiber, 0)} g`],
  ];
  return (
    <dl className="grid grid-cols-5 gap-2 text-center">
      {items.map(([k, v]) => (
        <div key={k} className="rounded-2xl bg-surface px-1 py-2">
          <dd className="font-display tabular text-base font-semibold">{v}</dd>
          <dt className="text-[10px] leading-tight text-muted">{k}</dt>
        </div>
      ))}
    </dl>
  );
}

export const TagList = ({ tags }: { tags: string[] }) => (
  <div className="flex flex-wrap gap-1.5">{tags.map((t) => <Chip key={t}>{t}</Chip>)}</div>
);
