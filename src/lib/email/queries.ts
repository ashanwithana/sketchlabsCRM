import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { PAGE_SIZE } from "@/lib/clients/queries";

export type EmailLogFilter = {
  status?: string; // QUEUED | SENT | FAILED, or "" for all
  q?: string;
  page?: number;
};

export async function listEmailLogs(filter: EmailLogFilter) {
  const page = Math.max(1, filter.page ?? 1);
  const q = filter.q?.trim() ?? "";
  const where: Prisma.EmailLogWhereInput = {};
  if (filter.status) where.status = filter.status;
  if (q) {
    where.OR = [
      { toAddress: { contains: q } },
      { subject: { contains: q } },
      { document: { number: { contains: q } } },
    ];
  }

  const [total, rows] = await Promise.all([
    db.emailLog.count({ where }),
    db.emailLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { document: { select: { id: true, number: true } } },
    }),
  ]);

  return { total, page, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)), rows };
}

export async function listEmailLogsForDocument(documentId: string) {
  return db.emailLog.findMany({
    where: { documentId },
    orderBy: { createdAt: "desc" },
    take: 25,
  });
}
