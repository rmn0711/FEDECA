import { getRecentEmails } from "@/lib/tickets/queries";
import { smtpConfigured } from "@/lib/email/send";
import { EmailLog } from "@/components/admin/email-log";

export const metadata = { title: "Registro de correos" };

export default async function EmailsAdminPage() {
  const emails = await getRecentEmails(200);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Registro de correos</h1>
        <p className="text-sm text-muted-foreground">Últimos 200 correos enviados por la mesa de ayuda, con destinatarios y estado.</p>
      </div>
      <EmailLog
        smtp={smtpConfigured()}
        emails={emails.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() }))}
      />
    </div>
  );
}
