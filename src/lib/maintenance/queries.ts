import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { PAGE_SIZE } from "@/lib/clients/queries";

export async function listMaintenance(params: { q?: string; status?: string; page?: number }) {
  const page = Math.max(1, params.page ?? 1);
  const q = params.q?.trim() ?? "";
  const where: Prisma.DocumentWhereInput = { type: "MAINTENANCE" };
  if (params.status) where.status = params.status;
  if (q) where.OR = [{ number: { contains: q } }, { client: { companyName: { contains: q } } }];

  const [total, rows] = await Promise.all([
    db.document.count({ where }),
    db.document.findMany({
      where,
      orderBy: [{ issueDate: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        client: { select: { companyName: true, clientCode: true } },
        maintenance: { select: { validFrom: true, validUntil: true, cycle: true, grandTotal: true, currency: true } },
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
      client: r.client,
      validFrom: r.maintenance?.validFrom ?? r.issueDate,
      validUntil: r.maintenance?.validUntil ?? null,
      cycle: r.maintenance?.cycle ?? "MONTHLY",
      grandTotal: r.maintenance?.grandTotal ?? 0,
      currency: r.maintenance?.currency ?? "USD",
    })),
  };
}

export async function getMaintenanceDetail(id: string) {
  const doc = await db.document.findFirst({
    where: { id, type: "MAINTENANCE" },
    include: {
      client: true,
      maintenance: {
        include: {
          items: { orderBy: { sortOrder: "asc" } },
        },
      },
    },
  });
  if (!doc?.maintenance) return null;
  return doc;
}