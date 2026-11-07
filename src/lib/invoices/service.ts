import "server-only";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { nextNumber } from "@/lib/numbering";
import { getCompanySettings } from "@/lib/settings";
import { calcLine, calcTotals } from "@/lib/quotation-calc";
import { formatMoney } from "@/lib/money";
import { BILLING_CYCLES, type BillingCycle } from "@/lib/constants";
import { sendDocumentEmail, EmailError, type SendResult } from "@/lib/email/send";
import { firstDue, nextDue, todayIn, BILLING_TIMEZONE } from "./schedule";

export class InvoiceError extends Error {}

export type GenerateResult = { documentId: string; number: string; grandTotal: number; currency: string };

function monthsFor(cycle: string): number {
  const found = BILLING_CYCLES.find((c) => c.value === cycle);
  if (!found) throw new InvoiceError(`Unknown billing cycle: ${cycle}.`);
  return found.months;
}

/**
 * Creates an invoice from the client's current recurring services. The service list is
 * snapshotted onto the invoice, so later edits to the services never change a sent invoice.
 * `periodStart` links the invoice to the billing period it settles (null for one-offs).
 */
export async function generateInvoice(
  clientId: string,
  actor: string,
  opts: { periodStart?: Date | null; dueDate?: Date } = {},
): Promise<GenerateResult> {
  const client = await db.client.findUnique({ where: { id: clientId }, select: { id: true, companyName: true, clientCode: true, archivedAt: true } });
  if (!client) throw new InvoiceError("This client no longer exists.");
  if (client.archivedAt) throw new InvoiceError("Archived clients are not invoiced.");

  const services = await db.clientService.findMany({ where: { clientId }, orderBy: { createdAt: "asc" } });
  if (services.length === 0) throw new InvoiceError("Add at least one recurring service before generating an invoice.");

  const company = await getCompanySettings();
  const currency = company.currency;
  const dueDate = opts.dueDate ?? opts.periodStart ?? new Date();

  // One line per service; quantity is always 1 for a recurring fee.
  const calcInput = services.map((s) => ({ quantity: 1, unitPrice: s.amount, discount: 0, taxRateBp: s.taxRateBp }));
  const totals = calcTotals(calcInput);

  return await db.$transaction(async (t) => {
    const number = await nextNumber("INV", t);
    const doc = await t.document.create({
      data: { type: "INVOICE", number, clientId, status: "DRAFT", issueDate: new Date() },
    });
    await t.invoice.create({
      data: {
        documentId: doc.id,
        periodStart: opts.periodStart ?? null,
        dueDate,
        currency,
        subtotal: totals.subtotal,
        taxTotal: totals.taxTotal,
        grandTotal: totals.grandTotal,
        lines: {
          create: services.map((s, i) => {
            const line = calcLine({ quantity: 1, unitPrice: s.amount, discount: 0, taxRateBp: s.taxRateBp });
            return {
              position: i + 1,
              description: s.description,
              unitPrice: s.amount,
              taxRateBp: s.taxRateBp,
              lineTax: line.tax,
              lineTotal: line.total,
            };
          }),
        },
      },
    });
    await logActivity({
      action: "CREATE",
      entityType: "Document",
      entityId: doc.id,
      summary: `${actor} created invoice ${number} for ${client.companyName}`,
    });
    return { documentId: doc.id, number, grandTotal: totals.grandTotal, currency };
  });
}

/** Emails an invoice to its client with the PDF attached; DRAFT invoices move to SENT. */
export async function sendInvoiceEmail(documentId: string, actor: string): Promise<SendResult> {
  const doc = await db.document.findUnique({
    where: { id: documentId },
    include: { client: true, invoice: true },
  });
  if (!doc?.invoice) throw new InvoiceError("This invoice no longer exists.");
  if (doc.type !== "INVOICE") throw new InvoiceError("This document is not an invoice.");

  const company = await getCompanySettings();
  const amount = formatMoney(doc.invoice.grandTotal, doc.invoice.currency);
  const subject = `${company.companyName} · Invoice ${doc.number}`;
  const body = [
    `Hello ${doc.client.contactPerson},`,
    "",
    `Please find invoice ${doc.number} for the maintenance of ${doc.client.companyName}.`,
    "",
    `Amount: ${amount}`,
    `Due date: ${doc.invoice.dueDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`,
    "",
    "The bank details are in the attached invoice.",
    "",
    `Kind regards,`,
    company.companyName,
  ].join("\n");

  const result = await sendDocumentEmail(
    { documentId, to: doc.client.email, cc: "", subject, body },
    actor,
  );

  if (result.ok && doc.status === "DRAFT") {
    await db.document.update({ where: { id: documentId }, data: { status: "SENT" } });
    await logActivity({
      action: "STATUS",
      entityType: "Document",
      entityId: documentId,
      summary: `${actor} emailed invoice ${doc.number} to ${doc.client.email}`,
    });
  }
  return result;
}

/** Generates and emails an invoice immediately, outside any schedule (one-off). */
export async function sendInvoiceNow(clientId: string, actor: string): Promise<{ documentId: string; number: string; result: SendResult }> {
  const created = await generateInvoice(clientId, actor);
  const result = await sendInvoiceEmail(created.documentId, actor);
  return { documentId: created.documentId, number: created.number, result };
}

export type ScheduledRun = {
  checked: number;
  generated: number;
  sent: number;
  failed: number;
  results: { client: string; number?: string; ok: boolean; error?: string }[];
};

/**
 * The cron entry point: for every client with an active schedule whose next due date
 * has arrived (today, in the billing timezone), one invoice is generated and emailed.
 * At most one invoice per client per run, so a backlog catches up over successive days
 * instead of flooding the client.
 */
export async function runScheduledInvoices(now: Date = new Date()): Promise<ScheduledRun> {
  const today = todayIn(BILLING_TIMEZONE, now);
  const clients = await db.client.findMany({
    where: { archivedAt: null, billingActive: true, billingCycle: { not: null }, billingDay: { not: null } },
    select: { id: true, companyName: true, billingCycle: true, billingDay: true, billingAnchor: true },
  });

  const run: ScheduledRun = { checked: clients.length, generated: 0, sent: 0, failed: 0, results: [] };

  for (const client of clients) {
    try {
      const cycle = client.billingCycle as BillingCycle;
      const months = monthsFor(cycle);
      const day = client.billingDay ?? 1;

      const last = await db.invoice.findFirst({
        where: { periodStart: { not: null }, document: { clientId: client.id } },
        orderBy: { periodStart: "desc" },
        select: { periodStart: true },
      });
      const due = last?.periodStart
        ? nextDue(last.periodStart, months, day)
        : firstDue(client.billingAnchor ?? now, day);

      // Not due yet — nothing to do for this client today.
      if (due.getTime() > today.getTime()) continue;

      const created = await generateInvoice(client.id, "Billing cron", { periodStart: due, dueDate: due });
      run.generated += 1;
      const result = await sendInvoiceEmail(created.documentId, "Billing cron");
      if (result.ok) run.sent += 1;
      else run.failed += 1;
      run.results.push({
        client: client.companyName,
        number: created.number,
        ok: result.ok,
        ...(result.ok ? {} : { error: result.error }),
      });
    } catch (err) {
      run.failed += 1;
      const error = err instanceof InvoiceError || err instanceof EmailError ? err.message : err instanceof Error ? err.message : String(err);
      run.results.push({ client: client.companyName, ok: false, error: error.slice(0, 300) });
    }
  }

  if (run.generated > 0) {
    console.log(`Invoice cron: generated ${run.generated}, sent ${run.sent}, failed ${run.failed}`);
  }
  return run;
}
