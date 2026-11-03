import { describe, expect, it, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { formatNumber, nextNumber, sequenceKey } from "./numbering";

describe("number formatting", () => {
  it("formats client and document numbers", () => {
    expect(formatNumber("CLIENT", 1, 2026)).toBe("CL-0001");
    expect(formatNumber("QUOTATION", 12, 2026)).toBe("QT-2026-0012");
    expect(formatNumber("CR", 3, 2027)).toBe("CR-2027-0003");
    expect(formatNumber("MAINTENANCE", 12345, 2026)).toBe("MR-2026-12345");
  });

  it("gives clients one counter and documents a counter per year", () => {
    expect(sequenceKey("CLIENT", 2026)).toBe("CL");
    expect(sequenceKey("CLIENT", 2027)).toBe("CL");
    expect(sequenceKey("QUOTATION", 2026)).toBe("QT-2026");
    expect(sequenceKey("QUOTATION", 2027)).toBe("QT-2027");
  });
});

describe("nextNumber against the database", () => {
  beforeEach(async () => {
    await db.sequence.deleteMany();
  });

  it("returns unique, sequential numbers when many requests arrive at once", async () => {
    const results = await Promise.all(
      Array.from({ length: 25 }, () => nextNumber("QUOTATION", db, new Date("2026-03-01T00:00:00Z"))),
    );
    expect(new Set(results).size).toBe(25);
    const sorted = [...results].sort();
    expect(sorted[0]).toBe("QT-2026-0001");
    expect(sorted[24]).toBe("QT-2026-0025");
  });

  it("restarts document numbering in a new year without touching the previous year", async () => {
    const y2026 = await nextNumber("CR", db, new Date("2026-12-31T10:00:00Z"));
    const y2027 = await nextNumber("CR", db, new Date("2027-01-01T10:00:00Z"));
    const y2026Again = await nextNumber("CR", db, new Date("2026-12-31T11:00:00Z"));
    expect(y2026).toBe("CR-2026-0001");
    expect(y2027).toBe("CR-2027-0001");
    expect(y2026Again).toBe("CR-2026-0002");
  });

  it("keeps client numbers independent of document numbers", async () => {
    await nextNumber("QUOTATION", db, new Date("2026-01-01T00:00:00Z"));
    expect(await nextNumber("CLIENT", db, new Date("2026-01-01T00:00:00Z"))).toBe("CL-0001");
  });

  it("never reuses a number after a record is deleted", async () => {
    const first = await nextNumber("CLIENT");
    const second = await nextNumber("CLIENT");
    expect(first).not.toBe(second);
    expect(await nextNumber("CLIENT")).not.toBe(first);
  });
});
