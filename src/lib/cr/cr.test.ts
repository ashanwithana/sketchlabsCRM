import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ensurePdfRevision } from "@/lib/documents/pdf-revisions";
import { closeBrowser, pdfEngineAvailable } from "@/lib/pdf/browser";
import { db } from "@/lib/db";
import { nextNumber } from "@/lib/numbering";
import { createQuotation } from "@/lib/quotations/service";
import { quotationSchema } from "@/lib/validation/quotation";
import { crSchema, type CrInput } from "@/lib/validation/cr";
import { createCr, CrError, duplicateCr, setCrStatus, updateCr } from "./service";
import { renderHtml } from "@/lib/pdf/render";
import { CrDocument } from "@/lib/pdf/cr-template";

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

const base = (overrides: Partial<CrInput> = {}): CrInput => ({
  clientId: "",
  quotationId: "",
  issueDate: "2026-06-01",
  requestDetails: "Customer asks for a quarterly inspection of the chiller plant.",
  scopeOfWork: "Inspect compressors, replace filters, and log readings for the report.",
  deliveryDate: "2026-06-20",
  customerRequirements: "Work outside 9-5 is not allowed.",
  remarks: "",
  approvalName: "Nimal Fernando",
  approvalDate: "2026-06-02",
  customerSignature: PNG,
  ...overrides,
});

describe("CR validation", () => {
  it("accepts a complete request and turns blanks into null", () => {
    const v = crSchema.parse({ ...base({ clientId: "c1" }), remarks: "  " });
    expect(v.remarks).toBeNull();
    expect(v.quotationId).toBeNull();
    expect(v.customerSignature).toBe(PNG);
  });

  it("requires a meaningful request and scope", () => {
    expect(crSchema.safeParse({ ...base({ clientId: "c1" }), requestDetails: "short" }).success).toBe(false);
    expect(crSchema.safeParse({ ...base({ clientId: "c1" }), scopeOfWork: "tbd" }).success).toBe(false);
  });

  it("accepts only PNG signature data and rejects anything else", () => {
    expect(crSchema.safeParse({ ...base({ clientId: "c1" }), customerSignature: "data:text/html;base64,PHNjcmlwdD4=" }).success).toBe(false);
    expect(crSchema.safeParse({ ...base({ clientId: "c1" }), customerSignature: "https://evil.example/x.png" }).success).toBe(false);
    expect(crSchema.safeParse({ ...base({ clientId: "c1" }), customerSignature: "data:image/png;base64," + "A".repeat(400_001) }).success).toBe(false);
  });

  it("rejects a delivery date that is not a real date", () => {
    expect(crSchema.safeParse({ ...base({ clientId: "c1" }), deliveryDate: "2026-13-40" }).success).toBe(false);
  });
});

describe("CR service (database)", () => {
  let clientA = "";
  let clientB = "";
  let quotationDocA = "";
  let quotationDocB = "";

  beforeAll(async () => {
    await db.document.deleteMany();
    await db.sequence.deleteMany({ where: { key: { startsWith: "CR" } } });
    await db.sequence.deleteMany({ where: { key: { startsWith: "QT-" } } });
    await db.client.deleteMany();

    const mk = async (name: string) => {
      const c = await db.client.create({
        data: {
          clientCode: await nextNumber("CLIENT"),
          companyName: name,
          contactPerson: "Contact",
          email: `${name.replace(/\s/g, "").toLowerCase()}@example.com`,
          phone: "+94 11 000 3333",
          billingAddress: "1 Road",
          registrationNumber: `REG-${name}`,
          category: "CORPORATE",
        },
      });
      return c.id;
    };
    clientA = await mk("Alpha Ltd");
    clientB = await mk("Beta Ltd");

    const quote = (clientId: string) =>
      createQuotation(
        quotationSchema.parse({
          clientId,
          issueDate: "2026-06-01",
          validUntil: "2026-06-30",
          terms: "",
          notes: "",
          items: [{ description: "Chiller service", quantity: "1", unitPrice: "100", discount: "", taxRate: "0" }],
        }),
        "Tester",
      );
    quotationDocA = (await quote(clientA)).id;
    quotationDocB = (await quote(clientB)).id;
  });

  beforeEach(async () => {
    await db.document.deleteMany({ where: { type: "CR" } });
    await db.sequence.deleteMany({ where: { key: { startsWith: "CR-" } } });
  });

  it("creates a CR with the next CR number and links the quotation of the same client", async () => {
    const created = await createCr(crSchema.parse({ ...base({ clientId: clientA, quotationId: quotationDocA }) }), "Tester");
    expect(created.number).toMatch(/^CR-\d{4}-0001$/);
    const cr = await db.cRDocument.findFirstOrThrow({ where: { document: { id: created.id } }, include: { quotation: true } });
    expect(cr.quotation).not.toBeNull();
    expect(cr.requestDetails).toContain("chiller");
  });

  it("refuses to link a quotation that belongs to another client", async () => {
    await expect(
      createCr(crSchema.parse({ ...base({ clientId: clientA, quotationId: quotationDocB }) }), "Tester"),
    ).rejects.toBeInstanceOf(CrError);
  });

  it("updates request details and can clear the link", async () => {
    const created = await createCr(crSchema.parse({ ...base({ clientId: clientA, quotationId: quotationDocA }) }), "Tester");
    await updateCr(created.id, crSchema.parse({ ...base({ clientId: clientA, quotationId: "", scopeOfWork: "Replace the condenser fans and test them." }) }), "Tester");
    const cr = await db.cRDocument.findFirstOrThrow({ where: { document: { id: created.id } } });
    expect(cr.quotationId).toBeNull();
    expect(cr.scopeOfWork).toContain("condenser");
  });

  it("duplicates into a new draft without copying the approval or signature", async () => {
    const created = await createCr(crSchema.parse({ ...base({ clientId: clientA }) }), "Tester");
    await setCrStatus(created.id, "APPROVED", "Tester");
    const copy = await duplicateCr(created.id, "Tester");
    expect(copy.number).not.toBe(created.number);
    const doc = await db.document.findUniqueOrThrow({ where: { id: copy.id }, include: { cr: true } });
    expect(doc.status).toBe("DRAFT");
    expect(doc.cr?.customerSignature).toBeNull();
    expect(doc.cr?.approvalName).toBeNull();
    expect(doc.cr?.requestDetails).toContain("chiller");
  });

  it("rejects an unknown status", async () => {
    const created = await createCr(crSchema.parse({ ...base({ clientId: clientA }) }), "Tester");
    await expect(setCrStatus(created.id, "PAID", "Tester")).rejects.toBeInstanceOf(CrError);
  });
});

describe("CR printed layout", () => {
  it("prints the approval block with the signature and the linked quotation", async () => {
    const html = await renderHtml(
      CrDocument({
        reference: "CR-2026-0009",
        issueDate: "2026-06-01",
        deliveryDate: "2026-06-20",
        quotationReference: "QT-2026-0004",
        client: {
          companyName: "Alpha Ltd",
          clientCode: "CL-0001",
          contactPerson: "Contact",
          email: "a@example.com",
          phone: "+1 555",
          billingAddress: "1 Road",
          registrationNumber: "R-1",
          vatNumber: null,
        },
        company: {
          companyName: "Northwind",
          tagline: null,
          addressLine: null,
          phone: null,
          email: null,
          website: null,
          registrationNumber: null,
          vatNumber: null,
          bankName: null,
          bankAccountName: null,
          bankAccountNumber: null,
          bankBranch: null,
        },
        requestDetails: "Request text",
        scopeOfWork: "Scope text",
        customerRequirements: null,
        remarks: null,
        approvalName: "Nimal Fernando",
        approvalDate: "2026-06-02",
        customerSignatureSrc: PNG,
        logoSrc: null,
        signatureSrc: null,
        terms: "CR terms here",
      }),
    );
    expect(html).toContain("CUSTOMER REQUEST");
    expect(html).toContain("CR-2026-0009");
    expect(html).toContain("QT-2026-0004");
    expect(html).toContain("Customer approval");
    expect(html).toContain(`src="${PNG}"`);
    expect(html).toContain("Signature of Nimal Fernando");
    expect(html).not.toMatch(/https?:\/\//);
  });
});

describe("CR PDF revisions (requires Chrome)", () => {
  if (!pdfEngineAvailable()) {
    it.skip("skipped: Chrome not installed", () => undefined);
    return;
  }
  let crId = "";
  beforeAll(async () => {
    const client = await db.client.findFirstOrThrow({ where: { archivedAt: null } }).catch(async () =>
      db.client.create({
        data: {
          clientCode: await nextNumber("CLIENT"),
          companyName: "PDF Client",
          contactPerson: "Contact",
          email: "pdf@client.example",
          phone: "+94 11 000 4444",
          billingAddress: "9 PDF Road",
          registrationNumber: "PDF-1",
          category: "CORPORATE",
        },
      }),
    );
    crId = (await createCr(crSchema.parse({ ...base({ clientId: client.id }) }), "Tester")).id;
  });
  afterAll(async () => {
    await closeBrowser();
  });

  it("renders a CR PDF as revision 1 and reuses it when nothing changed", async () => {
    const first = await ensurePdfRevision(crId, "Tester");
    expect(first.revision).toBe(1);
    expect(first.buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(first.reference).toMatch(/^CR-\d{4}-\d{4}$/);
    const again = await ensurePdfRevision(crId, "Tester");
    expect(again.reused).toBe(true);
    expect(again.revision).toBe(1);
  }, 60_000);
});
