import { requireRole } from "@/lib/auth";
import { getCategoriesWithResponsible, getStaff } from "@/lib/tickets/queries";
import { CategoryCard } from "@/components/admin/category-card";
import { CATEGORIES } from "@/lib/categories";

export const metadata = { title: "Categorías y responsables" };

export default async function CategoriesAdminPage() {
  // Además del layout: cada página valida el rol (las páginas y el layout se generan en paralelo).
  await requireRole("admin");
  const [categories, staff] = await Promise.all([getCategoriesWithResponsible(), getStaff()]);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Categorías y responsables</h1>
        <p className="text-sm text-muted-foreground">
          Cada categoría tiene un responsable: recibe en copia cada solicitud nueva y queda asignado automáticamente. Para que una persona
          aparezca en la lista, créala en Usuarios con rol <strong>Responsable</strong>.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {CATEGORIES.map((def) => {
          const c = categories.find((x) => x.slug === def.slug);
          if (!c) return null;
          return (
            <CategoryCard
              key={def.slug}
              slug={def.slug}
              name={def.name}
              description={def.description}
              fieldCount={def.fields.length}
              responsibleId={c.responsibleId}
              ccEmails={c.ccEmails ?? ""}
              active={c.active}
              staff={staff.map((s) => ({ id: s.id, name: s.name, email: s.email }))}
            />
          );
        })}
      </div>
    </div>
  );
}
