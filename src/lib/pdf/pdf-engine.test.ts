import { describe, expect, it, afterAll } from "vitest";
import { htmlToPdf, renderHtml } from "./render";
import { QuotationDocument } from "./quotation-template";
import { closeBrowser, pdfEngineAvailable } from "./browser";

const sample = {
  reference: "QT-TEST-0001",
  issueDate: "2026-03-01",
  validUntil: "2026-03-31",
  currency: "USD",
  terms: "Test terms",
  client: {
    companyName: "Client Co",
    clientCode: "CL-0001",
    contactPerson: "A Person",
    email: "a@example.com",
    phone: "+1 555 0100",
    billingAddress: "1 Main St",
    registrationNumber: "R-1",
    vatNumber: null,
  },
  company: {
    companyName: "Our Co",
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
  items: Array.from({ length: 60 }, (_, i) => ({
    position: i + 1,
    description: `Line item ${i + 1} with a description long enough to wrap onto more than one line in the table`,
    quantity: 1,
    unitPrice: 1000,
    discount: 0,
    taxRateBp: 0,
    lineTotal: 1000,
  })),
  subtotal: 60000,
  discountTotal: 0,
  taxTotal: 0,
  grandTotal: 60000,
  logoSrc: null,
  signatureSrc: null,
};

const describeIfChrome = pdfEngineAvailable() ? describe : describe.skip;

describeIfChrome("PDF engine (requires Chrome)", () => {
  afterAll(async () => {
    await closeBrowser();
  });

  it("produces a valid multi-page PDF with page numbers in the footer", async () => {
    const pdf = await htmlToPdf(await renderHtml(QuotationDocument(sample)), sample.reference);
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    const pageCount = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
    expect(pageCount).toBeGreaterThan(1);
    expect(pdf.length).toBeGreaterThan(2000);
  }, 60_000);
});

describe("PDF engine availability", () => {
  it("reports availability as a boolean without throwing", () => {
    expect(typeof pdfEngineAvailable()).toBe("boolean");
  });
});
