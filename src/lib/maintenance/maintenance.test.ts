import { describe, expect, it } from "vitest";
import { maintenanceSchema, type MaintenanceInput } from "@/lib/validation/maintenance";

const base = (overrides: Partial<MaintenanceInput> = {}): MaintenanceInput => ({
  clientId: "c",
  validFrom: "2026-06-10",
  validUntil: "2026-12-10",
  cycle: "MONTHLY",
  billingDay: "15",
  description: "Keep the client's web app running and up to date.",
  terms: "",
  notes: "",
  items: [{ description: "Website maintenance retainer", quantity: "1", unitPrice: "15000", taxRate: "0" }],
  ...overrides,
});

describe("maintenance validation", () => {
  it("accepts a valid agreement", () => {
    expect(maintenanceSchema.safeParse(base()).success).toBe(true);
  });

  it("requires a client", () => {
    const r = maintenanceSchema.safeParse(base({ clientId: "" }));
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.map((i) => i.path[0])).toContain("clientId");
  });

  it("requires at least one service", () => {
    const r = maintenanceSchema.safeParse(base({ items: [] }));
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.map((i) => i.path[0])).toContain("items");
  });

  it("rejects an end date before the start date", () => {
    const r = maintenanceSchema.safeParse(base({ validFrom: "2026-06-10", validUntil: "2026-06-01" }));
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.map((i) => i.path[0])).toContain("validUntil");
  });

  it("requires the billing day to be between 1 and 28", () => {
    expect(maintenanceSchema.safeParse(base({ billingDay: "0" })).success).toBe(false);
    expect(maintenanceSchema.safeParse(base({ billingDay: "29" })).success).toBe(false);
    expect(maintenanceSchema.safeParse(base({ billingDay: "28" })).success).toBe(true);
  });

  it("validates service quantities and parses them as numbers", () => {
    const ok = maintenanceSchema.parse(base({ items: [{ description: "Support", quantity: "2", unitPrice: "100", taxRate: "0" }] }));
    expect(ok.items[0].quantity).toBe(2);
    expect(maintenanceSchema.safeParse(base({ items: [{ description: "Support", quantity: "0", unitPrice: "100", taxRate: "0" }] })).success).toBe(false);
    expect(maintenanceSchema.safeParse(base({ items: [{ description: "", quantity: "1", unitPrice: "100", taxRate: "0" }] })).success).toBe(false);
  });

  it("validates tax percentages", () => {
    expect(maintenanceSchema.safeParse(base({ items: [{ description: "Support", quantity: "1", unitPrice: "100", taxRate: "101" }] })).success).toBe(false);
    const ok = maintenanceSchema.parse(base({ items: [{ description: "Support", quantity: "1", unitPrice: "100", taxRate: "15" }] }));
    expect(ok.items[0].taxRate).toBe(1500);
  });

  it("parses money fields into minor units", () => {
    const ok = maintenanceSchema.parse(base({ items: [{ description: "Support", quantity: "1", unitPrice: "1500.50", taxRate: "0" }] }));
    expect(ok.items[0].unitPrice).toBe(150050);
  });
});