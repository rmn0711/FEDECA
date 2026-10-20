import type { Role } from "@/lib/constants";

type Actor = { id: number; role: Role };
type TicketRef = { requesterId: number; assigneeId: number | null };

export function canViewTicket(user: Actor, t: TicketRef, responsibleId: number | null) {
  if (user.role === "admin") return true;
  if (t.requesterId === user.id) return true;
  return user.role === "agent" && (t.assigneeId === user.id || responsibleId === user.id);
}

/** Puede cambiar estado, asignar, cambiar urgencia y escribir notas internas. */
export function canManageTicket(user: Actor, t: TicketRef, responsibleId: number | null) {
  if (user.role === "admin") return true;
  return user.role === "agent" && (t.assigneeId === user.id || responsibleId === user.id);
}

export class TicketError extends Error {}
