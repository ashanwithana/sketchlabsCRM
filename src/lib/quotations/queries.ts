import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { PAGE_SIZE } from "@/lib/clients/queries";
import { effectiveQuotationStatus } from "@/lib/quotation-status";

export type QuotationListParams = {
  q?: string;
  status?: string; // one of QUOTATION_STATUSES, or "" for all
  page?: number;
  now?: Date;
};

/** Status filters apply the same expiry rule as the row badge, so the list and badges agree. */
function statusWhere(status: string, now: Date): Prisma.DocumentWhereInput {
  if (status === "EXPIRED") {
    return { status: { in: ["SENT", "PENDING"] }, quotation: { validUntil: { lt: now } } };
  }
  if (status === "SENT" || status === "PENDING") {
    return { status, quotation: { validUntil: { gte: now } } };
  }
  return { status };
}

export async function listQuotations(params: QuotationListParams) {
  const now = params.now ?? new Date();
  const page = Math.max(1, params.page ?? 1);
  const q = params.q?.trim() ?? "";

  const where: Prisma.DocumentWhereInput = { type: "QUOTATION" };
  if (params.status) Object.assign(where, statusWhere(params.status, now));
  if (q) {
    where.OR = [{ number: { contains: q } }, { client: { companyName: { contains: q } } }];
  }

  const [total, rows] = await Promise.all([
    db.document.count({ where }),
    db.document.findMany({
      where,
      orderBy: [{ issueDate: "desc" }, { number: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        client: { select: { id: true, companyName: true, clientCode: true } },
        quotation: { select: { validUntil: true, grandTotal: true, currency: true } },
      },
    }),
  ]);

  return {
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    rows: rows.map((r) => ({
      id: r.id,
      number: r.number,
      issueDate: r.issueDate,
      client: r.client,
      grandTotal: r.quotation?.grandTotal ?? 0,
      currency: r.quotation?.currency ?? "USD",
      validUntil: r.quotation?.validUntil ?? r.issueDate,
      status: effectiveQuotationStatus(r.status, r.quotation?.validUntil ?? r.issueDate, now),
    })),
  };
}

export async function getQuotationDetail(id: string, now: Date = new Date()) {
  const doc = await db.document.findFirst({
    where: { id, type: "QUOTATION" },
    include: {
      client: true,
      quotation: { include: { items: { orderBy: { position: "asc" } } } },
    },
  });
  if (!doc?.quotation) return null;
  return {
    ...doc,
    effectiveStatus: effectiveQuotationStatus(doc.status, doc.quotation.validUntil, now),
  };
}

export async function listClientsForQuotation() {
  return db.client.findMany({
    where: { archivedAt: null },
    orderBy: { companyName: "asc" },
    select: {
      id: true,
      clientCode: true,
      companyName: true,
      contactPerson: true,
      email: true,
      phone: true,
      billingAddress: true,
    },
  });
}
