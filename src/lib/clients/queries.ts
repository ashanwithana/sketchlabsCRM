import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { normaliseClientCode } from "./rules";

export const PAGE_SIZE = 20;

export type ClientListParams = {
  q?: string;
  category?: string;
  status?: "active" | "archived" | "all";
  sort?: "newest" | "name";
  page?: number;
};

export async function listClients(params: ClientListParams) {
  const status = params.status ?? "active";
  const q = params.q?.trim() ?? "";
  const page = Math.max(1, params.page ?? 1);

  const where: Prisma.ClientWhereInput = {};
  if (status === "active") where.archivedAt = null;
  if (status === "archived") where.archivedAt = { not: null };
  if (params.category) where.category = params.category;

  if (q) {
    const code = normaliseClientCode(q);
    where.OR = [
      { companyName: { contains: q } },
      { contactPerson: { contains: q } },
      { email: { contains: q } },
      { phone: { contains: q } },
      ...(code ? [{ clientCode: code }] : []),
    ];
  }

  const orderBy: Prisma.ClientOrderByWithRelationInput =
    params.sort === "name" ? { companyName: "asc" } : { createdAt: "desc" };

  const [total, rows] = await Promise.all([
    db.client.count({ where }),
    db.client.findMany({
      where,
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { _count: { select: { documents: true, equipment: true } } },
    }),
  ]);

  return {
    rows,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

export async function getClientWithHistory(id: string) {
  const client = await db.client.findUnique({
    where: { id },
    include: {
      equipment: {
        orderBy: { name: "asc" },
      },
      documents: {
        orderBy: { issueDate: "desc" },
        include: {
          quotation: { select: { grandTotal: true, validUntil: true } },
          maintenance: { select: { validFrom: true, validUntil: true, cycle: true, grandTotal: true, currency: true } },
          invoice: { select: { grandTotal: true, currency: true, dueDate: true, periodStart: true } },
        },
      },
      services: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!client) return null;

  const activity = await db.activityLog.findMany({
    where: { entityType: "Client", entityId: id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return { client, activity };
}

export async function getClientDocumentCount(id: string) {
  return db.document.count({ where: { clientId: id } });
}
