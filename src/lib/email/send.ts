import "server-only";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { getEnv } from "@/lib/env";
import { getCompanySettings } from "@/lib/settings";
import { ensurePdfRevision } from "@/lib/documents/pdf-revisions";
import { readStoredFile } from "@/lib/storage";
import { formatMoney } from "@/lib/money";
import { setQuotationStatus } from "@/lib/quotations/service";
import { parseRecipients } from "./recipients";
import { cleanSubject, renderTemplate } from "./template";
import { configuredMode, deliver, type Delivery, type OutgoingEmail } from "./transport";

export class EmailError extends Error {}

type DeliverFn = (email: OutgoingEmail) => Promise<Delivery>;

export type SendResult =
  | { ok: true; logId: string; mode: string; outboxPath: string | null; message: string }
  | { ok: false; logId: string | null; error: string };

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

function senderAddress(companyName: string, companyEmail: string | null): string {
  const env = getEnv();
  const address = env.SMTP_FROM || companyEmail || env.SMTP_USER || "no-reply@localhost";
  const name = companyName.replace(/[<>"\r\n]/g, "").trim() || "Client Manager";
  return `${name} <${address}>`;
}

function friendlyError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (/ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ECONNRESET|connection timeout|Greeting never received/i.test(raw)) {
    return "The mail server could not be reached. Check the SMTP settings in .env.";
  }
  if (/Invalid login|authentication failed|EAUTH/i.test(raw)) {
    return "The mail server rejected the login. Check SMTP_USER and SMTP_PASSWORD.";
  }
  return raw.slice(0, 300);
}

/** Writes the log row first, so every attempt is recorded even if the process stops mid-send. */
async function deliverAndLog(params: {
  documentId: string | null;
  revisionId: string | null;
  clientId: string | null;
  to: string[];
  cc: string[];
  subject: string;
  body: string;
  attachment: { filename: string; content: Buffer; contentType: string } | null;
  actor: string;
  from: string;
  deliverFn: DeliverFn;
}): Promise<SendResult> {
  const log = await db.emailLog.create({
    data: {
      documentId: params.documentId,
      revisionId: params.revisionId,
      clientId: params.clientId,
      toAddress: params.to.join(", "),
      ccAddress: params.cc.length ? params.cc.join(", ") : null,
      subject: params.subject,
      body: params.body,
      attachment: params.attachment?.filename ?? null,
      status: "QUEUED",
      mode: configuredMode(),
    },
  });

  try {
    const delivery = await params.deliverFn({
      from: params.from,
      to: params.to,
      cc: params.cc,
      subject: params.subject,
      text: params.body,
      attachment: params.attachment ?? undefined,
    });
    await db.emailLog.update({
      where: { id: log.id },
      data: { status: "SENT", mode: delivery.mode, outboxPath: delivery.outboxPath },
    });
    await logActivity({
      action: "EMAIL",
      entityType: params.documentId ? "Document" : "Email",
      entityId: params.documentId,
      summary: `${params.actor} emailed ${params.to.join(", ")}: ${params.subject}`,
    });
    const where = delivery.mode === "SMTP" ? `sent to ${params.to.join(", ")}` : "saved to the dev outbox (SMTP is not configured)";
    return { ok: true, logId: log.id, mode: delivery.mode, outboxPath: delivery.outboxPath, message: `Email ${where}.` };
  } catch (err) {
    const error = friendlyError(err);
    await db.emailLog.update({ where: { id: log.id }, data: { status: "FAILED", error } });
    await logActivity({
      action: "EMAIL",
      entityType: params.documentId ? "Document" : "Email",
      entityId: params.documentId,
      summary: `${params.actor} could not email ${params.to.join(", ")}: ${error}`,
    });
    return { ok: false, logId: log.id, error };
  }
}

export type SendInput = { documentId: string; to: string; cc: string; subject: string; body: string };

/** Emails a document with its latest PDF revision attached. */
export async function sendDocumentEmail(input: SendInput, actor: string, deliverFn: DeliverFn = deliver): Promise<SendResult> {
  const to = parseRecipients(input.to, { required: true });
  if (!to.ok) throw new EmailError(to.error);
  const cc = parseRecipients(input.cc, { required: false });
  if (!cc.ok) throw new EmailError(cc.error);

  const subject = cleanSubject(input.subject);
  const body = input.body.trim();
  if (!subject) throw new EmailError("Enter a subject.");
  if (!body) throw new EmailError("Enter a message.");

  const doc = await db.document.findUnique({ where: { id: input.documentId }, select: { id: true, type: true, number: true, status: true, clientId: true } });
  if (!doc) throw new EmailError("This document no longer exists.");

  const pdf = await ensurePdfRevision(doc.id, actor);
  const revision = await db.documentRevision.findFirst({ where: { documentId: doc.id, revision: pdf.revision } });
  const company = await getCompanySettings();

  const result = await deliverAndLog({
    documentId: doc.id,
    revisionId: revision?.id ?? null,
    clientId: doc.clientId,
    to: to.emails,
    cc: cc.emails,
    subject,
    body,
    attachment: { filename: `${doc.number}-rev${pdf.revision}.pdf`, content: pdf.buffer, contentType: "application/pdf" },
    actor,
    from: senderAddress(company.companyName, company.email),
    deliverFn,
  });

  // Sending a draft quotation moves it to Sent. Later statuses (pending, approved) are not overwritten.
  if (result.ok && doc.type === "QUOTATION" && doc.status === "DRAFT") {
    await setQuotationStatus(doc.id, "SENT", actor);
  }
  return result;
}

/** Re-sends a failed email with the same recipients, message, and stored PDF revision. */
export async function retryEmail(logId: string, actor: string, deliverFn: DeliverFn = deliver): Promise<SendResult> {
  const log = await db.emailLog.findUnique({ where: { id: logId }, include: { revision: true } });
  if (!log) throw new EmailError("This email could not be found.");
  if (log.status !== "FAILED") throw new EmailError("Only failed emails can be retried.");

  let attachment: { filename: string; content: Buffer; contentType: string } | null = null;
  if (log.attachment) {
    if (!log.revision) throw new EmailError("The PDF for this email is no longer stored. Send it again from the document.");
    try {
      attachment = { filename: log.attachment, content: await readStoredFile(log.revision.filePath), contentType: "application/pdf" };
    } catch {
      throw new EmailError("The PDF for this email is missing from storage. Send it again from the document.");
    }
  }

  const company = await getCompanySettings();
  return deliverAndLog({
    documentId: log.documentId,
    revisionId: log.revisionId,
    clientId: log.clientId,
    to: log.toAddress.split(", ").filter(Boolean),
    cc: log.ccAddress ? log.ccAddress.split(", ").filter(Boolean) : [],
    subject: log.subject,
    body: log.body,
    attachment,
    actor,
    from: senderAddress(company.companyName, company.email),
    deliverFn,
  });
}

export async function sendTestEmail(to: string, actor: string, deliverFn: DeliverFn = deliver): Promise<SendResult> {
  const parsed = parseRecipients(to, { required: true, max: 1 });
  if (!parsed.ok) throw new EmailError(parsed.error);
  const company = await getCompanySettings();
  return deliverAndLog({
    documentId: null,
    revisionId: null,
    clientId: null,
    to: parsed.emails,
    cc: [],
    subject: "Test email from Client Manager",
    body: "This is a test message. If you received it, outgoing email is working.",
    attachment: null,
    actor,
    from: senderAddress(company.companyName, company.email),
    deliverFn,
  });
}

/** Pre-filled values for the send dialog, built from the templates in Settings. */
export async function buildEmailDefaults(documentId: string) {
  const doc = await db.document.findUnique({
    where: { id: documentId },
    include: { client: true, quotation: true },
  });
  if (!doc) throw new EmailError("This document no longer exists.");

  const company = await getCompanySettings();
  const vars = {
    contact: doc.client.contactPerson,
    client: doc.client.companyName,
    number: doc.number,
    company: company.companyName,
    date: isoDay(doc.issueDate),
    validUntil: doc.quotation ? isoDay(doc.quotation.validUntil) : undefined,
    amount: doc.quotation ? formatMoney(doc.quotation.grandTotal, doc.quotation.currency) : undefined,
  };

  const templates =
    doc.type === "QUOTATION"
      ? { subject: company.emailQuotationSubject, body: company.emailQuotationBody }
      : doc.type === "CR"
        ? { subject: company.emailCrSubject, body: company.emailCrBody }
        : { subject: company.emailMaintenanceSubject, body: company.emailMaintenanceBody };

  return {
    to: doc.client.email,
    cc: "",
    subject: cleanSubject(renderTemplate(templates.subject, vars)),
    body: renderTemplate(templates.body, vars),
    number: doc.number,
    clientName: doc.client.companyName,
  };
}
