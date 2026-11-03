import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { nextNumber } from "@/lib/numbering";
import { listClients } from "./queries";

async function addClient(companyName: string, contactPerson: string, category: string, archived = false) {
  const clientCode = await nextNumber("CLIENT");
  return db.client.create({
    data: {
      clientCode,
      companyName,
      contactPerson,
      email: `${contactPerson.toLowerCase().replace(/\s+/g, ".")}@${companyName.toLowerCase().replace(/\s+/g, "")}.example`,
      phone: "+94 77 000 0000",
      billingAddress: "1 Test Street, Colombo",
      registrationNumber: `REG-${clientCode}`,
      category,
      archivedAt: archived ? new Date() : null,
    },
  });
}

describe("client list queries", () => {
  beforeAll(async () => {
    await db.document.deleteMany();
    await db.client.deleteMany();
    await db.sequence.deleteMany({ where: { key: "CL" } });
  });

  beforeEach(async () => {
    await db.document.deleteMany();
    await db.client.deleteMany();
    await db.sequence.deleteMany({ where: { key: "CL" } });
    await addClient("Acme Engineering", "Nimal Perera", "CORPORATE");
    await addClient("Blue Harbour Foods", "Kamala Silva", "SME");
    await addClient("Civic Trust", "Ruwan Fernando", "NONPROFIT", true);
  });

  it("lists active clients by default and excludes archived ones", async () => {
    const result = await listClients({});
    expect(result.total).toBe(2);
    expect(result.rows.map((r) => r.companyName)).not.toContain("Civic Trust");
  });

  it("searches by company name, contact person, and client ID", async () => {
    expect((await listClients({ q: "acme" })).total).toBe(1);
    expect((await listClients({ q: "kamala" })).rows[0].companyName).toBe("Blue Harbour Foods");
    expect((await listClients({ q: "CL-0001" })).rows[0].companyName).toBe("Acme Engineering");
    expect((await listClients({ q: "cl-1" })).rows[0].companyName).toBe("Acme Engineering");
  });

  it("filters by category and by archived status", async () => {
    expect((await listClients({ category: "SME" })).total).toBe(1);
    expect((await listClients({ status: "archived" })).rows[0].companyName).toBe("Civic Trust");
    expect((await listClients({ status: "all" })).total).toBe(3);
  });

  it("returns no rows for a search with no match", async () => {
    const result = await listClients({ q: "zzz-no-match" });
    expect(result.total).toBe(0);
    expect(result.pageCount).toBe(1);
  });
});
