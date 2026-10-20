"use client";

import { useRef } from "react";
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Quote,
  Table,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type Action = { icon: LucideIcon; label: string; kind: "wrap" | "line" | "block"; before: string; after?: string };

const ACTIONS: Action[] = [
  { icon: Heading1, label: "Título", kind: "line", before: "# " },
  { icon: Heading2, label: "Subtítulo", kind: "line", before: "## " },
  { icon: Bold, label: "Negrita", kind: "wrap", before: "**", after: "**" },
  { icon: Italic, label: "Cursiva", kind: "wrap", before: "_", after: "_" },
  { icon: List, label: "Lista", kind: "line", before: "- " },
  { icon: ListOrdered, label: "Lista numerada", kind: "line", before: "1. " },
  { icon: ListChecks, label: "Lista de tareas", kind: "line", before: "- [ ] " },
  { icon: Quote, label: "Cita / nota", kind: "line", before: "> " },
  { icon: Link2, label: "Enlace", kind: "wrap", before: "[", after: "](https://)" },
  { icon: Code, label: "Código", kind: "wrap", before: "`", after: "`" },
  { icon: Table, label: "Tabla", kind: "block", before: "| Columna 1 | Columna 2 | Columna 3 |\n| --- | --- | --- |\n|  |  |  |\n" },
  { icon: Minus, label: "Divisor", kind: "block", before: "---\n" },
];

/** Editor de texto con formato: barra de herramientas + atajos (Ctrl+B, Ctrl+I, Tab en listas). */
export function MarkdownEditor({
  value,
  onChange,
  placeholder,
  minRows = 8,
  autoFocus,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minRows?: number;
  autoFocus?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  function apply(action: Action) {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: start, selectionEnd: end } = el;
    const selected = value.slice(start, end);
    let next = value;
    let cursorStart = start;
    let cursorEnd = end;
    if (action.kind === "wrap") {
      next = value.slice(0, start) + action.before + selected + (action.after ?? "") + value.slice(end);
      cursorStart = start + action.before.length;
      cursorEnd = cursorStart + selected.length;
    } else if (action.kind === "line") {
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      const block = value.slice(lineStart, end);
      const prefixed = block
        .split("\n")
        .map((l) => action.before + l.replace(/^(#{1,6} |[-*+] \[[ xX]\] |[-*+] |\d+\. |> )/, ""))
        .join("\n");
      next = value.slice(0, lineStart) + prefixed + value.slice(end);
      cursorStart = cursorEnd = lineStart + prefixed.length;
    } else {
      const needsBreak = start > 0 && value[start - 1] !== "\n" ? "\n\n" : "";
      next = value.slice(0, start) + needsBreak + action.before + value.slice(end);
      cursorStart = cursorEnd = start + needsBreak.length + action.before.length;
    }
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(cursorStart, cursorEnd);
    });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === "b") {
      e.preventDefault();
      apply(ACTIONS[2]);
      return;
    }
    if (mod && e.key.toLowerCase() === "i") {
      e.preventDefault();
      apply(ACTIONS[3]);
      return;
    }
    // Enter dentro de una lista continúa la lista (como en Notion).
    if (e.key === "Enter" && !e.shiftKey) {
      const el = e.currentTarget;
      const pos = el.selectionStart;
      const lineStart = value.lastIndexOf("\n", pos - 1) + 1;
      const line = value.slice(lineStart, pos);
      const m = /^(\s*)([-*+] \[[ xX]\] |[-*+] |(\d+)\. )(.*)$/.exec(line);
      if (m) {
        e.preventDefault();
        if (!m[4].trim()) {
          // Lista vacía: se sale de la lista.
          const next = value.slice(0, lineStart) + value.slice(pos);
          onChange(next);
          requestAnimationFrame(() => el.setSelectionRange(lineStart, lineStart));
          return;
        }
        const marker = m[3] ? `${Number(m[3]) + 1}. ` : m[2].replace(/\[[xX]\]/, "[ ]");
        const insert = `\n${m[1]}${marker}`;
        onChange(value.slice(0, pos) + insert + value.slice(el.selectionEnd));
        requestAnimationFrame(() => el.setSelectionRange(pos + insert.length, pos + insert.length));
      }
    }
  }

  return (
    <div className={cn("overflow-hidden rounded-xl border bg-background focus-within:ring-3 focus-within:ring-ring/30", className)}>
      <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/40 px-1.5 py-1">
        {ACTIONS.map((a) => (
          <Tooltip key={a.label}>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => apply(a)}
                  className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                  aria-label={a.label}
                >
                  <a.icon className="size-4" />
                </button>
              }
            />
            <TooltipContent>{a.label}</TooltipContent>
          </Tooltip>
        ))}
      </div>
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        rows={minRows}
        autoFocus={autoFocus}
        placeholder={placeholder}
        className="field-sizing-content block w-full resize-none bg-transparent px-3 py-2.5 font-mono text-sm leading-relaxed outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}
