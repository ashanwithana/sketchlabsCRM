import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { nextNumber } from "@/lib/numbering";
import { maintenanceSchema, type MaintenanceInput } from "@/lib/validation/maintenance";
import { createMaintenance, MaintenanceError, setMaintenanceStatus, updateMaintenance } from "./service";
import { listMaintenance } from "./queries";
import { renderHtml } from "@/lib/pdf/render";
import { MaintenanceDocument } from "@/lib/pdf/maintenance-template";
import { ensurePdfRevision } from "@/lib/documents/pdf-revisions";
import { getBrowser, pdfEngineAvailable } from "@/lib/pdf/browser";

const base = (overrides: Partial<MaintenanceInput> = {}): MaintenanceInput => ({
  clientId: "",
  equipmentId: "",
  status: "SCHEDULED",
  maintenanceDate: "2026-06-10",
  nextMaintenanceDate: "",
  description: "Quarterly inspection of the rooftop chiller.",
  workPerformed: "",
  technicianName: "",
  technicianDetails: "",
  parts: [],
  customerRemarks: "",
  recommendations: "",
  customerSignature: "",
  technicianSignature: "",
  ...overrides,
});

describe("maintenance validation", () => {
  it("accepts a scheduled visit with minimal details", () => {
    expect(maintenanceSchema.safeParse(base({ clientId: "c", equipmentId: "e" })).success).toBe(true);
  });

  it("requires work performed and a technician before a service can be completed", () => {
    const r = maintenanceSchema.safeParse(base({ clientId: "c", equipmentId: "e", status: "COMPLETED" }));
    expect(r.success).toBe(false);
    if (!r.success) {
      const paths = r.error.issues.map((i) => i.path[0]);
      expect(paths).toContain("workPerformed");
      expect(paths).toContain("technicianName");
    }
  });

  it("rejects a next service date before the service date", () => {
    const r = maintenanceSchema.safeParse(base({ clientId: "c", equipmentId: "e", nextMaintenanceDate: "2026-06-01" }));
    expect(r.success).toBe(false);
  });

  it("validates part quantities and parses them as numbers", () => {
    const ok = maintenanceSchema.parse(base({ clientId: "c", equipmentId: "e", parts: [{ name: "Filter", quantity: "2", notes: "" }] }));
    expect(ok.parts[0].quantity).toBe(2);
    expect(maintenanceSchema.safeParse(base({ clientId: "c", equipmentId: "e", parts: [{ name: "Filter", quantity: "0", notes: "" }] })).success).toBe(false);
    expect(maintenanceSchema.safeParse(base({ clientId: "c", equipmentId: "e", parts: [{ name: "", quantity: "1", notes: "" }] })).success).toBe(false);
  });

  it("accepts only PNG signatures", () => {
    expect(maintenanceSchema.safeParse(base({ clientId: "c", equipmentId: "e", customerSignature: "data:image/svg+xml;base64,AAAA" })).success).toBe(false);
  });
});

describe("maintenance service (database)", () => {
  let clientA = "";
  let clientB = "";
  let equipA = "";
  let equipB = "";

  beforeAll(async () => {
    await db.document.deleteMany();
    await db.equipment.deleteMany();
    await db.client.deleteMany();
    await db.sequence.deleteMany({ where: { key: { startsWith: "MR-" } } });

    const mkClient = async (name: string) =>
      (
        await db.client.create({
          data: {
            clientCode: await nextNumber("CLIENT"),
            companyName: name,
            contactPerson: "Contact",
            email: `${name.replace(/\s/g, "").toLowerCase()}@example.com`,
            phone: "+94 11 000 5555",
            billingAddress: "1 Road",
            registrationNumber: `REG-${name}`,
            category: "CORPORATE",
          },
        })
      ).id;
    clientA = await mkClient("Maint Alpha");
    clientB = await mkClient("Maint Beta");
    equipA = (await db.equipment.create({ data: { clientId: clientA, name: "Rooftop chiller", model: "RC-200" } })).id;
    equipB = (await db.equipment.create({ data: { clientId: clientB, name: "Boiler" } })).id;
  });

  beforeEach(async () => {
    await db.document.deleteMany({ where: { type: "MAINTENANCE" } });
    await db.sequence.deleteMany({ where: { key: { startsWith: "MR-" } } });
  });

  const completed = (overrides: Partial<MaintenanceInput> = {}) =>
    maintenanceSchema.parse(
      base({
        clientId: clientA,
        equipmentId: equipA,
        status: "COMPLETED",
        workPerformed: "Cleaned coils and replaced the filter.",
        technicianName: "Ruwan Silva",
        ...overrides,
      }),
    );

  it("creates a scheduled record with an MR number", async () => {
    const created = await createMaintenance(maintenanceSchema.parse(base({ clientId: clientA, equipmentId: equipA })), "Tester");
    expect(created.number).toMatch(/^MR-\d{4}-0001$/);
    const doc = await db.document.findUniqueOrThrow({ where: { id: created.id } });
    expect(doc.status).toBe("SCHEDULED");
  });

  it("refuses equipment that belongs to another client", async () => {
    await expect(
      createMaintenance(maintenanceSchema.parse(base({ clientId: clientA, equipmentId: equipB })), "Tester"),
    ).rejects.toBeInstanceOf(MaintenanceError);
  });

  it("schedules the next service automatically when a completed service has a next date", async () => {
    const created = await createMaintenance(completed({ nextMaintenanceDate: "2026-09-10" }), "Tester");
    const followUps = await db.document.findMany({
      where: { type: "MAINTENANCE", status: "SCHEDULED", id: { not: created.id } },
      include: { maintenance: true },
    });
    expect(followUps).toHaveLength(1);
    expect(followUps[0].maintenance?.equipmentId).toBe(equipA);
    expect(followUps[0].maintenance?.maintenanceDate.toISOString().slice(0, 10)).toBe("2026-09-10");
  });

  it("does not schedule a duplicate follow-up when completion is repeated", async () => {
    const created = await createMaintenance(completed({ nextMaintenanceDate: "2026-09-10" }), "Tester");
    // Setting the same status again is a no-op, and an existing follow-up is reused rather than copied.
    expect(await setMaintenanceStatus(created.id, "COMPLETED", "Tester")).toBeNull();
    const original = await db.maintenanceRecord.findFirstOrThrow({ where: { document: { id: created.id } } });
    const again = await db.maintenanceRecord.findFirstOrThrow({ where: { document: { id: created.id } } });
    expect(again.nextMaintenanceDate?.toISOString()).toBe(original.nextMaintenanceDate?.toISOString());
    const followUps = await db.document.count({ where: { type: "MAINTENANCE", status: "SCHEDULED", id: { not: created.id } } });
    expect(followUps).toBe(1);
  });

  it("will not mark a service complete without the work and technician recorded", async () => {
    const created = await createMaintenance(maintenanceSchema.parse(base({ clientId: clientA, equipmentId: equipA })), "Tester");
    await expect(setMaintenanceStatus(created.id, "COMPLETED", "Tester")).rejects.toThrow("Add the work performed");
  });

  it("updates parts and replaces them rather than adding duplicates", async () => {
    const created = await createMaintenance(completed({ parts: [{ name: "Filter", quantity: "1", notes: "" }] }), "Tester");
    await updateMaintenance(created.id, completed({ parts: [{ name: "Fan belt", quantity: "2", notes: "" }] }), "Tester");
    const doc = await db.document.findUniqueOrThrow({ where: { id: created.id }, include: { maintenance: { include: { parts: true } } } });
    expect(doc.maintenance?.parts.map((p) => p.name)).toEqual(["Fan belt"]);
  });
});

describe("upcoming and overdue listing", () => {
  beforeAll(async () => {
    await db.document.deleteMany({ where: { type: "MAINTENANCE" } });
    const client = await db.client.findFirstOrThrow({ where: { archivedAt: null } });
    const equipment = await db.equipment.findFirst({ where: { clientId: client.id } });
    if (!equipment) throw new Error("expected equipment");
    const make = (status: string, date: string) =>
      db.document.create({
        data: {
          type: "MAINTENANCE",
          number: `TEST-${status}-${date}`,
          clientId: client.id,
          status,
          issueDate: new Date(date),
          maintenance: { create: { equipmentId: equipment.id, maintenanceDate: new Date(date), description: "Listing test entry" } },
        },
      });
    await make("SCHEDULED", "2026-01-01T12:00:00Z");
    await make("SCHEDULED", "2026-12-01T12:00:00Z");
    await make("COMPLETED", "2026-02-01T12:00:00Z");
  });

  it("shows scheduled services and flags those in the past as overdue", async () => {
    const now = new Date("2026-06-01T00:00:00Z");
    const result = await listMaintenance({ status: "UPCOMING", now });
    expect(result.rows.map((r) => r.status)).toEqual(["SCHEDULED", "SCHEDULED"]);
    expect(result.rows[0].overdue).toBe(true);
    expect(result.rows[1].overdue).toBe(false);
  });

  it("filters completed records without overdue flags", async () => {
    const result = await listMaintenance({ status: "COMPLETED", now: new Date("2026-06-01T00:00:00Z") });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].overdue).toBe(false);
  });
});

describe("maintenance printed layout", () => {
  it("prints equipment, parts, and both signature blocks", async () => {
    const html = await renderHtml(
      MaintenanceDocument({
        reference: "MR-2026-0003",
        status: "COMPLETED",
        maintenanceDate: "2026-06-10",
        nextMaintenanceDate: "2026-09-10",
        client: { companyName: "Alpha Ltd", clientCode: "CL-1", contactPerson: "C", email: "a@x.com", phone: "1", billingAddress: "Road", registrationNumber: "R", vatNumber: null },
        company: { companyName: "Northwind", tagline: null, addressLine: null, phone: null, email: null, website: null, registrationNumber: null, vatNumber: null, bankName: null, bankAccountName: null, bankAccountNumber: null, bankBranch: null },
        equipment: { name: "Rooftop chiller", model: "RC-200", serialNumber: "SN-9", location: "Roof" },
        description: "Quarterly inspection",
        workPerformed: "Cleaned coils",
        technicianName: "Ruwan",
        technicianDetails: "Lic 42",
        parts: [{ name: "Air filter", quantity: 2, notes: "G4" }],
        customerRemarks: null,
        recommendations: "Replace belt in 6 months",
        customerSignatureSrc: "data:image/png;base64,AAAA",
        technicianSignatureSrc: "data:image/png;base64,BBBB",
        logoSrc: null,
        signatureSrc: null,
        terms: "Advisory only",
      }),
    );
    expect(html).toContain("MAINTENANCE REPORT");
    expect(html).toContain("Rooftop chiller");
    expect(html).toContain("Air filter");
    expect(html).toContain("Replace belt in 6 months");
    expect(html).toContain('src="data:image/png;base64,BBBB"');
    expect(html).toContain("Technician: Ruwan");
    expect(html).not.toMatch(/https?:\/\//);
  });
});

const describeIfChrome = pdfEngineAvailable() ? describe : describe.skip;
describeIfChrome("maintenance PDF revisions (requires Chrome)", () => {
  let id = "";
  beforeAll(async () => {
    const client = await db.client.findFirstOrThrow({ where: { archivedAt: null } });
    const equipment = await db.equipment.findFirstOrThrow({ where: { clientId: client.id } });
    const created = await createMaintenance(
      maintenanceSchema.parse(base({ clientId: client.id, equipmentId: equipment.id })),
      "Tester",
    );
    id = created.id;
  });
  afterAll(async () => {
    await getBrowser().then((b) => b.close()).catch(() => undefined);
  });
  it("renders a maintenance report PDF as revision 1 and reuses it", async () => {
    const first = await ensurePdfRevision(id, "Tester");
    expect(first.revision).toBe(1);
    expect(first.buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(first.reference).toMatch(/^MR-\d{4}-\d{4}$/);
    expect((await ensurePdfRevision(id, "Tester")).reused).toBe(true);
  }, 60_000);
});
