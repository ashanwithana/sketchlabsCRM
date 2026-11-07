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

/** Gathers everything a maintenance report prints, plus the snapshot used for revision hashing. */
export async function loadMaintenanceSource(documentId: string) {
  const doc = await db.document.findFirst({
    where: { id: documentId, type: "MAINTENANCE" },
    include: {
      client: true,
      maintenance: { include: { parts: { orderBy: { name: "asc" } }, equipment: true } },
    },
  });
  if (!doc?.maintenance || !doc.maintenance.equipment) throw new PdfError("This maintenance record no longer exists.");
  const m = doc.maintenance;
  const eq = m.equipment;
  if (!eq) throw new PdfError("This maintenance record has no system.");
  const company = await getCompanySettings();
  const logo = await fileSource(company.logoPath);
  const signature = await fileSource(company.signaturePath);

  const maintenanceDate = isoDay(m.maintenanceDate) as string;
  const nextMaintenanceDate = isoDay(m.nextMaintenanceDate);
  const equipment = { name: eq.name, model: eq.model, serialNumber: eq.serialNumber, location: eq.location };

  const snapshot = {
    type: "MAINTENANCE",
    template: PDF_TEMPLATE_VERSION,
    reference: doc.number,
    status: doc.status,
    maintenanceDate,
    nextMaintenanceDate,
    client: [doc.client.clientCode, doc.client.companyName, doc.client.contactPerson, doc.client.email, doc.client.phone, doc.client.billingAddress, doc.client.registrationNumber, doc.client.vatNumber],
    company: [company.companyName, company.tagline, company.addressLine, company.phone, company.email, company.website, company.registrationNumber, company.vatNumber],
    equipment: [equipment.name, equipment.model, equipment.serialNumber, equipment.location],
    description: m.description,
    workPerformed: m.workPerformed,
    technicianName: m.technicianName,
    technicianDetails: m.technicianDetails,
    parts: m.parts.map((p) => [p.name, p.quantity, p.notes]),
    customerRemarks: m.customerRemarks,
    recommendations: m.recommendations,
    customerSignatureSha: m.customerSignature ? sha256(m.customerSignature) : null,
    technicianSignatureSha: m.technicianSignature ? sha256(m.technicianSignature) : null,
    logoSha: logo?.sha ?? null,
    companySignatureSha: signature?.sha ?? null,
    terms: company.maintenanceTerms,
  };

  const data: MaintenancePdfData = {
    reference: doc.number,
    status: doc.status,
    maintenanceDate,
    nextMaintenanceDate,
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
      bankName: null,
      bankAccountName: null,
      bankAccountNumber: null,
      bankBranch: null,
    },
    equipment,
    description: m.description,
    workPerformed: m.workPerformed,
    technicianName: m.technicianName,
    technicianDetails: m.technicianDetails,
    parts: m.parts.map((p) => ({ name: p.name, quantity: p.quantity, notes: p.notes })),
    customerRemarks: m.customerRemarks,
    recommendations: m.recommendations,
    customerSignatureSrc: m.customerSignature,
    technicianSignatureSrc: m.technicianSignature,
    logoSrc: logo?.src ?? null,
    signatureSrc: signature?.src ?? null,
    terms: company.maintenanceTerms,
  };

  return { doc, snapshot, element: MaintenanceDocument(data) };
}
