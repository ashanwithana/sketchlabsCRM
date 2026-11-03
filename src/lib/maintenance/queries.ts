import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { PAGE_SIZE } from "@/lib/clients/queries";

export const UPCOMING_WINDOW_DAYS = 30;

export async function listMaintenance(params: { q?: string; status?: string; page?: number; now?: Date }) {
  const now = params.now ?? new Date();
  const page = Math.max(1, params.page ?? 1);
  const q = params.q?.trim() ?? "";
  const where: Prisma.DocumentWhereInput = { type: "MAINTENANCE" };
  if (params.status === "UPCOMING") {
    where.status = "SCHEDULED";
  } else if (params.status) {
    where.status = params.status;
  }
  if (q) where.OR = [{ number: { contains: q } }, { client: { companyName: { contains: q } } }];

  const [total, rows] = await Promise.all([
    db.document.count({ where }),
    db.document.findMany({
      where,
      // Upcoming services sort by the due date, the rest by most recent first.
      orderBy: params.status === "UPCOMING" ? [{ maintenance: { maintenanceDate: "asc" } }] : [{ issueDate: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        client: { select: { companyName: true, clientCode: true } },
        maintenance: { select: { maintenanceDate: true, nextMaintenanceDate: true, equipment: { select: { name: true } } } },
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
      equipment: r.maintenance?.equipment?.name ?? "—",
      maintenanceDate: r.maintenance?.maintenanceDate ?? r.issueDate,
      nextMaintenanceDate: r.maintenance?.nextMaintenanceDate ?? null,
      overdue: r.status === "SCHEDULED" && (r.maintenance?.maintenanceDate ?? r.issueDate) < now,
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
          parts: { orderBy: { name: "asc" } },
          equipment: { select: { id: true, name: true, model: true, serialNumber: true, location: true } },
        },
      },
    },
  });
  if (!doc?.maintenance) return null;
  return doc;
}

/** Earlier and later services on the same equipment, newest first. */
export async function equipmentServiceHistory(equipmentId: string, excludeDocumentId?: string) {
  return db.document.findMany({
    where: {
      type: "MAINTENANCE",
      maintenance: { equipmentId },
      ...(excludeDocumentId ? { NOT: { id: excludeDocumentId } } : {}),
    },
    orderBy: { issueDate: "desc" },
    take: 20,
    include: { maintenance: { select: { maintenanceDate: true, description: true } } },
  });
}

/** Equipment for the picker, with the client it belongs to. */
export async function listEquipmentOptions() {
  const rows = await db.equipment.findMany({
    where: { client: { archivedAt: null } },
    orderBy: [{ client: { companyName: "asc" } }, { name: "asc" }],
    select: { id: true, name: true, model: true, clientId: true, client: { select: { companyName: true, clientCode: true } } },
  });
  return rows.map((e) => ({
    id: e.id,
    name: e.name,
    model: e.model,
    clientId: e.clientId,
    label: `${e.name}${e.model ? ` (${e.model})` : ""} · ${e.client.companyName}`,
  }));
}
