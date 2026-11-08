"use client";
import { supabaseBrowser } from "../supabase/client";
import type { Db, Query, Row } from "./types";

export function createSupabaseDb(): Db {
  const sb = () => supabaseBrowser();
  return {
    mode: "supabase",
    async select<T>(table: string, q: Query = {}) {
      let req = sb().from(table).select("*");
      if (q.match) for (const [k, v] of Object.entries(q.match)) req = req.eq(k, v as never);
      if (q.range) {
        if (q.range.from !== undefined) req = req.gte(q.range.col, q.range.from);
        if (q.range.to !== undefined) req = req.lte(q.range.col, q.range.to);
      }
      if (q.order) req = req.order(q.order.col, { ascending: q.order.asc ?? true });
      if (q.limit) req = req.limit(q.limit);
      const { data, error } = await req;
      if (error) throw new Error(error.message);
      return (data ?? []) as T[];
    },
    async insert<T>(table: string, row: Partial<T>) {
      const { data, error } = await sb().from(table).insert(row as Row).select().single();
      if (error) throw new Error(error.message);
      return data as T;
    },
    async upsert<T>(table: string, row: Partial<T>, onConflict: string[]) {
      const { data, error } = await sb().from(table).upsert(row as Row, { onConflict: onConflict.join(",") }).select().single();
      if (error) throw new Error(error.message);
      return data as T;
    },
    async update<T>(table: string, id: string, patch: Partial<T>) {
      const { data, error } = await sb().from(table).update(patch as Row).eq("id", id).select().single();
      if (error) throw new Error(error.message);
      return data as T;
    },
    async remove(table: string, id: string) {
      const { error } = await sb().from(table).delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
  };
}
