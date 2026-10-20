"use client";

import { createContext, useContext } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

/** Marca o desmarca la casilla de la lista de tareas que está en la línea `line` (1 = primera). */
export function toggleTaskInMarkdown(source: string, line: number) {
  const lines = source.split("\n");
  const i = line - 1;
  if (!lines[i]) return source;
  lines[i] = lines[i].replace(/^(\s*(?:[-*+]|\d+\.)\s+)\[( |x|X)\]/, (_, prefix: string, mark: string) => `${prefix}[${mark === " " ? "x" : " "}]`);
  return lines.join("\n");
}

// Cada elemento de lista informa su línea en el texto original a la casilla que contiene.
const LineContext = createContext<number | null>(null);
const ToggleContext = createContext<((line: number) => void) | undefined>(undefined);

function TaskCheckbox({ checked }: { checked: boolean }) {
  const line = useContext(LineContext);
  const onToggle = useContext(ToggleContext);
  return (
    <input
      type="checkbox"
      checked={checked}
      disabled={!onToggle || line === null}
      onChange={() => line !== null && onToggle?.(line)}
      aria-label="Marcar elemento"
    />
  );
}

/**
 * Muestra texto con formato (títulos, listas, tablas, casillas…). Si se pasa
 * `onToggleTask`, las casillas se pueden marcar directamente, como en Notion.
 */
export function Markdown({
  source,
  className,
  onToggleTask,
}: {
  source: string;
  className?: string;
  onToggleTask?: (line: number) => void;
}) {
  return (
    <ToggleContext.Provider value={onToggleTask}>
      <div className={cn("md", className)}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            a: ({ href, children }) => (
              <a href={href} target="_blank" rel="noreferrer noopener">
                {children}
              </a>
            ),
            li: ({ node, className: liClass, children }) => (
              <LineContext.Provider value={node?.position?.start.line ?? null}>
                <li className={liClass}>{children}</li>
              </LineContext.Provider>
            ),
            input: ({ type, checked }) => (type === "checkbox" ? <TaskCheckbox checked={Boolean(checked)} /> : null),
          }}
        >
          {source}
        </ReactMarkdown>
      </div>
    </ToggleContext.Provider>
  );
}
