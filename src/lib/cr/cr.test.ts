import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ensurePdfRevision } from "@/lib/documents/pdf-revisions";
import { closeBrowser, pdfEngineAvailable } from "@/lib/pdf/browser";
import { db } from "@/lib/db";
import { nextNumber } from "@/lib/numbering";

import { crSchema, type CrInput } from "@/lib/validation/cr";
import { createCr, CrError, duplicateCr, setCrStatus, updateCr } from "./service";
import { renderHtml } from "@/lib/pdf/render";
import { CrDocument } from "@/lib/pdf/cr-template";



const base = (overrides: Partial<CrInput> = {}): CrInput => ({
  clientId: "",
  issueDate: "2026-06-01",
  requestDetails: "Customer asks for a quarterly inspection of the chiller plant.",
  scopeOfWork: "Inspect compressors, replace filters, and log readings for the report.",
  deliveryDate: "2026-06-20",
  customerRequirements: "Work outside 9-5 is not allowed.",
  remarks: "",
  cost: "",
  ...overrides,
});

describe("CR validation", () => {
  it("accepts a complete request and turns blanks into null", () => {
    const v = crSchema.parse({ ...base({ clientId: "c1" }), remarks: "  " });
    expect(v.remarks).toBeNull();
    expect(v.cost).toBe(0);
  });

  it("requires a meaningful request and scope", () => {
    expect(crSchema.safeParse({ ...base({ clientId: "c1" }), requestDetails: "short" }).success).toBe(false);
    expect(crSchema.safeParse({ ...base({ clientId: "c1" }), scopeOfWork: "tbd" }).success).toBe(false);
  });

  it("rejects a delivery date that is not a real date", () => {
    expect(crSchema.safeParse({ ...base({ clientId: "c1" }), deliveryDate: "2026-13-40" }).success).toBe(false);
  });
});

describe("CR service (database)", () => {
  let clientA = "";

  beforeAll(async () => {
    await db.document.deleteMany();
    await db.sequence.deleteMany({ where: { key: { startsWith: "CR" } } });
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
  });

  beforeEach(async () => {
    await db.document.deleteMany({ where: { type: "CR" } });
    await db.sequence.deleteMany({ where: { key: { startsWith: "CR-" } } });
  });

  it("creates a CR with the next CR number", async () => {
    const created = await createCr(crSchema.parse({ ...base({ clientId: clientA }) }), "Tester");
    expect(created.number).toMatch(/^CR-\d{4}-0001$/);
    const cr = await db.cRDocument.findFirstOrThrow({ where: { document: { id: created.id } } });
    expect(cr.requestDetails).toContain("chiller");
  });

  it("updates request details and cost", async () => {
    const created = await createCr(crSchema.parse({ ...base({ clientId: clientA }) }), "Tester");
    await updateCr(created.id, crSchema.parse({ ...base({ clientId: clientA, cost: "250", scopeOfWork: "Replace the condenser fans and test them." }) }), "Tester");
    const cr = await db.cRDocument.findFirstOrThrow({ where: { document: { id: created.id } } });
    expect(cr.cost).toBe(25000);
    expect(cr.scopeOfWork).toContain("condenser");
  });

  it("duplicates into a new draft", async () => {
    const created = await createCr(crSchema.parse({ ...base({ clientId: clientA }) }), "Tester");
    await setCrStatus(created.id, "APPROVED", "Tester");
    const copy = await duplicateCr(created.id, "Tester");
    expect(copy.number).not.toBe(created.number);
    const doc = await db.document.findUniqueOrThrow({ where: { id: copy.id }, include: { cr: true } });
    expect(doc.status).toBe("DRAFT");
    expect(doc.cr?.requestDetails).toContain("chiller");
  });

  it("rejects an unknown status", async () => {
    const created = await createCr(crSchema.parse({ ...base({ clientId: clientA }) }), "Tester");
    await expect(setCrStatus(created.id, "PAID", "Tester")).rejects.toBeInstanceOf(CrError);
  });
});

describe("CR printed layout", () => {
  it("prints the request, scope, and cost", async () => {
    const html = await renderHtml(
      CrDocument({
        reference: "CR-2026-0009",
        issueDate: "2026-06-01",
        deliveryDate: "2026-06-20",
        cost: 125000,
        currency: "LKR",
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
        logoSrc: null,
        signatureSrc: null,
        terms: "CR terms here",
      }),
    );
    expect(html).toContain("CUSTOMER REQUEST");
    expect(html).toContain("CR-2026-0009");
    expect(html).toContain("Request text");
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
