import "server-only";
import { db } from "@/lib/db";
import { effectiveQuotationStatus } from "@/lib/quotation-status";

export const UPCOMING_DAYS = 30;

/** Summary numbers for the dashboard. Every value comes from a live query. */
export async function getDashboardData(now: Date = new Date()) {
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
      where: { type: "MAINTENANCE", status: "ACTIVE" },
      orderBy: { maintenance: { validUntil: "asc" } },
      take: 8,
      select: {
        id: true,
        number: true,
        client: { select: { companyName: true } },
        maintenance: { select: { validUntil: true, cycle: true, grandTotal: true, currency: true } },
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
      equipment: m.maintenance?.cycle ?? "Agreement",
      date: m.maintenance?.validUntil ?? now,
      overdue: (m.maintenance?.validUntil ?? now).getTime() < now.getTime(),
    })),
    recentActivity,
  };
}
