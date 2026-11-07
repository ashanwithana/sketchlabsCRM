"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { nextNumber } from "@/lib/numbering";
import { checkClientDeletion } from "@/lib/clients/rules";
import { getClientDocumentCount } from "@/lib/clients/queries";
import { clientSchema, equipmentSchema, type ClientInput, type EquipmentInput } from "@/lib/validation/client";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

function fieldErrorsFrom(issues: { path: (string | number)[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

export async function createClientAction(input: ClientInput): Promise<ActionResult<{ id: string; clientCode: string }>> {
  const user = await requireUser();
  const parsed = clientSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  }

  const created = await db.$transaction(async (tx) => {
    const clientCode = await nextNumber("CLIENT", tx);
    return tx.client.create({ data: { ...parsed.data, clientCode } });
  });

  await logActivity({
    action: "CREATE",
    entityType: "Client",
    entityId: created.id,
    summary: `${user.name} registered ${created.companyName} (${created.clientCode})`,
  });

  revalidatePath("/clients");
  return { ok: true, data: { id: created.id, clientCode: created.clientCode }, message: "Client registered." };
}

export async function updateClientAction(id: string, input: ClientInput): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = clientSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  }

  const existing = await db.client.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "This client no longer exists." };

  const changed = (Object.keys(parsed.data) as (keyof typeof parsed.data)[]).filter(
    (key) => (existing[key] ?? null) !== (parsed.data[key] ?? null),
  );

  await db.client.update({ where: { id }, data: parsed.data });

  if (changed.length > 0) {
    await logActivity({
      action: "UPDATE",
      entityType: "Client",
      entityId: id,
      summary: `${user.name} updated ${changed.join(", ")} for ${existing.clientCode}`,
    });
  }

  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  return { ok: true, message: changed.length ? "Client updated." : "No changes to save." };
}

export async function setClientArchivedAction(id: string, archived: boolean): Promise<ActionResult> {
  const user = await requireUser();
  const client = await db.client.findUnique({ where: { id } });
  if (!client) return { ok: false, error: "This client no longer exists." };

  await db.client.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
  await logActivity({
    action: "ARCHIVE",
    entityType: "Client",
    entityId: id,
    summary: `${user.name} ${archived ? "archived" : "restored"} ${client.clientCode}`,
  });

  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  return { ok: true, message: archived ? "Client archived." : "Client restored." };
}

export async function deleteClientAction(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const client = await db.client.findUnique({ where: { id } });
  if (!client) return { ok: false, error: "This client no longer exists." };

  const check = checkClientDeletion(await getClientDocumentCount(id));
  if (!check.allowed) return { ok: false, error: check.reason };

  await db.client.delete({ where: { id } });
  await logActivity({
    action: "DELETE",
    entityType: "Client",
    entityId: null,
    summary: `${user.name} deleted ${client.clientCode} (${client.companyName})`,
  });

  revalidatePath("/clients");
  return { ok: true, message: "Client deleted." };
}

export async function saveEquipmentAction(
  clientId: string,
  input: EquipmentInput,
  equipmentId?: string,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = equipmentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  }

  const client = await db.client.findUnique({ where: { id: clientId }, select: { clientCode: true } });
  if (!client) return { ok: false, error: "This client no longer exists." };

  if (equipmentId) {
    const owned = await db.equipment.findFirst({ where: { id: equipmentId, clientId } });
    if (!owned) return { ok: false, error: "That system does not belong to this client." };
    await db.equipment.update({ where: { id: equipmentId }, data: parsed.data });
    await logActivity({
      action: "UPDATE",
      entityType: "Client",
      entityId: clientId,
      summary: `${user.name} updated system ${parsed.data.name} on ${client.clientCode}`,
    });
    revalidatePath(`/clients/${clientId}`);
    return { ok: true, data: { id: equipmentId }, message: "System updated." };
  }

  const created = await db.equipment.create({ data: { ...parsed.data, clientId } });
  await logActivity({
    action: "CREATE",
    entityType: "Client",
    entityId: clientId,
    summary: `${user.name} added system ${created.name} to ${client.clientCode}`,
  });
  revalidatePath(`/clients/${clientId}`);
  return { ok: true, data: { id: created.id }, message: "System added." };
}

export async function deleteEquipmentAction(clientId: string, equipmentId: string): Promise<ActionResult> {
  const user = await requireUser();
  const equipment = await db.equipment.findFirst({
    where: { id: equipmentId, clientId },
    include: { _count: { select: { maintenanceRecords: true } } },
  });
  if (!equipment) return { ok: false, error: "System not found." };

  // Service history is kept: a system with maintenance records is not removed.
  if (equipment._count.maintenanceRecords > 0) {
    return {
      ok: false,
      error: `${equipment.name} has ${equipment._count.maintenanceRecords} service record(s). Keep it for history.`,
    };
  }

  await db.equipment.delete({ where: { id: equipmentId } });
  await logActivity({
    action: "DELETE",
    entityType: "Client",
    entityId: clientId,
    summary: `${user.name} removed system ${equipment.name}`,
  });
  revalidatePath(`/clients/${clientId}`);
  return { ok: true, message: "System removed." };
}
