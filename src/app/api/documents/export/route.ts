import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { repositoryWhere } from "@/lib/documents/repository";
import { effectiveQuotationStatus } from "@/lib/quotation-status";
import { toCsv } from "@/lib/csv";

// CSV of the documents matching the repository filters. Uses the same WHERE clause as the table.
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const sp = new URL(req.url).searchParams;
  const type = ["QUOTATION", "CR", "MAINTENANCE", "INVOICE"].includes(sp.get("type") ?? "") ? (sp.get("type") as string) : "";
  const status = sp.get("status") ?? "";
  const now = new Date();
  const docs = await db.document.findMany({
    where: repositoryWhere({ q: sp.get("q") ?? "", type, status, from: sp.get("from") ?? "", to: sp.get("to") ?? "", now }),
    orderBy: [{ issueDate: "desc" }, { number: "desc" }],
    take: 5000,
    include: {
      client: { select: { clientCode: true, companyName: true, email: true } },
      quotation: { select: { validUntil: true, grandTotal: true, currency: true } },
      invoice: { select: { grandTotal: true, currency: true } },
      _count: { select: { revisions: true } },
    },
  });

  await logActivity({
    action: "EXPORT",
    entityType: "Document",
    entityId: null,
    summary: `${user.name} exported ${docs.length} document(s) to CSV`,
  });

  const csv = toCsv(
    ["Number", "Type", "Client ID", "Client", "Client email", "Issued", "Status", "Currency", "Grand total", "Revisions", "Current revision"],
    docs.map((d) => [
      d.number,
      d.type,
      d.client.clientCode,
      d.client.companyName,
      d.client.email,
      d.issueDate,
      d.type === "QUOTATION" && d.quotation ? effectiveQuotationStatus(d.status, d.quotation.validUntil, now) : d.status,
      d.quotation?.currency ?? d.invoice?.currency ?? "",
      d.quotation ? (d.quotation.grandTotal / 100).toFixed(2) : d.invoice ? (d.invoice.grandTotal / 100).toFixed(2) : "",
      d._count.revisions,
      d.currentRevision,
    ]),
  );

  const date = now.toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="documents-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
