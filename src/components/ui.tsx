"use client";
import { useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { parseNum } from "@/lib/format";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/** Bloque con fondo (sin borde). */
export function Card({ children, className, tone = "surface" }: { children: ReactNode; className?: string; tone?: "surface" | "brand" | "clay" | "sun" | "sky" | "plum" | "plain" }) {
  const tones = { surface: "bg-surface", brand: "bg-brand-soft", clay: "bg-clay-soft", sun: "bg-sun-soft", sky: "bg-sky-soft", plum: "bg-plum-soft", plain: "" };
  return <section className={cx("rounded-3xl p-5", tones[tone], className)}>{children}</section>;
}

export function H1({ children, className }: { children: ReactNode; className?: string }) {
  return <h1 className={cx("font-display text-3xl font-semibold leading-tight", className)}>{children}</h1>;
}
export function H2({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={cx("font-display text-xl font-semibold", className)}>{children}</h2>;
}
export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-xs font-medium uppercase tracking-wider text-muted">{children}</p>;
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "soft" | "ghost" | "danger"; size?: "md" | "sm" | "lg" };
export function Button({ variant = "primary", size = "md", className, ...p }: BtnProps) {
  const v = {
    primary: "bg-brand text-brand-ink hover:bg-[#245a48] disabled:bg-surface-2 disabled:text-muted",
    soft: "bg-surface-2 text-ink hover:bg-[#dcd7c8] disabled:opacity-50",
    ghost: "bg-transparent text-brand hover:bg-brand-soft",
    danger: "bg-clay text-white hover:bg-[#9c4426]",
  }[variant];
  const s = { sm: "h-9 px-4 text-sm", md: "h-12 px-6 text-base", lg: "h-14 px-8 text-lg" }[size];
  return <button type="button" {...p} className={cx("inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors", v, s, className)} />;
}

export function Chip({ children, tone = "surface" }: { children: ReactNode; tone?: "surface" | "brand" | "clay" | "sun" | "sky" | "plum" }) {
  const t = { surface: "bg-surface-2 text-ink", brand: "bg-brand-soft text-brand", clay: "bg-clay-soft text-clay", sun: "bg-sun-soft text-sun", sky: "bg-sky-soft text-sky", plum: "bg-plum-soft text-plum" }[tone];
  return <span className={cx("inline-flex items-center rounded-full px-3 py-1 text-xs font-medium", t)}>{children}</span>;
}

export function Notice({ tone = "sun", title, children }: { tone?: "sun" | "clay" | "brand" | "sky" | "plum"; title?: string; children: ReactNode }) {
  const t = { sun: "bg-sun-soft", clay: "bg-clay-soft", brand: "bg-brand-soft", sky: "bg-sky-soft", plum: "bg-plum-soft" }[tone];
  return (
    <div role={tone === "clay" ? "alert" : "note"} className={cx("rounded-2xl p-4 text-sm leading-relaxed", t)}>
      {title && <p className="font-display mb-1 text-base font-semibold">{title}</p>}
      {children}
    </div>
  );
}

export function Stat({ label, value, sub, className }: { label: string; value: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <p className="text-xs text-muted">{label}</p>
      <p className="font-display tabular text-2xl font-semibold leading-tight">{value}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </div>
  );
}

export function Bar({ value, max, tone = "brand", label }: { value: number; max: number; tone?: "brand" | "clay" | "sky" | "sun"; label?: string }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  const c = { brand: "bg-brand", clay: "bg-clay", sky: "bg-sky", sun: "bg-sun" }[tone];
  return (
    <div role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.round(value)} aria-label={label} className="h-3 w-full overflow-hidden rounded-full bg-surface-2">
      <div className={cx("h-full rounded-full transition-all", c)} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Barra del día dividida en 6 segmentos (uno por toma). */
export function Segments({ filled, total = 6, skipped = [] }: { filled: number[]; total?: number; skipped?: number[] }) {
  return (
    <div className="flex gap-1.5" role="img" aria-label={`${filled.length} de ${total} tomas cumplidas`}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className={cx("h-3 flex-1 rounded-full transition-colors", filled.includes(i) ? "bg-brand" : skipped.includes(i) ? "bg-clay-soft" : "bg-surface-2")} />
      ))}
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

const inputCls = "h-12 w-full rounded-2xl bg-surface px-4 text-base placeholder:text-muted/70";
export const Input = (p: React.InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cx(inputCls, p.className)} />;
export const Select = (p: React.SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={cx(inputCls, "appearance-none", p.className)} />;
export const TextArea = (p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={cx(inputCls, "h-auto min-h-24 py-3", p.className)} />;

/** Campo numérico que acepta coma o punto decimal. */
export function NumField({ label, value, onChange, unit, hint, placeholder, disabled }: { label: string; value: number | null; onChange: (v: number | null) => void; unit?: string; hint?: string; placeholder?: string; disabled?: boolean }) {
  const [text, setText] = useState(value == null ? "" : String(value).replace(".", ","));
  return (
    <Field label={label} hint={hint}>
      <div className="relative">
        <Input
          inputMode="decimal"
          value={text}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => {
            setText(e.target.value);
            onChange(parseNum(e.target.value));
          }}
        />
        {unit && <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted">{unit}</span>}
      </div>
    </Field>
  );
}

/** Escala de dolor 0–10. */
export function PainScale({ value, onChange, label }: { value: number | null; onChange: (n: number) => void; label: string }) {
  const tone = (n: number) => (n <= 3 ? "bg-brand-soft text-brand" : n <= 5 ? "bg-sun-soft text-sun" : "bg-clay-soft text-clay");
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">{label}</legend>
      <div className="grid grid-cols-11 gap-1">
        {Array.from({ length: 11 }, (_, n) => (
          <button key={n} type="button" aria-pressed={value === n} onClick={() => onChange(n)} className={cx("tabular h-11 rounded-xl text-sm font-medium", value === n ? "bg-ink text-paper" : tone(n))}>
            {n}
          </button>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-muted"><span>Sin dolor</span><span>Máximo</span></div>
    </fieldset>
  );
}

export function SegmentedControl<T extends string | number>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label?: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1 rounded-full bg-surface p-1">
      {options.map((o) => (
        <button key={String(o.value)} type="button" role="radio" aria-checked={o.value === value} onClick={() => onChange(o.value)} className={cx("h-10 flex-1 rounded-full px-3 text-sm font-medium transition-colors", o.value === value ? "bg-brand text-brand-ink" : "text-muted hover:text-ink")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Loading({ text = "Cargando…" }: { text?: string }) {
  return <p className="py-10 text-center text-muted" role="status">{text}</p>;
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex w-full items-center justify-between gap-4 rounded-2xl bg-surface px-4 py-3 text-left">
      <span className="text-sm">{label}</span>
      <span className={cx("relative h-7 w-12 shrink-0 rounded-full transition-colors", checked ? "bg-brand" : "bg-surface-2")}>
        <span className={cx("absolute top-1 h-5 w-5 rounded-full bg-white transition-all", checked ? "left-6" : "left-1")} />
      </span>
    </button>
  );
}
