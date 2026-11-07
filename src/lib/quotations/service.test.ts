import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { nextNumber } from "@/lib/numbering";
import { createQuotation, duplicateQuotation, QuotationError, setQuotationStatus, updateQuotation } from "./service";
import { quotationSchema, type QuotationInput } from "@/lib/validation/quotation";

let clientId = "";

const baseInput = (overrides: Partial<QuotationInput> = {}): QuotationInput => ({
  clientId,
  crId: "",
  issueDate: "2026-03-01",
  validUntil: "2026-03-31",
  terms: "50% advance",
  notes: "",
  items: [
    { description: "Site survey", quantity: "3", unitPrice: "1000", discount: "300", taxRate: "15" },
    { description: "Installation", quantity: "1", unitPrice: "2500.50", discount: "", taxRate: "0" },
  ],
  ...overrides,
});

async function parse(input: QuotationInput) {
  return quotationSchema.parse(input);
}

describe("quotation service", () => {
  beforeAll(async () => {
    await db.document.deleteMany();
    await db.client.deleteMany();
    const client = await db.client.create({
      data: {
        clientCode: await nextNumber("CLIENT"),
        companyName: "Test Client Ltd",
        contactPerson: "Test Person",
        email: "test@client.example",
        phone: "+94 11 000 0000",
        billingAddress: "1 Test Road",
        registrationNumber: "REG-TEST",
        category: "CORPORATE",
      },
    });
    clientId = client.id;
  });

  beforeEach(async () => {
    await db.document.deleteMany({ where: { type: "QUOTATION" } });
    await db.activityLog.deleteMany();
    await db.sequence.deleteMany({ where: { key: { startsWith: "QT-" } } });
  });

  it("creates a draft with an automatic number and correct totals", async () => {
    const created = await createQuotation(await parse(baseInput()), "Tester");
    expect(created.number).toMatch(/^QT-\d{4}-0001$/);

    const doc = await db.document.findUniqueOrThrow({
      where: { id: created.id },
      include: { quotation: { include: { items: { orderBy: { position: "asc" } } } } },
    });
    expect(doc.status).toBe("DRAFT");
    // Line 1: 3000.00 gross, 300.00 discount, 2700.00 taxable, 15% = 405.00 tax, total 3105.00
    // Line 2: 2500.50 gross, no tax
    expect(doc.quotation?.subtotal).toBe(300000 + 250050);
    expect(doc.quotation?.discountTotal).toBe(30000);
    expect(doc.quotation?.taxTotal).toBe(40500);
    expect(doc.quotation?.grandTotal).toBe(270000 + 250050 + 40500);
    expect(doc.quotation?.items.map((i) => i.lineTotal)).toEqual([310500, 250050]);
  });

  it("numbers quotations sequentially", async () => {
    const a = await createQuotation(await parse(baseInput()), "Tester");
    const b = await createQuotation(await parse(baseInput()), "Tester");
    const year = new Date().getUTCFullYear();
    expect(a.number).toBe(`QT-${year}-0001`);
    expect(b.number).toBe(`QT-${year}-0002`);
  });

  it("refuses an archived or missing client", async () => {
    await db.client.update({ where: { id: clientId }, data: { archivedAt: new Date() } });
    await expect(createQuotation(await parse(baseInput()), "Tester")).rejects.toBeInstanceOf(QuotationError);
    await db.client.update({ where: { id: clientId }, data: { archivedAt: null } });
  });

  it("replaces items and recalculates when a quotation is edited", async () => {
    const created = await createQuotation(await parse(baseInput()), "Tester");
    await updateQuotation(
      created.id,
      await parse(baseInput({ items: [{ description: "Only item", quantity: "2", unitPrice: "100", discount: "0", taxRate: "10" }] })),
      "Tester",
    );
    const doc = await db.document.findUniqueOrThrow({
      where: { id: created.id },
      include: { quotation: { include: { items: true } } },
    });
    expect(doc.quotation?.items).toHaveLength(1);
    expect(doc.quotation?.grandTotal).toBe(22000);
    expect(doc.number).toBe(created.number);
  });

  it("duplicates into a new draft with a new number and a fresh validity period", async () => {
    const original = await createQuotation(await parse(baseInput()), "Tester");
    await setQuotationStatus(original.id, "SENT", "Tester");

    const copy = await duplicateQuotation(original.id, "Tester", 14, new Date("2026-05-10T09:00:00Z"));
    expect(copy.number).not.toBe(original.number);
    const doc = await db.document.findUniqueOrThrow({
      where: { id: copy.id },
      include: { quotation: { include: { items: true } } },
    });
    expect(doc.status).toBe("DRAFT");
    expect(doc.issueDate.toISOString().slice(0, 10)).toBe("2026-05-10");
    expect(doc.quotation?.validUntil.toISOString().slice(0, 10)).toBe("2026-05-24");
    expect(doc.quotation?.items).toHaveLength(2);
    expect(doc.quotation?.grandTotal).toBe((await db.quotation.findFirstOrThrow({ where: { documentId: original.id } })).grandTotal);
  });

  it("records approval time and clears it when the status changes away from approved", async () => {
    const created = await createQuotation(await parse(baseInput()), "Tester");
    await setQuotationStatus(created.id, "APPROVED", "Tester");
    expect((await db.quotation.findFirstOrThrow({ where: { documentId: created.id } })).approvedAt).not.toBeNull();
    await setQuotationStatus(created.id, "PENDING", "Tester");
    expect((await db.quotation.findFirstOrThrow({ where: { documentId: created.id } })).approvedAt).toBeNull();
  });

  it("does not allow choosing EXPIRED, since it is calculated", async () => {
    const created = await createQuotation(await parse(baseInput()), "Tester");
    await expect(setQuotationStatus(created.id, "EXPIRED", "Tester")).rejects.toBeInstanceOf(QuotationError);
    await expect(setQuotationStatus(created.id, "BOGUS", "Tester")).rejects.toBeInstanceOf(QuotationError);
  });

  it("writes an activity entry for each change", async () => {
    const created = await createQuotation(await parse(baseInput()), "Tester");
    await setQuotationStatus(created.id, "SENT", "Tester");
    const entries = await db.activityLog.findMany({ where: { entityId: created.id }, orderBy: { createdAt: "asc" } });
    expect(entries.map((e) => e.action)).toEqual(["CREATE", "STATUS"]);
    expect(entries[1].summary).toContain("from DRAFT to SENT");
  });
});
