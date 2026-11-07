import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { effectiveQuotationStatus } from "@/lib/quotation-status";

export const REPO_PAGE_SIZE = 25;
export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  QUOTATION: "Quotation",
  CR: "CR",
  MAINTENANCE: "Maintenance",
  INVOICE: "Invoice",
};

export type RepoFilter = {
  q?: string;
  type?: string; // QUOTATION | CR | MAINTENANCE | ""
  status?: string; // any status value, or "" for all
  from?: string; // YYYY-MM-DD, inclusive, on issue date
  to?: string; // YYYY-MM-DD, inclusive, on issue date
  page?: number;
  now?: Date;
};

const isDay = (s: string | undefined) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined);

/** Builds the WHERE clause used by both the table and the CSV export, so they always agree. */
export function repositoryWhere(filter: RepoFilter): Prisma.DocumentWhereInput {
  const now = filter.now ?? new Date();
  const where: Prisma.DocumentWhereInput = {};

  if (filter.type) where.type = filter.type;

  if (filter.status === "EXPIRED") {
    // Expired is calculated: sent or pending quotations past their validity date.
    where.status = { in: ["SENT", "PENDING"] };
    where.quotation = { validUntil: { lt: now } };
  } else if (filter.status) {
    where.status = filter.status;
  }

  const from = isDay(filter.from);
  const to = isDay(filter.to);
  if (from || to) {
    where.issueDate = {
      ...(from ? { gte: new Date(`${from}T00:00:00.000Z`) } : {}),
      ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
    };
  }

  const q = filter.q?.trim();
  if (q) {
    where.OR = [{ number: { contains: q } }, { client: { companyName: { contains: q } } }, { client: { clientCode: q.toUpperCase() } }];
  }
  return where;
}

export async function listDocuments(filter: RepoFilter) {
  const now = filter.now ?? new Date();
  const page = Math.max(1, filter.page ?? 1);
  const where = repositoryWhere({ ...filter, now });

  const [total, rows] = await Promise.all([
    db.document.count({ where }),
    db.document.findMany({
      where,
      orderBy: [{ issueDate: "desc" }, { number: "desc" }],
      skip: (page - 1) * REPO_PAGE_SIZE,
      take: REPO_PAGE_SIZE,
      include: {
        client: { select: { companyName: true, clientCode: true } },
        quotation: { select: { validUntil: true, grandTotal: true, currency: true } },
        invoice: { select: { grandTotal: true, currency: true, dueDate: true } },
        _count: { select: { revisions: true } },
      },
    }),
  ]);

  return {
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / REPO_PAGE_SIZE)),
    rows: rows.map((r) => ({
      id: r.id,
      type: r.type,
      number: r.number,
      client: r.client,
      issueDate: r.issueDate,
      status: r.type === "QUOTATION" && r.quotation
        ? effectiveQuotationStatus(r.status, r.quotation.validUntil, now)
        : r.status,
      currentRevision: r.currentRevision,
      revisionCount: r._count.revisions,
      grandTotal: r.quotation?.grandTotal ?? r.invoice?.grandTotal ?? null,
      currency: r.quotation?.currency ?? r.invoice?.currency ?? null,
    })),
  };
}

export async function getDocumentForRepository(id: string) {
  const doc = await db.document.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, companyName: true, clientCode: true, contactPerson: true, email: true } },
      quotation: { select: { validUntil: true, grandTotal: true, currency: true } },
      invoice: { select: { grandTotal: true, currency: true, dueDate: true, periodStart: true } },
      revisions: { orderBy: { revision: "desc" }, select: { id: true, revision: true, contentHash: true, createdAt: true } },
      emailLogs: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });
  return doc;
}
