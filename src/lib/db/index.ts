"use client";
import { isSupabaseConfigured } from "../supabase/client";
import { createLocalDb } from "./local";
import { createSupabaseDb } from "./supabase";
import type { Db } from "./types";

let db: Db | null = null;
export function getDb(): Db {
  db ??= isSupabaseConfigured ? createSupabaseDb() : createLocalDb();
  return db;
}
export type { Db, Query, Row } from "./types";
