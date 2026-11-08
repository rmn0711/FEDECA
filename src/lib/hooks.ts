"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "./app-context";
import type { Query } from "./db";

/** Lee una tabla (con filtros) y ofrece operaciones de escritura que recargan los datos. */
export function useTable<T extends { id?: string }>(table: string, query: Query | null, deps: unknown[] = []) {
  const { db } = useApp();
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  const qref = useRef(query);
  qref.current = query;
  const key = JSON.stringify(query);

  useEffect(() => {
    let cancelled = false;
    if (!qref.current) return;
    db.select<T>(table, qref.current)
      .then((r) => {
        if (!cancelled) {
          setRows(r);
          setLoading(false);
        }
      })
      .catch(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, table, key, version, ...deps]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const insert = useCallback(async (row: Partial<T>) => { const r = await db.insert<T>(table, row); reload(); return r; }, [db, table, reload]);
  const upsert = useCallback(async (row: Partial<T>, on: string[]) => { const r = await db.upsert<T>(table, row, on); reload(); return r; }, [db, table, reload]);
  const update = useCallback(async (id: string, patch: Partial<T>) => { const r = await db.update<T>(table, id, patch); reload(); return r; }, [db, table, reload]);
  const remove = useCallback(async (id: string) => { await db.remove(table, id); reload(); }, [db, table, reload]);
  return { rows, loading, reload, insert, upsert, update, remove };
}
