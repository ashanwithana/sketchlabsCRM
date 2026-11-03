import { describe, expect, it } from "vitest";
import { checkClientDeletion, normaliseClientCode } from "./rules";
import { escapeCsvCell, toCsv } from "@/lib/csv";
import { clientSchema, equipmentSchema } from "@/lib/validation/client";

describe("client deletion guard", () => {
  it("allows deleting a client with no documents", () => {
    expect(checkClientDeletion(0)).toEqual({ allowed: true });
  });

  it("blocks deletion when documents exist and suggests archiving", () => {
    const one = checkClientDeletion(1);
    expect(one.allowed).toBe(false);
    if (!one.allowed) {
      expect(one.reason).toContain("1 document");
      expect(one.reason).toContain("Archive");
    }
    const many = checkClientDeletion(3);
    expect(many.allowed === false && many.reason).toContain("3 documents");
  });
});

describe("client ID lookup", () => {
  it("accepts the full ID and short forms", () => {
    expect(normaliseClientCode("CL-0001")).toBe("CL-0001");
    expect(normaliseClientCode("cl-42")).toBe("CL-0042");
    expect(normaliseClientCode("  7 ")).toBe("CL-0007");
  });

  it("ignores ordinary search words", () => {
    expect(normaliseClientCode("acme")).toBeNull();
    expect(normaliseClientCode("")).toBeNull();
  });
});

describe("CSV export", () => {
  it("quotes cells that contain commas, quotes, or line breaks", () => {
    expect(escapeCsvCell('Acme, "Ltd"')).toBe('"Acme, ""Ltd"""');
    expect(escapeCsvCell("line one\nline two")).toBe('"line one\nline two"');
  });

  it("neutralises spreadsheet formulas", () => {
    // Prefixed with an apostrophe, then quoted because the text contains double quotes.
    expect(escapeCsvCell('=HYPERLINK("http://x")')).toBe('"\'=HYPERLINK(""http://x"")"');
    expect(escapeCsvCell("+1 555")).toBe("'+1 555");
    expect(escapeCsvCell("-5")).toBe("'-5");
    expect(escapeCsvCell("@SUM(A1)")).toBe("'@SUM(A1)");
  });

  it("writes a UTF-8 BOM, header row, and CRLF line endings", () => {
    const csv = toCsv(["Name", "Note"], [["Acme", "ok"]]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("Name,Note\r\nAcme,ok\r\n");
  });

  it("renders empty values as empty cells", () => {
    expect(escapeCsvCell(null)).toBe("");
    expect(escapeCsvCell(undefined)).toBe("");
  });
});

const validClient = {
  companyName: "Acme Engineering Ltd",
  contactPerson: "Nimal Perera",
  email: "Nimal@Acme.example",
  phone: "+94 77 123 4567",
  billingAddress: "12 Galle Road, Colombo 03",
  registrationNumber: "PV-12345",
  vatNumber: "",
  category: "CORPORATE",
  notes: "",
};

describe("client validation", () => {
  it("normalises email and turns empty optional fields into null", () => {
    const parsed = clientSchema.parse(validClient);
    expect(parsed.email).toBe("nimal@acme.example");
    expect(parsed.vatNumber).toBeNull();
    expect(parsed.notes).toBeNull();
  });

  it("requires the company registration number and billing address", () => {
    expect(clientSchema.safeParse({ ...validClient, registrationNumber: "" }).success).toBe(false);
    expect(clientSchema.safeParse({ ...validClient, billingAddress: "abc" }).success).toBe(false);
  });

  it("rejects an unknown category and a malformed phone number", () => {
    expect(clientSchema.safeParse({ ...validClient, category: "CHARITY" }).success).toBe(false);
    expect(clientSchema.safeParse({ ...validClient, phone: "call me" }).success).toBe(false);
  });

  it("accepts an optional VAT number when provided", () => {
    expect(clientSchema.parse({ ...validClient, vatNumber: "VAT-998877" }).vatNumber).toBe("VAT-998877");
  });
});

describe("equipment validation", () => {
  it("parses a date and keeps optional fields null when blank", () => {
    const parsed = equipmentSchema.parse({
      name: "Rooftop chiller",
      model: "",
      serialNumber: "SN-1",
      location: "",
      installedOn: "2025-06-01",
      notes: "",
    });
    expect(parsed.installedOn).toBeInstanceOf(Date);
    expect(parsed.model).toBeNull();
  });

  it("rejects an invalid installation date", () => {
    expect(equipmentSchema.safeParse({ name: "Pump", installedOn: "not a date" }).success).toBe(false);
  });
});
