import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { toCsv } from "@/lib/csv";
import { CLIENT_CATEGORIES } from "@/lib/constants";

// Downloads clients as CSV. Respects the same filters as the list page.
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const category = url.searchParams.get("category") ?? "";
  const status = url.searchParams.get("status") ?? "active";

  const categoryOk = CLIENT_CATEGORIES.some((c) => c.value === category);
  const where = {
    ...(status === "archived" ? { archivedAt: { not: null } } : status === "all" ? {} : { archivedAt: null }),
    ...(categoryOk ? { category } : {}),
    ...(q
      ? {
          OR: [
            { companyName: { contains: q } },
            { contactPerson: { contains: q } },
            { email: { contains: q } },
            { phone: { contains: q } },
            { clientCode: q.toUpperCase() },
          ],
        }
      : {}),
  };

  const clients = await db.client.findMany({
    where,
    orderBy: { clientCode: "asc" },
    include: { _count: { select: { documents: true } } },
  });

  await logActivity({
    action: "EXPORT",
    entityType: "Client",
    entityId: null,
    summary: `${user.name} exported ${clients.length} client(s) to CSV`,
  });

  const csv = toCsv(
    [
      "Client ID",
      "Company",
      "Contact person",
      "Email",
      "Phone",
      "Billing address",
      "Registration number",
      "VAT number",
      "Category",
      "Documents",
      "Archived",
      "Notes",
      "Created",
    ],
    clients.map((c) => [
      c.clientCode,
      c.companyName,
      c.contactPerson,
      c.email,
      c.phone,
      c.billingAddress,
      c.registrationNumber,
      c.vatNumber,
      c.category,
      c._count.documents,
      c.archivedAt ? "yes" : "no",
      c.notes,
      c.createdAt,
    ]),
  );

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="clients-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
