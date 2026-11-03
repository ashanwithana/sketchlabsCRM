import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { PAGE_SIZE } from "@/lib/clients/queries";

export async function listCrs(params: { q?: string; status?: string; page?: number }) {
  const page = Math.max(1, params.page ?? 1);
  const q = params.q?.trim() ?? "";
  const where: Prisma.DocumentWhereInput = { type: "CR" };
  if (params.status) where.status = params.status;
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
        client: { select: { companyName: true, clientCode: true } },
        cr: { select: { quotation: { select: { document: { select: { number: true } } } } } },
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
      status: r.status,
      issueDate: r.issueDate,
      client: r.client,
      quotationNumber: r.cr?.quotation?.document.number ?? null,
    })),
  };
}

export async function getCrDetail(id: string) {
  const doc = await db.document.findFirst({
    where: { id, type: "CR" },
    include: {
      client: true,
      cr: { include: { quotation: { include: { document: { select: { id: true, number: true, status: true } } } } } },
    },
  });
  if (!doc?.cr) return null;
  return doc;
}

/** Quotations for the link picker. Each carries a short scope summary used to pre-fill the CR. */
export async function listQuotationOptions() {
  const docs = await db.document.findMany({
    where: { type: "QUOTATION" },
    orderBy: { issueDate: "desc" },
    take: 300,
    include: {
      quotation: { include: { items: { orderBy: { position: "asc" }, select: { description: true } } } },
    },
  });
  return docs.map((d) => ({
    id: d.id,
    number: d.number,
    clientId: d.clientId,
    status: d.status,
    scopeHint: (d.quotation?.items ?? []).map((i) => `- ${i.description}`).join("\n"),
  }));
}
