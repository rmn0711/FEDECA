// Modo demo: guarda todo en localStorage del navegador (sin Supabase). Útil para probar la app.
import type { Db, Query, Row } from "./types";

const KEY = (t: string) => `fedeca:v1:${t}`;
const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

function read(table: string): Row[] {
  try {
    return JSON.parse(localStorage.getItem(KEY(table)) ?? "[]");
  } catch {
    return [];
  }
}
function write(table: string, rows: Row[]) {
  try {
    localStorage.setItem(KEY(table), JSON.stringify(rows));
  } catch {
    /* almacenamiento lleno o bloqueado */
  }
}

export function createLocalDb(): Db {
  return {
    mode: "local",
    async select<T>(table: string, q: Query = {}) {
      let rows = read(table);
      if (q.match) rows = rows.filter((r) => Object.entries(q.match!).every(([k, v]) => r[k] === v));
      if (q.range) {
        const { col, from, to } = q.range;
        rows = rows.filter((r) => {
          const v = r[col] as string | number;
          return (from === undefined || v >= from) && (to === undefined || v <= to);
        });
      }
      if (q.order) {
        const { col, asc = true } = q.order;
        rows = [...rows].sort((a, b) => ((a[col] as string) > (b[col] as string) ? 1 : (a[col] as string) < (b[col] as string) ? -1 : 0) * (asc ? 1 : -1));
      }
      if (q.limit) rows = rows.slice(0, q.limit);
      return rows as T[];
    },
    async insert<T>(table: string, row: Partial<T>) {
      const rows = read(table);
      const r = { id: uid(), ...(row as Row) };
      rows.push(r);
      write(table, rows);
      return r as T;
    },
    async upsert<T>(table: string, row: Partial<T>, onConflict: string[]) {
      const rows = read(table);
      const r = row as Row;
      const i = rows.findIndex((x) => onConflict.every((k) => x[k] === r[k]));
      if (i >= 0) {
        rows[i] = { ...rows[i], ...r };
        write(table, rows);
        return rows[i] as T;
      }
      const created = { id: uid(), ...r };
      rows.push(created);
      write(table, rows);
      return created as T;
    },
    async update<T>(table: string, id: string, patch: Partial<T>) {
      const rows = read(table);
      const i = rows.findIndex((x) => x.id === id);
      if (i < 0) throw new Error("No encontrado");
      rows[i] = { ...rows[i], ...(patch as Row) };
      write(table, rows);
      return rows[i] as T;
    },
    async remove(table: string, id: string) {
      write(table, read(table).filter((x) => x.id !== id));
    },
  };
}

export const LOCAL_HOUSEHOLD_ID = "local-household";
