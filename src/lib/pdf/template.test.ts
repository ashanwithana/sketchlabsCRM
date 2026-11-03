import { beforeAll, describe, expect, it } from "vitest";
import { renderHtml } from "./render";
import { QuotationDocument, type QuotationPdfData } from "./quotation-template";

const fixture: QuotationPdfData = {
  reference: "QT-2026-0042",
  issueDate: "2026-03-01",
  validUntil: "2026-03-31",
  currency: "LKR",
  terms: "50% advance, balance on completion.",
  client: {
    companyName: "Acme Engineering Ltd",
    clientCode: "CL-0005",
    contactPerson: "Nimal Perera",
    email: "nimal@acme.example",
    phone: "+94 77 123 4567",
    billingAddress: "12 Galle Road\nColombo 03",
    registrationNumber: "PV-12345",
    vatNumber: null,
  },
  company: {
    companyName: "Northwind Services",
    tagline: "Built to last",
    addressLine: "1 Harbour Street, Colombo",
    phone: "+94 11 000 0000",
    email: "hello@northwind.example",
    website: "northwind.example",
    registrationNumber: "REG-99",
    vatNumber: "VAT-77",
    bankName: "Sample Bank",
    bankAccountName: "Northwind Services",
    bankAccountNumber: "0011223344",
    bankBranch: "Colombo",
  },
  items: [
    { position: 1, description: "Site survey", quantity: 3, unitPrice: 100000, discount: 30000, taxRateBp: 1500, lineTotal: 310500 },
    { position: 2, description: "<script>alert(1)</script> Installation", quantity: 1, unitPrice: 250050, discount: 0, taxRateBp: 0, lineTotal: 250050 },
  ],
  subtotal: 550050,
  discountTotal: 30000,
  taxTotal: 40500,
  grandTotal: 560550,
  logoSrc: null,
  signatureSrc: null,
};

describe("quotation PDF template", () => {
  let html = "";
  beforeAll(async () => {
    html = await renderHtml(QuotationDocument(fixture));
  });

  it("prints the reference, parties, items, and totals", () => {
    expect(html).toContain("QT-2026-0042");
    expect(html).toContain("Northwind Services");
    expect(html).toContain("Acme Engineering Ltd");
    expect(html).toContain("Site survey");
    expect(html).toContain("LKR 5,500.50"); // subtotal before discount
    expect(html).toContain("LKR 5,605.50"); // grand total
    expect(html).toContain("LKR 3,105.00"); // first line total
  });

  it("includes terms, bank details, and both signature blocks", () => {
    expect(html).toContain("50% advance, balance on completion.");
    expect(html).toContain("Sample Bank");
    expect(html).toContain("Prepared by, for Northwind Services");
    expect(html).toContain("Accepted by, for Acme Engineering Ltd");
  });

  it("escapes item text so it cannot inject markup", () => {
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("loads nothing from the network", () => {
    expect(html).not.toMatch(/https?:\/\//);
    expect(html).not.toMatch(/<link[^>]+href=/i);
  });

  it("shows the company logo and signature when they are supplied", async () => {
    const withImages = await renderHtml(
      QuotationDocument({ ...fixture, logoSrc: "data:image/png;base64,AAAA", signatureSrc: "data:image/png;base64,BBBB" }),
    );
    expect(withImages).toContain('src="data:image/png;base64,AAAA"');
    expect(withImages).toContain('src="data:image/png;base64,BBBB"');
  });

  it("leaves out the bank block when no bank details are set", async () => {
    const noBank = await renderHtml(
      QuotationDocument({
        ...fixture,
        company: { ...fixture.company, bankName: null, bankAccountNumber: null, bankAccountName: null, bankBranch: null },
      }),
    );
    expect(noBank).not.toContain("Payment details");
  });
});
