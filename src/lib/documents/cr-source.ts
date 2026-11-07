import "server-only";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { getCompanySettings } from "@/lib/settings";
import { contentTypeFor, readStoredFile } from "@/lib/storage";
import { CrDocument, type CrPdfData } from "@/lib/pdf/cr-template";
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

/** Gathers everything a CR prints, plus the snapshot used to decide whether a new revision is needed. */
export async function loadCrSource(documentId: string) {
  const doc = await db.document.findFirst({
    where: { id: documentId, type: "CR" },
    include: {
      client: true,
      cr: { include: { quotation: { include: { document: { select: { number: true } } } } } },
    },
  });
  if (!doc?.cr) throw new PdfError("This CR document no longer exists.");
  const cr = doc.cr;
  const company = await getCompanySettings();

  const logo = await fileSource(company.logoPath);
  const signature = await fileSource(company.signaturePath);

  const quotationRef = cr.quotation?.document.number ?? null;
  const customerSig = cr.customerSignature ?? null;
  const currency = company.currency;
  const approvalDate = isoDay(cr.approvalDate);
  const deliveryDate = isoDay(cr.deliveryDate);
  const issueDate = isoDay(doc.issueDate) as string;

  const snapshot = {
    type: "CR",
    template: PDF_TEMPLATE_VERSION,
    reference: doc.number,
    issueDate,
    deliveryDate,
    quotationRef,
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
    ],
    requestDetails: cr.requestDetails,
    scopeOfWork: cr.scopeOfWork,
    cost: cr.cost,
    customerRequirements: cr.customerRequirements,
    remarks: cr.remarks,
    approvalName: cr.approvalName,
    approvalDate,
    signatureSha: customerSig ? sha256(customerSig) : null,
    logoSha: logo?.sha ?? null,
    companySignatureSha: signature?.sha ?? null,
    terms: company.crTerms,
  };

  const data: CrPdfData = {
    reference: doc.number,
    issueDate,
    deliveryDate,
    quotationReference: quotationRef,
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
    requestDetails: cr.requestDetails,
    scopeOfWork: cr.scopeOfWork,
    cost: cr.cost,
    currency,
    customerRequirements: cr.customerRequirements,
    remarks: cr.remarks,
    approvalName: cr.approvalName,
    approvalDate,
    customerSignatureSrc: customerSig,
    logoSrc: logo?.src ?? null,
    signatureSrc: signature?.src ?? null,
    terms: company.crTerms,
  };

  return { doc, snapshot, element: CrDocument(data) };
}
