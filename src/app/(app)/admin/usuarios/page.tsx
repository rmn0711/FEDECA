import { getUsersList } from "@/lib/tickets/queries";
import { UsersManager } from "@/components/admin/users-manager";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "Usuarios" };

export default async function UsersAdminPage() {
  const me = await requireUser();
  const users = await getUsersList();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Usuarios</h1>
        <p className="text-sm text-muted-foreground">
          Solicitantes, responsables de categoría y administradores de la mesa de ayuda.
        </p>
      </div>
      <UsersManager
        meId={me.id}
        users={users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString(), lastLoginAt: u.lastLoginAt?.toISOString() ?? null }))}
      />
    </div>
  );
}
