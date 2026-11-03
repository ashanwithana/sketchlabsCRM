import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { nextNumber } from "@/lib/numbering";
import { createQuotation } from "@/lib/quotations/service";
import { quotationSchema } from "@/lib/validation/quotation";
import { listDocuments, repositoryWhere } from "./repository";

describe("repository filter composition", () => {
  it("combines type, status, and an inclusive issue-date range", () => {
    const where = repositoryWhere({ type: "QUOTATION", status: "APPROVED", from: "2026-03-01", to: "2026-03-31" });
    expect(where.type).toBe("QUOTATION");
    expect(where.status).toBe("APPROVED");
    const range = where.issueDate as { gte: Date; lte: Date };
    expect(range.gte.toISOString()).toBe("2026-03-01T00:00:00.000Z");
    // The end date includes the whole of that day.
    expect(range.lte.toISOString()).toBe("2026-03-31T23:59:59.999Z");
  });

  it("maps Expired to sent or pending quotations past their validity date", () => {
    const now = new Date("2026-06-15T00:00:00Z");
    const where = repositoryWhere({ status: "EXPIRED", now });
    expect(where.status).toEqual({ in: ["SENT", "PENDING"] });
    expect(where.quotation).toEqual({ validUntil: { lt: now } });
  });

  it("ignores malformed dates instead of passing them to the database", () => {
    const where = repositoryWhere({ from: "03/01/2026", to: "not-a-date" });
    expect(where.issueDate).toBeUndefined();
  });
});

describe("repository listing (database)", () => {
  let alphaDoc = "";
  let betaDoc = "";

  beforeAll(async () => {
    await db.document.deleteMany();
    await db.sequence.deleteMany({ where: { key: { startsWith: "QT-" } } });
    await db.client.deleteMany();
    const mk = async (name: string) =>
      (
        await db.client.create({
          data: {
            clientCode: await nextNumber("CLIENT"),
            companyName: name,
            contactPerson: "Contact",
            email: `${name.replace(/\s/g, "").toLowerCase()}@example.com`,
            phone: "+94 11 000 6666",
            billingAddress: "1 Road",
            registrationNumber: `REG-${name}`,
            category: "CORPORATE",
          },
        })
      ).id;
    const alpha = await mk("Repo Alpha");
    const beta = await mk("Repo Beta");
    const line = [{ description: "Work", quantity: "1", unitPrice: "100", discount: "", taxRate: "0" }];
    alphaDoc = (
      await createQuotation(quotationSchema.parse({ clientId: alpha, issueDate: "2026-03-01", validUntil: "2026-12-31", terms: "", notes: "", items: line }), "Tester")
    ).id;
    betaDoc = (
      await createQuotation(quotationSchema.parse({ clientId: beta, issueDate: "2026-04-15", validUntil: "2026-05-01", terms: "", notes: "", items: line }), "Tester")
    ).id;
  });

  beforeEach(async () => {
    await db.document.updateMany({ data: { status: "DRAFT" } });
  });

  it("searches by client name and by document number", async () => {
    const byName = await listDocuments({ q: "repo alpha" });
    expect(byName.rows.map((r) => r.id)).toEqual([alphaDoc]);
    const number = (await db.document.findUniqueOrThrow({ where: { id: betaDoc } })).number;
    const byNumber = await listDocuments({ q: number });
    expect(byNumber.rows.map((r) => r.id)).toEqual([betaDoc]);
  });

  it("filters by date range using the issue date", async () => {
    const april = await listDocuments({ from: "2026-04-01", to: "2026-04-30" });
    expect(april.rows.map((r) => r.id)).toEqual([betaDoc]);
    const boundary = await listDocuments({ from: "2026-03-01", to: "2026-03-01" });
    expect(boundary.rows.map((r) => r.id)).toEqual([alphaDoc]);
  });

  it("reports Expired for a sent quotation past its validity date", async () => {
    await db.document.update({ where: { id: betaDoc }, data: { status: "SENT" } });
    const expired = await listDocuments({ status: "EXPIRED", now: new Date("2026-06-01T00:00:00Z") });
    expect(expired.rows.map((r) => r.id)).toEqual([betaDoc]);
    expect(expired.rows[0].status).toBe("EXPIRED");
  });

  it("filters by document type", async () => {
    const quotes = await listDocuments({ type: "QUOTATION" });
    expect(quotes.total).toBe(2);
    const crs = await listDocuments({ type: "CR" });
    expect(crs.total).toBe(0);
  });
});
