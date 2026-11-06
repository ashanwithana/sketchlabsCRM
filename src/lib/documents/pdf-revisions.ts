import "server-only";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { getCompanySettings } from "@/lib/settings";
import { contentTypeFor, readStoredFile } from "@/lib/storage";
import { QuotationDocument, type QuotationPdfData } from "@/lib/pdf/quotation-template";
import { PDF_TEMPLATE_VERSION } from "@/lib/pdf/layout";
import { renderHtml, htmlToPdf } from "@/lib/pdf/render";
import { PdfError } from "./errors";
import { loadCrSource } from "./cr-source";
import { loadMaintenanceSource } from "./maintenance-source";

export { PdfError } from "./errors";

export type PdfResult = {
  buffer: Buffer;
  revision: number;
  reference: string;
  reused: boolean;
};

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

async function imageDataUri(relative: string | null): Promise<string | null> {
  if (!relative) return null;
  try {
    const bytes = await readStoredFile(relative);
    return `data:${contentTypeFor(relative)};base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

function sha256(input: Buffer | string) {
  return createHash("sha256").update(input).digest("hex");
}

/**
 * Builds everything the PDF prints, plus a canonical snapshot used for the content hash.
 * Internal notes are not printed, so they are left out of the hash too.
 */
async function loadQuotationSource(documentId: string) {
  const doc = await db.document.findFirst({
    where: { id: documentId, type: "QUOTATION" },
    include: {
      client: true,
      quotation: { include: { items: { orderBy: { position: "asc" } } } },
    },
  });
  if (!doc?.quotation) throw new PdfError("This quotation no longer exists.");

  const company = await getCompanySettings();
  const logoBytes = company.logoPath ? await readStoredFile(company.logoPath).catch(() => null) : null;
  const sigBytes = company.signaturePath ? await readStoredFile(company.signaturePath).catch(() => null) : null;

  const snapshot = {
    type: "QUOTATION",
    template: PDF_TEMPLATE_VERSION,
    reference: doc.number,
    issueDate: isoDay(doc.issueDate),
    validUntil: isoDay(doc.quotation.validUntil),
    currency: doc.quotation.currency,
    terms: doc.quotation.terms,
    totals: [doc.quotation.subtotal, doc.quotation.discountTotal, doc.quotation.taxTotal, doc.quotation.grandTotal],
    items: doc.quotation.items.map((i) => [
      i.position,
      i.description,
      i.quantity,
      i.unitPrice,
      i.discount,
      i.taxRateBp,
      i.lineTotal,
    ]),
    client: [
      doc.client.clientCode,
      doc.client.companyName,
      doc.client.contactPerson,
      doc.client.email,
      doc.client.phone,
      doc.client.billingAddress,
      doc.client.registrationNumber,
      doc.client.vatNumber,
    ],
    company: [
      company.companyName,
      company.tagline,
      company.addressLine,
      company.phone,
      company.email,
      company.website,
      company.registrationNumber,
      company.vatNumber,
      company.bankName,
      company.bankAccountName,
      company.bankAccountNumber,
      company.bankBranch,
    ],
    logoSha: logoBytes ? sha256(logoBytes) : null,
    signatureSha: sigBytes ? sha256(sigBytes) : null,
  };

  const data: QuotationPdfData = {
    reference: doc.number,
    issueDate: snapshot.issueDate,
    validUntil: snapshot.validUntil,
    currency: snapshot.currency,
    terms: doc.quotation.terms,
    client: {
      companyName: doc.client.companyName,
      clientCode: doc.client.clientCode,
      contactPerson: doc.client.contactPerson,
      email: doc.client.email,
      phone: doc.client.phone,
      billingAddress: doc.client.billingAddress,
      registrationNumber: doc.client.registrationNumber,
      vatNumber: doc.client.vatNumber,
    },
    company: {
      companyName: company.companyName,
      tagline: company.tagline,
      addressLine: company.addressLine,
      phone: company.phone,
      email: company.email,
      website: company.website,
      registrationNumber: company.registrationNumber,
      vatNumber: company.vatNumber,
      bankName: company.bankName,
      bankAccountName: company.bankAccountName,
      bankAccountNumber: company.bankAccountNumber,
      bankBranch: company.bankBranch,
    },
    items: doc.quotation.items.map((i) => ({
      position: i.position,
      description: i.description,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      discount: i.discount,
      taxRateBp: i.taxRateBp,
      lineTotal: i.lineTotal,
    })),
    subtotal: doc.quotation.subtotal,
    discountTotal: doc.quotation.discountTotal,
    taxTotal: doc.quotation.taxTotal,
    grandTotal: doc.quotation.grandTotal,
    logoSrc: logoBytes && company.logoPath ? await imageDataUri(company.logoPath) : null,
    signatureSrc: sigBytes && company.signaturePath ? await imageDataUri(company.signaturePath) : null,
  };

  return { doc, snapshot, element: QuotationDocument(data) };
}

/** Picks the right source loader for the document type. */
async function loadSource(documentId: string) {
  const row = await db.document.findUnique({ where: { id: documentId }, select: { type: true } });
  if (!row) throw new PdfError("This document no longer exists.");
  if (row.type === "QUOTATION") return loadQuotationSource(documentId);
  if (row.type === "CR") return loadCrSource(documentId);
  if (row.type === "MAINTENANCE") return loadMaintenanceSource(documentId);
  throw new PdfError("PDFs for this document type are not available yet.");
}

/** Stable hash of a snapshot. Key order is fixed by the object literal above. */
export function snapshotHash(snapshot: unknown): string {
  return sha256(JSON.stringify(snapshot));
}

/**
 * Renders the PDF for a document from its current data. PDFs are never written to
 * storage: every request re-renders, so nothing grows on disk. A revision row is only
 * recorded when the printed content changes, keeping the change history small.
 */
export async function ensurePdfRevision(documentId: string, actor: string): Promise<PdfResult> {
  const source = await loadSource(documentId);
  const hash = snapshotHash(source.snapshot);

  const latest = await db.documentRevision.findFirst({
    where: { documentId },
    orderBy: { revision: "desc" },
  });

  const html = await renderHtml(source.element);
  const buffer = await htmlToPdf(html, source.doc.number);

  // Unchanged content keeps its existing revision number and creates no new record.
  if (latest && latest.contentHash === hash) {
    return { buffer, revision: latest.revision, reference: source.doc.number, reused: true };
  }

  const current = await db.document.findUniqueOrThrow({ where: { id: documentId }, select: { currentRevision: true } });
  const revision = current.currentRevision + 1;

  await db.$transaction([
    db.documentRevision.create({
      data: { documentId, revision, contentHash: hash, snapshot: JSON.stringify(source.snapshot), filePath: "" },
    }),
    db.document.update({ where: { id: documentId }, data: { currentRevision: revision } }),
  ]);
  await logActivity({
    action: "PDF",
    entityType: "Quotation",
    entityId: documentId,
    summary: `${actor} generated ${source.doc.number} revision ${revision}`,
  });

  return { buffer, revision, reference: source.doc.number, reused: false };
}
