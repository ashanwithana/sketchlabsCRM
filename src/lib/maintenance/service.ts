import "server-only";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { nextNumber } from "@/lib/numbering";
import { MAINTENANCE_STATUSES } from "@/lib/constants";
import type { MaintenanceValues } from "@/lib/validation/maintenance";

export class MaintenanceError extends Error {}

const dateAt = (iso: string | null) => (iso ? new Date(`${iso}T12:00:00.000Z`) : null);

async function assertClientAndEquipment(clientId: string, equipmentId: string) {
  const client = await db.client.findUnique({ where: { id: clientId }, select: { archivedAt: true } });
  if (!client || client.archivedAt) throw new MaintenanceError("Choose an active client.");
  const equipment = await db.equipment.findFirst({ where: { id: equipmentId, clientId }, select: { id: true } });
  if (!equipment) throw new MaintenanceError("That system does not belong to this client.");
}

function recordFields(input: MaintenanceValues) {
  return {
    equipmentId: input.equipmentId,
    maintenanceDate: dateAt(input.maintenanceDate) as Date,
    nextMaintenanceDate: dateAt(input.nextMaintenanceDate),
    description: input.description,
    workPerformed: input.workPerformed,
    technicianName: input.technicianName,
    technicianDetails: input.technicianDetails,
    customerRemarks: input.customerRemarks,
    recommendations: input.recommendations,
    customerSignature: input.customerSignature,
    technicianSignature: input.technicianSignature,
  };
}

function partRows(input: MaintenanceValues) {
  return input.parts.map((p) => ({ name: p.name, quantity: p.quantity, notes: p.notes }));
}

/**
 * When a service is completed and has a next-service date, a scheduled record is created for it.
 * If one already exists for the same equipment and date, nothing is created.
 */
async function createFollowUpIfNeeded(recordId: string, actor: string): Promise<string | null> {
  const record = await db.maintenanceRecord.findUnique({
    where: { id: recordId },
    include: { document: { select: { clientId: true, number: true } }, equipment: { select: { name: true } } },
  });
  if (!record?.nextMaintenanceDate || !record.equipmentId) return null;

  const existing = await db.document.findFirst({
    where: {
      type: "MAINTENANCE",
      status: "SCHEDULED",
      clientId: record.document.clientId,
      maintenance: { equipmentId: record.equipmentId, maintenanceDate: record.nextMaintenanceDate },
    },
    select: { number: true },
  });
  if (existing) return existing.number;

  const created = await db.$transaction(async (tx) => {
    const number = await nextNumber("MAINTENANCE", tx);
    return tx.document.create({
      data: {
        type: "MAINTENANCE",
        number,
        clientId: record.document.clientId,
        status: "SCHEDULED",
        issueDate: record.nextMaintenanceDate as Date,
        maintenance: {
          create: {
            equipmentId: record.equipmentId,
            maintenanceDate: record.nextMaintenanceDate as Date,
            description: `Scheduled service for ${record.equipment?.name ?? "system"}, following ${record.document.number}.`,
          },
        },
      },
      select: { number: true },
    });
  });

  await logActivity({
    action: "CREATE",
    entityType: "Maintenance",
    entityId: recordId,
    summary: `${actor} scheduled ${created.number} from ${record.document.number}`,
  });
  return created.number;
}

export async function createMaintenance(input: MaintenanceValues, actor: string) {
  await assertClientAndEquipment(input.clientId, input.equipmentId);
  const created = await db.$transaction(async (tx) => {
    const number = await nextNumber("MAINTENANCE", tx);
    return tx.document.create({
      data: {
        type: "MAINTENANCE",
        number,
        clientId: input.clientId,
        status: input.status,
        issueDate: dateAt(input.maintenanceDate) as Date,
        maintenance: {
          create: { ...recordFields(input), parts: { create: partRows(input) } },
        },
      },
      select: { id: true, number: true, maintenance: { select: { id: true } } },
    });
  });

  await logActivity({
    action: "CREATE",
    entityType: "Maintenance",
    entityId: created.id,
    summary: `${actor} created ${created.number} (${input.status.toLowerCase()})`,
  });
  if (input.status === "COMPLETED" && created.maintenance) await createFollowUpIfNeeded(created.maintenance.id, actor);
  return created;
}

export async function updateMaintenance(id: string, input: MaintenanceValues, actor: string) {
  const existing = await db.document.findFirst({ where: { id, type: "MAINTENANCE" }, include: { maintenance: true } });
  if (!existing?.maintenance) throw new MaintenanceError("This maintenance record no longer exists.");
  await assertClientAndEquipment(input.clientId, input.equipmentId);

  await db.$transaction([
    db.document.update({
      where: { id },
      data: { clientId: input.clientId, status: input.status, issueDate: dateAt(input.maintenanceDate) as Date },
    }),
    db.maintenancePart.deleteMany({ where: { recordId: existing.maintenance.id } }),
    db.maintenanceRecord.update({
      where: { id: existing.maintenance.id },
      data: { ...recordFields(input), parts: { create: partRows(input) } },
    }),
  ]);

  await logActivity({
    action: "UPDATE",
    entityType: "Maintenance",
    entityId: id,
    summary: `${actor} edited ${existing.number}`,
  });
  if (input.status === "COMPLETED" && existing.status !== "COMPLETED") {
    await createFollowUpIfNeeded(existing.maintenance.id, actor);
  }
}

export async function setMaintenanceStatus(id: string, status: string, actor: string) {
  if (!(MAINTENANCE_STATUSES as readonly string[]).includes(status)) throw new MaintenanceError("Choose a valid status.");
  const doc = await db.document.findFirst({
    where: { id, type: "MAINTENANCE" },
    include: { maintenance: { select: { id: true, workPerformed: true, technicianName: true } } },
  });
  if (!doc?.maintenance) throw new MaintenanceError("This maintenance record no longer exists.");
  if (doc.status === status) return null;

  if (status === "COMPLETED" && (!doc.maintenance.workPerformed || !doc.maintenance.technicianName)) {
    throw new MaintenanceError("Add the work performed and the technician's name before marking this service complete.");
  }

  await db.document.update({ where: { id }, data: { status } });
  await logActivity({
    action: "STATUS",
    entityType: "Maintenance",
    entityId: id,
    summary: `${actor} changed ${doc.number} from ${doc.status} to ${status}`,
  });

  if (status === "COMPLETED") return createFollowUpIfNeeded(doc.maintenance.id, actor);
  return null;
}
