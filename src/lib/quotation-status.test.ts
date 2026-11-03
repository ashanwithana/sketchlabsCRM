import { describe, expect, it } from "vitest";
import { effectiveQuotationStatus } from "./quotation-status";

const now = new Date("2026-06-15T12:00:00Z");
const past = new Date("2026-06-01T00:00:00Z");
const future = new Date("2026-07-01T00:00:00Z");

describe("effective quotation status", () => {
  it("marks open quotations past their validity date as expired", () => {
    expect(effectiveQuotationStatus("SENT", past, now)).toBe("EXPIRED");
    expect(effectiveQuotationStatus("PENDING", past, now)).toBe("EXPIRED");
  });

  it("keeps open quotations still within validity", () => {
    expect(effectiveQuotationStatus("SENT", future, now)).toBe("SENT");
    expect(effectiveQuotationStatus("PENDING", future, now)).toBe("PENDING");
  });

  it("never overrides a final or draft status", () => {
    expect(effectiveQuotationStatus("APPROVED", past, now)).toBe("APPROVED");
    expect(effectiveQuotationStatus("REJECTED", past, now)).toBe("REJECTED");
    expect(effectiveQuotationStatus("DRAFT", past, now)).toBe("DRAFT");
  });
});
