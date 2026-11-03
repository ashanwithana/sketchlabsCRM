import { describe, expect, it } from "vitest";
import { companySettingsSchema } from "./settings";

// Minimum valid form payload. Tests override one field at a time.
const valid = {
  companyName: "Acme Ltd",
  tagline: "",
  addressLine: "",
  phone: "",
  email: "",
  website: "",
  registrationNumber: "",
  vatNumber: "",
  bankName: "",
  bankAccountName: "",
  bankAccountNumber: "",
  bankBranch: "",
  currency: "USD",
  defaultTaxRateBp: "0",
  defaultValidDays: "30",
  quotationTerms: "Terms",
  crTerms: "Terms",
  maintenanceTerms: "Terms",
  emailQuotationSubject: "Quotation {{number}}",
  emailQuotationBody: "Body",
  emailCrSubject: "CR {{number}}",
  emailCrBody: "Body",
  emailMaintenanceSubject: "Report {{number}}",
  emailMaintenanceBody: "Body",
};

const parse = (overrides: Record<string, unknown>) => companySettingsSchema.parse({ ...valid, ...overrides });

describe("company settings validation", () => {
  it("converts a tax percentage to basis points", () => {
    expect(parse({ defaultTaxRateBp: "15" }).defaultTaxRateBp).toBe(1500);
    expect(parse({ defaultTaxRateBp: "7.5" }).defaultTaxRateBp).toBe(750);
    expect(parse({ defaultTaxRateBp: "" }).defaultTaxRateBp).toBe(0);
  });

  it("rejects tax above 100% and malformed values", () => {
    expect(() => parse({ defaultTaxRateBp: "150" })).toThrow();
    expect(() => parse({ defaultTaxRateBp: "abc" })).toThrow();
  });

  it("requires a company name and a three-letter currency code", () => {
    expect(() => parse({ companyName: "   " })).toThrow();
    expect(() => parse({ currency: "dollars" })).toThrow();
    expect(parse({ currency: "lkr" }).currency).toBe("LKR");
  });

  it("rejects an invalid company email and stores blank optional fields as null", () => {
    expect(() => parse({ email: "not-an-email" })).toThrow();
    expect(parse({ tagline: "   " }).tagline).toBeNull();
  });

  it("requires a whole number of validity days within range", () => {
    expect(() => parse({ defaultValidDays: "0" })).toThrow();
    expect(() => parse({ defaultValidDays: "400" })).toThrow();
    expect(() => parse({ defaultValidDays: "10.5" })).toThrow();
    expect(parse({ defaultValidDays: "14" }).defaultValidDays).toBe(14);
  });
});
