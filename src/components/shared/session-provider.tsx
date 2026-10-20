"use client";

import { createContext, useContext } from "react";
import type { Role } from "@/lib/constants";

export type ClientSession = { id: number; name: string; email: string; role: Role; department: string | null; unreadChat: number };

const SessionContext = createContext<ClientSession | null>(null);

export function SessionProvider({ session, children }: { session: ClientSession; children: React.ReactNode }) {
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSession debe usarse dentro de SessionProvider");
  return {
    session,
    isAdmin: session.role === "admin",
    isStaff: session.role === "admin" || session.role === "agent",
  };
}
