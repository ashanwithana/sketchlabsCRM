import "server-only";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { getEnv } from "@/lib/env";
import { effectiveQuotationStatus } from "@/lib/quotation-status";
import { createApprovalToken, verifyApprovalToken } from "./token";

export class ApprovalError extends Error {}

const OPEN_STATUSES = ["SENT", "PENDING"];

/** Builds the full public link for a token. */
export function approvalUrl(token: string) {
  return `${getEnv().APP_URL.replace(/\/$/, "")}/approve/${token}`;
}

/** Creates a link for a quotation the client can still answer. */
export async function createApprovalLink(documentId: string, actor: string) {
  const doc = await db.document.findFirst({
    where: { id: documentId, type: "QUOTATION" },
    include: { quotation: true },
  });
  if (!doc?.quotation) throw new ApprovalError("This quotation no longer exists.");
  if (!OPEN_STATUSES.includes(doc.status)) {
    throw new ApprovalError("Mark the quotation as Sent before creating a link for the client.");
  }
  const { token, expiresAt } = createApprovalToken(doc.id, doc.quotation.validUntil);
  await logActivity({
    action: "UPDATE",
    entityType: "Quotation",
    entityId: doc.id,
    summary: `${actor} created a client approval link for ${doc.number}`,
  });
  return { url: approvalUrl(token), expiresAt };
}

export type PublicQuotation = {
  reference: string;
  status: string;
  issueDate: Date;
  validUntil: Date;
  currency: string;
  terms: string | null;
  clientName: string;
  companyName: string;
  items: { position: number; description: string; quantity: number; lineTotal: number; unitPrice: number; discount: number }[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
};

export type PublicState =
  | { state: "open"; quotation: PublicQuotation; token: string }
  | { state: "closed"; quotation: PublicQuotation; decision: string }
  | { state: "expired"; quotation: PublicQuotation }
  | { state: "invalid" };

/** Only fields that appear on the printed quotation are returned. Internal notes are never included. */
export async function loadPublicQuotation(token: string, now: Date = new Date()): Promise<PublicState> {
  const verified = verifyApprovalToken(token, now);
  if (!verified) return { state: "invalid" };

  const doc = await db.document.findFirst({
    where: { id: verified.documentId, type: "QUOTATION" },
    include: {
      client: { select: { companyName: true } },
      quotation: { include: { items: { orderBy: { position: "asc" } } } },
    },
  });
  if (!doc?.quotation) return { state: "invalid" };
  const company = await db.companySettings.findUnique({ where: { id: "company" }, select: { companyName: true } });

  const quotation: PublicQuotation = {
    reference: doc.number,
    status: doc.status,
    issueDate: doc.issueDate,
    validUntil: doc.quotation.validUntil,
    currency: doc.quotation.currency,
    terms: doc.quotation.terms,
    clientName: doc.client.companyName,
    companyName: company?.companyName ?? "",
    items: doc.quotation.items.map((i) => ({
      position: i.position,
      description: i.description,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      discount: i.discount,
      lineTotal: i.lineTotal,
    })),
    subtotal: doc.quotation.subtotal,
    discountTotal: doc.quotation.discountTotal,
    taxTotal: doc.quotation.taxTotal,
    grandTotal: doc.quotation.grandTotal,
  };

  const effective = effectiveQuotationStatus(doc.status, doc.quotation.validUntil, now);
  if (effective === "EXPIRED") return { state: "expired", quotation };
  if (OPEN_STATUSES.includes(doc.status)) return { state: "open", quotation, token };
  return { state: "closed", quotation, decision: doc.status };
}

/** Records the client's decision. Only open quotations inside their validity period can be decided. */
export async function decideByClient(token: string, decision: "APPROVED" | "REJECTED", now: Date = new Date()) {
  const verified = verifyApprovalToken(token, now);
  if (!verified) throw new ApprovalError("This link is no longer valid. Ask the sender for a new one.");

  const doc = await db.document.findFirst({
    where: { id: verified.documentId, type: "QUOTATION" },
    include: { quotation: true },
  });
  if (!doc?.quotation) throw new ApprovalError("This quotation no longer exists.");
  if (effectiveQuotationStatus(doc.status, doc.quotation.validUntil, now) === "EXPIRED") {
    throw new ApprovalError("This quotation has expired. Ask the sender for an updated quotation.");
  }
  if (!OPEN_STATUSES.includes(doc.status)) {
    throw new ApprovalError(`This quotation has already been ${doc.status.toLowerCase()}.`);
  }

  await db.$transaction([
    db.document.update({ where: { id: doc.id }, data: { status: decision } }),
    db.quotation.update({
      where: { id: doc.quotation.id },
      data: { approvedAt: decision === "APPROVED" ? now : null },
    }),
  ]);
  await logActivity({
    action: "STATUS",
    entityType: "Quotation",
    entityId: doc.id,
    summary: `Client ${decision === "APPROVED" ? "approved" : "rejected"} ${doc.number} via the approval link (was ${doc.status})`,
  });
  return { number: doc.number, decision };
}
