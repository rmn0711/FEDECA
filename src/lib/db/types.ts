export type Row = Record<string, unknown> & { id?: string };

export interface Query {
  match?: Record<string, unknown>;
  /** rango inclusivo sobre una columna (fechas ISO o números) */
  range?: { col: string; from?: string | number; to?: string | number };
  order?: { col: string; asc?: boolean };
  limit?: number;
}

export interface Db {
  mode: "supabase" | "local";
  select<T = Row>(table: string, q?: Query): Promise<T[]>;
  insert<T = Row>(table: string, row: Partial<T>): Promise<T>;
  upsert<T = Row>(table: string, row: Partial<T>, onConflict: string[]): Promise<T>;
  update<T = Row>(table: string, id: string, patch: Partial<T>): Promise<T>;
  remove(table: string, id: string): Promise<void>;
}
