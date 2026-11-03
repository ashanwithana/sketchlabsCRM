import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { nextNumber } from "@/lib/numbering";
import { calcTotals } from "@/lib/quotation-calc";
import { QUOTATION_STATUSES } from "@/lib/constants";
import type { QuotationValues } from "@/lib/validation/quotation";

export class QuotationError extends Error {}

type StoredItem = {
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRateBp: number;
};

type QuotationData = {
  clientId: string;
  issueDate: Date;
  validUntil: Date;
  terms: string | null;
  notes: string | null;
  items: StoredItem[];
};

/** Issue dates sit at noon UTC so they show the same calendar day in most time zones. */
export function issueDateFrom(iso: string) {
  return new Date(`${iso}T12:00:00.000Z`);
}

/** Quotations are valid through the end of the expiry day. */
export function expiryDateFrom(iso: string) {
  return new Date(`${iso}T23:59:59.999Z`);
}

export function addDays(base: Date, days: number) {
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
}

async function writeQuotation(tx: Prisma.TransactionClient, number: string, data: QuotationData) {
  const totals = calcTotals(data.items);
  const settings = await tx.companySettings.findUnique({ where: { id: "company" }, select: { currency: true } });

  return tx.document.create({
    data: {
      type: "QUOTATION",
      number,
      clientId: data.clientId,
      status: "DRAFT",
      issueDate: data.issueDate,
      quotation: {
        create: {
          validUntil: data.validUntil,
          subtotal: totals.subtotal,
          discountTotal: totals.discountTotal,
          taxTotal: totals.taxTotal,
          grandTotal: totals.grandTotal,
          currency: settings?.currency ?? "USD",
          terms: data.terms,
          notes: data.notes,
          items: {
            create: data.items.map((item, i) => {
              const line = totals.lines[i];
              return {
                position: i + 1,
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                discount: line.discount,
                taxRateBp: item.taxRateBp,
                lineSubtotal: line.taxable,
                lineTax: line.tax,
                lineTotal: line.total,
              };
            }),
          },
        },
      },
    },
    select: { id: true, number: true },
  });
}

async function assertActiveClient(clientId: string) {
  const client = await db.client.findUnique({ where: { id: clientId }, select: { archivedAt: true } });
  if (!client || client.archivedAt) throw new QuotationError("Choose an active client.");
}

function fromInput(input: QuotationValues): QuotationData {
  return {
    clientId: input.clientId,
    issueDate: issueDateFrom(input.issueDate),
    validUntil: expiryDateFrom(input.validUntil),
    terms: input.terms,
    notes: input.notes,
    items: input.items.map((i) => ({
      description: i.description,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      discount: i.discount,
      taxRateBp: i.taxRate,
    })),
  };
}

export async function createQuotation(input: QuotationValues, actor: string) {
  await assertActiveClient(input.clientId);
  const data = fromInput(input);
  const created = await db.$transaction(async (tx) => {
    const number = await nextNumber("QUOTATION", tx);
    return writeQuotation(tx, number, data);
  });
  await logActivity({
    action: "CREATE",
    entityType: "Quotation",
    entityId: created.id,
    summary: `${actor} created quotation ${created.number}`,
  });
  return created;
}

export async function updateQuotation(id: string, input: QuotationValues, actor: string) {
  const existing = await db.document.findFirst({ where: { id, type: "QUOTATION" }, include: { quotation: true } });
  if (!existing?.quotation) throw new QuotationError("This quotation no longer exists.");
  await assertActiveClient(input.clientId);

  const data = fromInput(input);
  const totals = calcTotals(data.items);

  await db.$transaction(async (tx) => {
    await tx.quotationItem.deleteMany({ where: { quotationId: existing.quotation!.id } });
    await tx.document.update({
      where: { id },
      data: { clientId: data.clientId, issueDate: data.issueDate },
    });
    await tx.quotation.update({
      where: { id: existing.quotation!.id },
      data: {
        validUntil: data.validUntil,
        subtotal: totals.subtotal,
        discountTotal: totals.discountTotal,
        taxTotal: totals.taxTotal,
        grandTotal: totals.grandTotal,
        terms: data.terms,
        notes: data.notes,
        items: {
          create: data.items.map((item, i) => ({
            position: i + 1,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: totals.lines[i].discount,
            taxRateBp: item.taxRateBp,
            lineSubtotal: totals.lines[i].taxable,
            lineTax: totals.lines[i].tax,
            lineTotal: totals.lines[i].total,
          })),
        },
      },
    });
  });

  await logActivity({
    action: "UPDATE",
    entityType: "Quotation",
    entityId: id,
    summary: `${actor} edited quotation ${existing.number}`,
  });
}

/** Copies a quotation into a new draft with a new number, today's date, and a fresh validity period. */
export async function duplicateQuotation(id: string, actor: string, validDays: number, now: Date = new Date()) {
  const source = await db.document.findFirst({
    where: { id, type: "QUOTATION" },
    include: { quotation: { include: { items: { orderBy: { position: "asc" } } } } },
  });
  if (!source?.quotation) throw new QuotationError("This quotation no longer exists.");

  const issue = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12));
  const expiryIso = addDays(issue, validDays).toISOString().slice(0, 10);
  const data: QuotationData = {
    clientId: source.clientId,
    issueDate: issue,
    validUntil: expiryDateFrom(expiryIso),
    terms: source.quotation.terms,
    notes: source.quotation.notes,
    items: source.quotation.items.map((i) => ({
      description: i.description,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      discount: i.discount,
      taxRateBp: i.taxRateBp,
    })),
  };

  const created = await db.$transaction(async (tx) => {
    const number = await nextNumber("QUOTATION", tx, now);
    return writeQuotation(tx, number, data);
  });
  await logActivity({
    action: "CREATE",
    entityType: "Quotation",
    entityId: created.id,
    summary: `${actor} duplicated ${source.number} as ${created.number}`,
  });
  return created;
}

/** Sets a manual status. EXPIRED is computed from the validity date, so it cannot be chosen. */
export async function setQuotationStatus(id: string, status: string, actor: string) {
  if (!(QUOTATION_STATUSES as readonly string[]).includes(status) || status === "EXPIRED") {
    throw new QuotationError("Choose a valid status.");
  }
  const doc = await db.document.findFirst({ where: { id, type: "QUOTATION" }, select: { number: true, status: true } });
  if (!doc) throw new QuotationError("This quotation no longer exists.");
  if (doc.status === status) return;

  await db.$transaction(async (tx) => {
    await tx.document.update({ where: { id }, data: { status } });
    await tx.quotation.updateMany({
      where: { documentId: id },
      data: { approvedAt: status === "APPROVED" ? new Date() : null },
    });
  });

  await logActivity({
    action: "STATUS",
    entityType: "Quotation",
    entityId: id,
    summary: `${actor} changed ${doc.number} from ${doc.status} to ${status}`,
  });
}
