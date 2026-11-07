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
        cr: { select: { cost: true } },
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
      cost: r.cr?.cost ?? 0,
    })),
  };
}

export async function getCrDetail(id: string) {
  const doc = await db.document.findFirst({
    where: { id, type: "CR" },
    include: {
      client: true,
      cr: { include: { quotations: { include: { document: { select: { id: true, number: true, status: true } } } } } },
    },
  });
  if (!doc?.cr) return null;
  return doc;
}

/** Quotations for the link picker. Each carries a short scope summary used to pre-fill the CR. */
/** Approved CRs for the link picker (one CR can have many quotations). */
export async function listCrOptions() {
  const docs = await db.document.findMany({
    where: { type: "CR", status: "APPROVED" },
    orderBy: { issueDate: "desc" },
    take: 300,
    include: { cr: { select: { id: true } } },
  });
  return docs.map((d) => ({
    id: d.cr!.id,
    number: d.number,
    clientId: d.clientId,
    status: d.status,
  }));
}

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
