"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { Pencil, Search, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { saveUserAction } from "@/lib/actions/admin";
import type { FormState } from "@/lib/actions/auth";
import { ROLES, ROLE_LABELS, type Role } from "@/lib/constants";
import { formatDate, relativeTime } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UserAvatar } from "@/components/shared/user-avatar";

type UserRow = {
  id: number;
  name: string;
  email: string;
  role: Role;
  department: string | null;
  phone: string | null;
  active: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  tickets: number;
};

const ROLE_VARIANT: Record<Role, "default" | "info" | "neutral"> = { admin: "default", agent: "info", user: "neutral" };
const initialState: FormState = { error: null };

function UserDialog({ user, open, onClose, meId }: { user: UserRow | null; open: boolean; onClose: () => void; meId: number }) {
  const [state, action] = useActionState(saveUserAction, initialState);
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    if (state.error) toast.error(state.error);
    if (state.ok) {
      toast.success(state.ok);
      onClose();
    }
    // Solo reacciona a un nuevo resultado de la acción.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form
          key={user?.id ?? "new"}
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            startTransition(() => action(fd));
          }}
          className="space-y-4"
        >
          <DialogHeader>
            <DialogTitle>{user ? "Editar usuario" : "Nuevo usuario"}</DialogTitle>
            <DialogDescription>
              Los <strong>Responsables</strong> atienden solicitudes de sus categorías; los <strong>Administradores</strong> ven y gestionan todo.
            </DialogDescription>
          </DialogHeader>
          <input type="hidden" name="id" value={user?.id ?? ""} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="u-name">Nombre completo *</Label>
              <Input id="u-name" name="name" defaultValue={user?.name} required />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="u-email">Correo *</Label>
              <Input id="u-email" name="email" type="email" defaultValue={user?.email} required />
            </div>
            <div className="space-y-1.5">
              <Label>Rol *</Label>
              <Select name="role" defaultValue={user?.role ?? "user"}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Estado</Label>
              <Select name="active" defaultValue={user?.active === false ? "off" : "on"}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="on">Activo</SelectItem>
                  <SelectItem value="off" disabled={user?.id === meId}>
                    Inactivo
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="u-dep">Área / cargo</Label>
              <Input id="u-dep" name="department" defaultValue={user?.department ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="u-phone">Teléfono</Label>
              <Input id="u-phone" name="phone" defaultValue={user?.phone ?? ""} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="u-pass">{user ? "Nueva contraseña (dejar vacío para no cambiar)" : "Contraseña temporal *"}</Label>
              <Input id="u-pass" name="password" type="text" autoComplete="new-password" required={!user} placeholder="Mínimo 8 caracteres, letras y números" />
            </div>
            {!user && (
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input type="checkbox" name="sendWelcome" defaultChecked className="size-4 accent-[#d9342c]" />
                Enviar correo de bienvenida con el acceso
              </label>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function UsersManager({ users, meId }: { users: UserRow[]; meId: number }) {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<string>("all");
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return users.filter(
      (u) =>
        (role === "all" || u.role === role) &&
        (!s || u.name.toLowerCase().includes(s) || u.email.includes(s) || u.department?.toLowerCase().includes(s))
    );
  }, [users, search, role]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar por nombre, correo o área…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
          </div>
          <Select value={role} onValueChange={(v) => setRole(String(v))}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los roles</SelectItem>
              {ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {ROLE_LABELS[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            className="ml-auto"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <UserPlus className="size-4" />
            Nuevo usuario
          </Button>
        </CardContent>
      </Card>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuario</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead className="hidden md:table-cell">Área</TableHead>
              <TableHead className="hidden md:table-cell">Solicitudes</TableHead>
              <TableHead className="hidden lg:table-cell">Último ingreso</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="p-0">
                  <EmptyState icon={Users} title="No hay usuarios que coincidan" />
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((u) => (
                <TableRow key={u.id} className={u.active ? undefined : "opacity-55"}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <UserAvatar fullName={u.name} />
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {u.name} {!u.active && <Badge variant="neutral">Inactivo</Badge>}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={ROLE_VARIANT[u.role]}>{ROLE_LABELS[u.role]}</Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{u.department ?? "—"}</TableCell>
                  <TableCell className="hidden tabular-nums md:table-cell">{u.tickets}</TableCell>
                  <TableCell className="hidden text-muted-foreground lg:table-cell" title={`Creado ${formatDate(u.createdAt)}`}>
                    {u.lastLoginAt ? relativeTime(u.lastLoginAt) : "Nunca"}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Editar ${u.name}`}
                      onClick={() => {
                        setEditing(u);
                        setOpen(true);
                      }}
                    >
                      <Pencil className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <UserDialog user={editing} open={open} onClose={() => setOpen(false)} meId={meId} />
    </div>
  );
}
