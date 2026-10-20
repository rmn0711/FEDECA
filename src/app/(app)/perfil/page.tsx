import { requireUser } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/constants";
import { ProfileForms } from "@/components/profile/profile-forms";

export const metadata = { title: "Mi perfil" };

export default async function ProfilePage() {
  const user = await requireUser();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Mi perfil</h1>
        <p className="text-sm text-muted-foreground">
          {user.email} · {ROLE_LABELS[user.role]}
        </p>
      </div>
      <ProfileForms name={user.name} department={user.department ?? ""} phone={user.phone ?? ""} />
    </div>
  );
}
