import "server-only";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { nextNumber } from "@/lib/numbering";
import { calcTotals } from "@/lib/quotation-calc";
import { MAINTENANCE_STATUSES } from "@/lib/constants";
import type { MaintenanceValues } from "@/lib/validation/maintenance";

export class MaintenanceError extends Error {}

function issueDateFrom(iso: string) {
  return new Date(`${iso}T12:00:00.000Z`);
}
function expiryDateFrom(iso: string) {
  return new Date(`${iso}T23:59:59.999Z`);
}

async function assertActiveClient(clientId: string) {
  const client = await db.client.findUnique({ where: { id: clientId }, select: { archivedAt: true } });
  if (!client || client.archivedAt) throw new MaintenanceError("Choose an active client.");
}

function lineItemsForCalc(items: MaintenanceValues["items"]) {
  return items.map((i) => ({ quantity: i.quantity, unitPrice: i.unitPrice, discount: 0, taxRateBp: i.taxRate }));
}

async function activateBilling(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  clientId: string,
  cycle: string,
  billingDay: number,
  anchor: Date,
  items: MaintenanceValues["items"],
) {
  await tx.client.update({
    where: { id: clientId },
    data: { billingCycle: cycle, billingDay, billingActive: true, billingAnchor: anchor },
  });
  await tx.clientService.deleteMany({ where: { clientId } });
  if (items.length > 0) {
    await tx.clientService.createMany({
      data: items.map((i) => ({
        clientId,
        description: i.description,
        amount: i.unitPrice * i.quantity,
        taxRateBp: i.taxRate,
      })),
    });
  }
}

async function deactivateBilling(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  clientId: string,
) {
  await tx.client.update({ where: { id: clientId }, data: { billingActive: false } });
}

export async function createMaintenance(input: MaintenanceValues, actor: string) {
  await assertActiveClient(input.clientId);
  const totals = calcTotals(lineItemsForCalc(input.items));
  const settings = await db.companySettings.findUnique({ where: { id: "company" }, select: { currency: true } });
  const currency = settings?.currency ?? "USD";

  const created = await db.$transaction(async (tx) => {
    // Only one active agreement per client: cancel any existing active ones.
    await tx.document.updateMany({
      where: { clientId: input.clientId, type: "MAINTENANCE", status: "ACTIVE" },
      data: { status: "CANCELLED" },
    });

    const number = await nextNumber("MAINTENANCE", tx);
    const validFrom = issueDateFrom(input.validFrom);
    const validUntil = expiryDateFrom(input.validUntil);

    const doc = await tx.document.create({
      data: {
        type: "MAINTENANCE",
        number,
        clientId: input.clientId,
        status: "ACTIVE",
        issueDate: validFrom,
        maintenance: {
          create: {
            description: input.description,
            validFrom,
            validUntil,
            cycle: input.cycle,
            billingDay: input.billingDay,
            subtotal: totals.subtotal,
            taxTotal: totals.taxTotal,
            grandTotal: totals.grandTotal,
            currency,
            terms: input.terms,
            notes: input.notes,
            items: {
              create: input.items.map((item, i) => ({
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                taxRateBp: item.taxRate,
                lineTotal: totals.lines[i].total,
                sortOrder: i,
              })),
            },
          },
        },
      },
      select: { id: true, number: true, maintenance: { select: { id: true } } },
    });

    await activateBilling(tx, input.clientId, input.cycle, input.billingDay, validFrom, input.items);
    return doc;
  });

  await logActivity({
    action: "CREATE",
    entityType: "Maintenance",
    entityId: created.id,
    summary: `${actor} created ${created.number} (maintenance agreement)`,
  });
  return created;
}

export async function updateMaintenance(id: string, input: MaintenanceValues, actor: string) {
  const existing = await db.document.findFirst({
    where: { id, type: "MAINTENANCE" },
    include: { maintenance: { include: { items: true } } },
  });
  if (!existing?.maintenance) throw new MaintenanceError("This maintenance agreement no longer exists.");
  await assertActiveClient(input.clientId);

  const totals = calcTotals(lineItemsForCalc(input.items));
  const settings = await db.companySettings.findUnique({ where: { id: "company" }, select: { currency: true } });
  const currency = settings?.currency ?? existing.maintenance.currency;

  await db.$transaction(async (tx) => {
    const validFrom = issueDateFrom(input.validFrom);
    const validUntil = expiryDateFrom(input.validUntil);

    await tx.document.update({
      where: { id },
      data: { clientId: input.clientId },
    });

    await tx.maintenanceLine.deleteMany({ where: { recordId: existing.maintenance!.id } });
    await tx.maintenanceRecord.update({
      where: { id: existing.maintenance!.id },
      data: {
        description: input.description,
        validFrom,
        validUntil,
        cycle: input.cycle,
        billingDay: input.billingDay,
        subtotal: totals.subtotal,
        taxTotal: totals.taxTotal,
        grandTotal: totals.grandTotal,
        currency,
        terms: input.terms,
        notes: input.notes,
        items: {
          create: input.items.map((item, i) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            taxRateBp: item.taxRate,
            lineTotal: totals.lines[i].total,
            sortOrder: i,
          })),
        },
      },
    });

    if (existing.status === "ACTIVE") {
      if (existing.clientId !== input.clientId) {
        await deactivateBilling(tx, existing.clientId);
      }
      await activateBilling(tx, input.clientId, input.cycle, input.billingDay, validFrom, input.items);
    }
  });

  await logActivity({
    action: "UPDATE",
    entityType: "Maintenance",
    entityId: id,
    summary: `${actor} edited ${existing.number}`,
  });
}

export async function setMaintenanceStatus(id: string, status: string, actor: string) {
  if (!(MAINTENANCE_STATUSES as readonly string[]).includes(status)) throw new MaintenanceError("Choose a valid status.");
  const doc = await db.document.findFirst({
    where: { id, type: "MAINTENANCE" },
    include: { maintenance: { include: { items: true } } },
  });
  if (!doc?.maintenance) throw new MaintenanceError("This maintenance agreement no longer exists.");
  if (doc.status === status) return null;

  await db.$transaction(async (tx) => {
    await tx.document.update({ where: { id }, data: { status } });

    if (status === "ACTIVE") {
      await tx.document.updateMany({
        where: { clientId: doc.clientId, type: "MAINTENANCE", status: "ACTIVE", id: { not: id } },
        data: { status: "CANCELLED" },
      });
      const m = doc.maintenance!;
      const items = m.items.map((i) => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice, taxRate: i.taxRateBp }));
      await activateBilling(tx, doc.clientId, m.cycle, m.billingDay, m.validFrom, items as MaintenanceValues["items"]);
    } else if (status === "CANCELLED") {
      await deactivateBilling(tx, doc.clientId);
    }
  });

  await logActivity({
    action: "STATUS",
    entityType: "Maintenance",
    entityId: id,
    summary: `${actor} changed ${doc.number} from ${doc.status} to ${status}`,
  });
  return null;
}