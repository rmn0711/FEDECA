import "server-only";
import nodemailer from "nodemailer";
import { getDb } from "@/lib/db";
import { emailLog } from "@/lib/db/schema";

// Mismo esquema que el cotizador: SMTP de una casilla real de Microsoft 365
// (STARTTLS por el puerto 587). Si SMTP_USER / SMTP_PASSWORD no están
// configuradas, el correo queda en el registro como "simulado" y la
// solicitud se procesa igual.
let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

export function smtpConfigured() {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASSWORD);
}

function getTransporter() {
  if (transporter) return transporter;
  const port = Number(process.env.SMTP_PORT || 587);
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.office365.com",
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
  });
  return transporter;
}

export type OutgoingEmail = {
  ticketId?: number | null;
  kind: string;
  to: string[];
  cc?: string[];
  subject: string;
  html: string;
  text: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Normaliza, quita duplicados y saca de "cc" lo que ya va en "to". */
export function normalizeRecipients(to: string[], cc: string[] = []) {
  const clean = (list: string[]) =>
    Array.from(new Set(list.map((e) => e.trim().toLowerCase()).filter((e) => EMAIL_RE.test(e))));
  let toList = clean(to);
  let ccList = clean(cc).filter((e) => !toList.includes(e));
  if (toList.length === 0 && ccList.length > 0) {
    toList = [ccList[0]];
    ccList = ccList.slice(1);
  }
  return { to: toList, cc: ccList };
}

export async function sendEmail(email: OutgoingEmail) {
  const { to, cc } = normalizeRecipients(email.to, email.cc);
  if (to.length === 0) return;

  let status = "simulado";
  let error: string | null = null;

  if (smtpConfigured()) {
    try {
      const user = process.env.SMTP_USER!;
      await getTransporter().sendMail({
        from: `${process.env.SMTP_FROM_NAME || "Conecta ACF"} <${process.env.SMTP_FROM || user}>`,
        replyTo: process.env.MAIL_REPLY_TO || undefined,
        to,
        cc: cc.length ? cc : undefined,
        subject: email.subject,
        html: email.html,
        text: email.text,
      });
      status = "enviado";
    } catch (e) {
      status = "fallido";
      error = e instanceof Error ? e.message : String(e);
      console.error("[conecta] Error enviando correo:", error);
    }
  } else {
    console.info(`[conecta] (correo simulado) ${email.subject} → ${to.join(", ")}${cc.length ? ` cc ${cc.join(", ")}` : ""}`);
  }

  const db = await getDb();
  await db.insert(emailLog).values({
    ticketId: email.ticketId ?? null,
    kind: email.kind,
    to: to.join(", "),
    cc: cc.join(", ") || null,
    subject: email.subject,
    html: email.html,
    status,
    error,
  });
}
