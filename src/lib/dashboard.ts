import "server-only";
import { db } from "@/lib/db";
import { effectiveQuotationStatus } from "@/lib/quotation-status";

export const UPCOMING_DAYS = 30;

/** Summary numbers for the dashboard. Every value comes from a live query. */
export async function getDashboardData(now: Date = new Date()) {
  const horizon = new Date(now.getTime() + UPCOMING_DAYS * 24 * 60 * 60 * 1000);

  const [
    totalClients,
    quotations,
    totalCrs,
    upcomingMaintenance,
    recentActivity,
  ] = await Promise.all([
    db.client.count({ where: { archivedAt: null } }),
    db.document.findMany({
      where: { type: "QUOTATION" },
      select: { status: true, quotation: { select: { validUntil: true } } },
    }),
    db.document.count({ where: { type: "CR" } }),
    db.document.findMany({
      where: {
        type: "MAINTENANCE",
        status: "SCHEDULED",
        maintenance: { maintenanceDate: { lte: horizon } },
      },
      orderBy: { maintenance: { maintenanceDate: "asc" } },
      take: 8,
      select: {
        id: true,
        number: true,
        client: { select: { companyName: true } },
        maintenance: { select: { maintenanceDate: true, equipment: { select: { name: true } } } },
      },
    }),
    db.activityLog.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
  ]);

  let pending = 0;
  let approved = 0;
  let expired = 0;
  for (const q of quotations) {
    const status = effectiveQuotationStatus(q.status, q.quotation?.validUntil ?? now, now);
    if (status === "PENDING") pending++;
    if (status === "APPROVED") approved++;
    if (status === "EXPIRED") expired++;
  }

  return {
    totalClients,
    totalQuotations: quotations.length,
    pendingQuotations: pending,
    approvedQuotations: approved,
    expiredQuotations: expired,
    totalCrs,
    upcomingMaintenance: upcomingMaintenance.map((m) => ({
      id: m.id,
      number: m.number,
      companyName: m.client.companyName,
      equipment: m.maintenance?.equipment?.name ?? "Unspecified equipment",
      date: m.maintenance!.maintenanceDate,
      overdue: m.maintenance!.maintenanceDate.getTime() < now.getTime(),
    })),
    recentActivity,
  };
}
