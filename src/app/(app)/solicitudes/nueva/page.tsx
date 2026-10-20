import { requireUser } from "@/lib/auth";
import { getCategoriesWithResponsible } from "@/lib/tickets/queries";
import { NewTicketWizard } from "@/components/tickets/new-ticket-wizard";

export const metadata = { title: "Nueva solicitud" };

export default async function NewTicketPage({ searchParams }: { searchParams: Promise<{ categoria?: string }> }) {
  await requireUser();
  const { categoria } = await searchParams;
  const categories = await getCategoriesWithResponsible();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nueva solicitud</h1>
        <p className="text-sm text-muted-foreground">
          Cuéntanos qué necesitas. El responsable del área y tú recibirán una copia por correo y podrás hacer seguimiento aquí.
        </p>
      </div>
      <NewTicketWizard
        initialCategory={categoria}
        categories={categories
          .filter((c) => c.active)
          .map((c) => ({ slug: c.slug, responsibleName: c.responsibleName }))}
      />
    </div>
  );
}
