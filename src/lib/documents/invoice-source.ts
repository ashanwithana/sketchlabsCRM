import "server-only";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { getCompanySettings } from "@/lib/settings";
import { contentTypeFor, readStoredFile } from "@/lib/storage";
import { InvoiceDocument, type InvoicePdfData } from "@/lib/pdf/invoice-template";
import { PDF_TEMPLATE_VERSION } from "@/lib/pdf/layout";
import { PdfError } from "./errors";

const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const sha256 = (input: Buffer | string) => createHash("sha256").update(input).digest("hex");

async function fileSource(relative: string | null): Promise<{ src: string; sha: string } | null> {
  if (!relative) return null;
  try {
    const bytes = await readStoredFile(relative);
    return { src: `data:${contentTypeFor(relative)};base64,${bytes.toString("base64")}`, sha: sha256(bytes) };
  } catch {
    return null;
  }
}

/** Gathers everything an invoice prints, plus the snapshot used for the content hash. */
export async function loadInvoiceSource(documentId: string) {
  const doc = await db.document.findFirst({
    where: { id: documentId, type: "INVOICE" },
    include: {
      client: true,
      invoice: { include: { lines: { orderBy: { position: "asc" } } } },
    },
  });
  if (!doc?.invoice) throw new PdfError("This invoice no longer exists.");

  const company = await getCompanySettings();
  const logo = await fileSource(company.logoPath);
  const signature = await fileSource(company.signaturePath);
  const inv = doc.invoice;

  const snapshot = {
    type: "INVOICE",
    template: PDF_TEMPLATE_VERSION,
    reference: doc.number,
    issueDate: isoDay(doc.issueDate),
    dueDate: isoDay(inv.dueDate),
    periodStart: inv.periodStart ? isoDay(inv.periodStart) : null,
    currency: inv.currency,
    totals: [inv.subtotal, inv.taxTotal, inv.grandTotal],
    lines: inv.lines.map((l) => [l.position, l.description, l.unitPrice, l.taxRateBp, l.lineTotal]),
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
    logoSha: logo ? logo.sha : null,
    signatureSha: signature ? signature.sha : null,
  };

  const data: InvoicePdfData = {
    reference: doc.number,
    issueDate: snapshot.issueDate,
    dueDate: snapshot.dueDate,
    currency: inv.currency,
    terms: inv.terms,
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
    lines: inv.lines.map((l) => ({
      position: l.position,
      description: l.description,
      unitPrice: l.unitPrice,
      taxRateBp: l.taxRateBp,
      lineTotal: l.lineTotal,
    })),
    subtotal: inv.subtotal,
    taxTotal: inv.taxTotal,
    grandTotal: inv.grandTotal,
    logoSrc: logo?.src ?? null,
    signatureSrc: signature?.src ?? null,
  };

  return { doc, snapshot, element: InvoiceDocument(data) };
}
