import "server-only";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { getCompanySettings } from "@/lib/settings";
import { contentTypeFor, readStoredFile } from "@/lib/storage";
import { MaintenanceDocument, type MaintenancePdfData } from "@/lib/pdf/maintenance-template";
import { PDF_TEMPLATE_VERSION } from "@/lib/pdf/layout";
import { PdfError } from "./errors";

const isoDay = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);
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

export async function loadMaintenanceSource(documentId: string) {
  const doc = await db.document.findFirst({
    where: { id: documentId, type: "MAINTENANCE" },
    include: {
      client: true,
      maintenance: { include: { items: { orderBy: { sortOrder: "asc" } } } },
    },
  });
  if (!doc?.maintenance) throw new PdfError("This maintenance agreement no longer exists.");
  const m = doc.maintenance;

  const company = await getCompanySettings();
  const logo = await fileSource(company.logoPath);
  const signature = await fileSource(company.signaturePath);

  const validFrom = isoDay(m.validFrom) as string;
  const validUntil = isoDay(m.validUntil) as string;

  const terms = m.terms ?? company.maintenanceTerms;

  const snapshot = {
    type: "MAINTENANCE",
    template: PDF_TEMPLATE_VERSION,
    reference: doc.number,
    status: doc.status,
    validFrom,
    validUntil,
    cycle: m.cycle,
    billingDay: m.billingDay,
    currency: m.currency,
    scope: m.description,
    terms,
    subtotal: m.subtotal,
    taxTotal: m.taxTotal,
    grandTotal: m.grandTotal,
    items: m.items.map((i) => [i.description, i.quantity, i.unitPrice, i.taxRateBp, i.lineTotal]),
    client: [doc.client.clientCode, doc.client.companyName, doc.client.contactPerson, doc.client.email, doc.client.phone, doc.client.billingAddress, doc.client.registrationNumber, doc.client.vatNumber],
    company: [company.companyName, company.tagline, company.addressLine, company.phone, company.email, company.website, company.registrationNumber, company.vatNumber],
    logoSha: logo?.sha ?? null,
    companySignatureSha: signature?.sha ?? null,
  };

  const data: MaintenancePdfData = {
    reference: doc.number,
    status: doc.status,
    validFrom,
    validUntil,
    cycle: m.cycle,
    billingDay: m.billingDay,
    currency: m.currency,
    scope: m.description,
    terms,
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
    items: m.items.map((i, idx) => ({
      position: idx + 1,
      description: i.description,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      taxRateBp: i.taxRateBp,
      lineTotal: i.lineTotal,
    })),
    subtotal: m.subtotal,
    taxTotal: m.taxTotal,
    grandTotal: m.grandTotal,
    logoSrc: logo?.src ?? null,
    signatureSrc: signature?.src ?? null,
  };

  return { doc, snapshot, element: MaintenanceDocument(data) };
}