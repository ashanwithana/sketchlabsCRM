import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { nextNumber } from "@/lib/numbering";
import { closeBrowser, pdfEngineAvailable } from "@/lib/pdf/browser";
import { createQuotation, updateQuotation } from "@/lib/quotations/service";
import { quotationSchema, type QuotationInput } from "@/lib/validation/quotation";
import { ensurePdfRevision, snapshotHash } from "./pdf-revisions";

const describeIfChrome = pdfEngineAvailable() ? describe : describe.skip;

describe("snapshot hashing", () => {
  it("is stable for the same content and changes when any value changes", () => {
    const a = { total: 100, items: [["x", 1]] };
    expect(snapshotHash(a)).toBe(snapshotHash({ total: 100, items: [["x", 1]] }));
    expect(snapshotHash(a)).not.toBe(snapshotHash({ total: 101, items: [["x", 1]] }));
  });
});

describeIfChrome("PDF revisions (requires Chrome)", () => {
  let documentId = "";
  const input = (qty: string): QuotationInput => ({
    clientId: "",
    issueDate: "2026-04-01",
    validUntil: "2026-04-30",
    terms: "Terms",
    notes: "internal",
    items: [{ description: "Service", quantity: qty, unitPrice: "100", discount: "", taxRate: "10" }],
  });

  beforeAll(async () => {
    await db.document.deleteMany({ where: { type: "QUOTATION" } });
    await db.sequence.deleteMany({ where: { key: { startsWith: "QT-" } } });
    const client = await db.client.create({
      data: {
        clientCode: await nextNumber("CLIENT"),
        companyName: "Revision Test Client",
        contactPerson: "Tester",
        email: "rev@client.example",
        phone: "+94 11 000 1111",
        billingAddress: "2 Test Road",
        registrationNumber: "REV-1",
        category: "CORPORATE",
      },
    });
    const created = await createQuotation(quotationSchema.parse({ ...input("2"), clientId: client.id }), "Tester");
    documentId = created.id;
  });

  afterAll(async () => {
    await closeBrowser();
  });

  it("creates revision 1 on first generation", async () => {
    const result = await ensurePdfRevision(documentId, "Tester");
    expect(result.revision).toBe(1);
    expect(result.reused).toBe(false);
    expect(result.buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    const doc = await db.document.findUniqueOrThrow({ where: { id: documentId } });
    expect(doc.currentRevision).toBe(1);
  }, 60_000);

  it("reuses revision 1 when nothing printed has changed", async () => {
    const result = await ensurePdfRevision(documentId, "Tester");
    expect(result.revision).toBe(1);
    expect(result.reused).toBe(true);
    expect(await db.documentRevision.count({ where: { documentId } })).toBe(1);
  }, 60_000);

  it("ignores internal notes, which are not printed", async () => {
    const quotation = await db.quotation.findFirstOrThrow({ where: { documentId } });
    const doc = await db.document.findUniqueOrThrow({ where: { id: documentId }, select: { clientId: true } });
    await updateQuotation(documentId, quotationSchema.parse({ ...input("2"), clientId: doc.clientId, notes: "changed internal note" }), "Tester");
    expect((await db.quotation.findFirstOrThrow({ where: { documentId } })).notes).toBe("changed internal note");
    const result = await ensurePdfRevision(documentId, "Tester");
    expect(result.revision).toBe(1);
    expect(result.reused).toBe(true);
    expect(quotation.id).toBeTruthy();
  }, 60_000);

  it("creates revision 2 when the printed content changes", async () => {
    const doc = await db.document.findUniqueOrThrow({ where: { id: documentId }, select: { clientId: true } });
    await updateQuotation(documentId, quotationSchema.parse({ ...input("5"), clientId: doc.clientId }), "Tester");
    const result = await ensurePdfRevision(documentId, "Tester");
    expect(result.revision).toBe(2);
    expect(result.reused).toBe(false);
    const revisions = await db.documentRevision.findMany({ where: { documentId }, orderBy: { revision: "asc" } });
    expect(revisions.map((r) => r.revision)).toEqual([1, 2]);
    expect(revisions[0].contentHash).not.toBe(revisions[1].contentHash);
  }, 60_000);
});
