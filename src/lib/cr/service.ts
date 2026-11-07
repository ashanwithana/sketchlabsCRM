import "server-only";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { nextNumber } from "@/lib/numbering";
import { CR_STATUSES } from "@/lib/constants";
import type { CrValues } from "@/lib/validation/cr";
import { issueDateFrom } from "@/lib/quotations/service";

export class CrError extends Error {}

const dateOrNull = (iso: string | null) => (iso ? new Date(`${iso}T12:00:00.000Z`) : null);

/** Returns the Quotation row to link, after checking it belongs to the same client. */
async function linkedQuotationId(clientId: string, quotationDocumentId: string | null): Promise<string | null> {
  if (!quotationDocumentId) return null;
  const doc = await db.document.findFirst({
    where: { id: quotationDocumentId, type: "QUOTATION" },
    select: { clientId: true, quotation: { select: { id: true } } },
  });
  if (!doc?.quotation) throw new CrError("The linked quotation no longer exists.");
  if (doc.clientId !== clientId) throw new CrError("The linked quotation belongs to a different client.");
  return doc.quotation.id;
}

async function assertActiveClient(clientId: string) {
  const client = await db.client.findUnique({ where: { id: clientId }, select: { archivedAt: true } });
  if (!client || client.archivedAt) throw new CrError("Choose an active client.");
}

function crFields(input: CrValues, quotationId: string | null) {
  return {
    quotationId,
    requestDetails: input.requestDetails,
    scopeOfWork: input.scopeOfWork,
    deliveryDate: dateOrNull(input.deliveryDate),
    customerRequirements: input.customerRequirements,
    remarks: input.remarks,
    cost: input.cost,
    approvalName: input.approvalName,
    approvalDate: dateOrNull(input.approvalDate),
    customerSignature: input.customerSignature,
  };
}

export async function createCr(input: CrValues, actor: string) {
  await assertActiveClient(input.clientId);
  const quotationId = await linkedQuotationId(input.clientId, input.quotationId);

  const created = await db.$transaction(async (tx) => {
    const number = await nextNumber("CR", tx);
    return tx.document.create({
      data: {
        type: "CR",
        number,
        clientId: input.clientId,
        status: "DRAFT",
        issueDate: issueDateFrom(input.issueDate),
        cr: { create: crFields(input, quotationId) },
      },
      select: { id: true, number: true },
    });
  });

  await logActivity({
    action: "CREATE",
    entityType: "CR",
    entityId: created.id,
    summary: `${actor} created ${created.number}`,
  });
  return created;
}

export async function updateCr(id: string, input: CrValues, actor: string) {
  const existing = await db.document.findFirst({ where: { id, type: "CR" }, include: { cr: true } });
  if (!existing?.cr) throw new CrError("This CR document no longer exists.");
  await assertActiveClient(input.clientId);
  const quotationId = await linkedQuotationId(input.clientId, input.quotationId);

  await db.$transaction([
    db.document.update({
      where: { id },
      data: { clientId: input.clientId, issueDate: issueDateFrom(input.issueDate) },
    }),
    db.cRDocument.update({ where: { id: existing.cr.id }, data: crFields(input, quotationId) }),
  ]);

  await logActivity({
    action: "UPDATE",
    entityType: "CR",
    entityId: id,
    summary: `${actor} edited ${existing.number}`,
  });
}

/** Copies the request and scope into a new draft. Approval and signature are not copied, so a new sign-off is required. */
export async function duplicateCr(id: string, actor: string) {
  const source = await db.document.findFirst({ where: { id, type: "CR" }, include: { cr: true } });
  if (!source?.cr) throw new CrError("This CR document no longer exists.");

  const created = await db.$transaction(async (tx) => {
    const number = await nextNumber("CR", tx);
    return tx.document.create({
      data: {
        type: "CR",
        number,
        clientId: source.clientId,
        status: "DRAFT",
        issueDate: new Date(),
        cr: {
          create: {
            quotationId: source.cr!.quotationId,
            requestDetails: source.cr!.requestDetails,
            scopeOfWork: source.cr!.scopeOfWork,
            deliveryDate: source.cr!.deliveryDate,
            customerRequirements: source.cr!.customerRequirements,
            remarks: source.cr!.remarks,
            cost: source.cr!.cost,
          },
        },
      },
      select: { id: true, number: true },
    });
  });

  await logActivity({
    action: "CREATE",
    entityType: "CR",
    entityId: created.id,
    summary: `${actor} duplicated ${source.number} as ${created.number}`,
  });
  return created;
}

export async function setCrStatus(id: string, status: string, actor: string) {
  if (!(CR_STATUSES as readonly string[]).includes(status)) throw new CrError("Choose a valid status.");
  const doc = await db.document.findFirst({ where: { id, type: "CR" }, select: { number: true, status: true } });
  if (!doc) throw new CrError("This CR document no longer exists.");
  if (doc.status === status) return;
  await db.document.update({ where: { id }, data: { status } });
  await logActivity({
    action: "STATUS",
    entityType: "CR",
    entityId: id,
    summary: `${actor} changed ${doc.number} from ${doc.status} to ${status}`,
  });
}
