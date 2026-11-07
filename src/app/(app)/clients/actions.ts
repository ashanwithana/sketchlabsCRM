"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { nextNumber } from "@/lib/numbering";
import { checkClientDeletion } from "@/lib/clients/rules";
import { getClientDocumentCount } from "@/lib/clients/queries";
import { clientSchema, equipmentSchema, type ClientInput, type EquipmentInput } from "@/lib/validation/client";
import { billingScheduleSchema, billingServiceSchema, type BillingScheduleInput, type BillingServiceInput } from "@/lib/validation/billing";
import { sendInvoiceNow, InvoiceError } from "@/lib/invoices/service";

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
  });
  if (!equipment) return { ok: false, error: "System not found." };

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

/** Saves the recurring billing schedule. Activating it anchors the first due date to today. */
export async function saveBillingScheduleAction(clientId: string, input: BillingScheduleInput): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = billingScheduleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  }

  const existing = await db.client.findUnique({ where: { id: clientId }, select: { id: true, companyName: true, billingActive: true } });
  if (!existing) return { ok: false, error: "This client no longer exists." };

  // Activating (or reactivating) a schedule anchors the first due date to today.
  const activating = parsed.data.billingActive && !existing.billingActive;
  await db.client.update({
    where: { id: clientId },
    data: {
      billingCycle: parsed.data.billingCycle,
      billingDay: parsed.data.billingDay,
      billingActive: parsed.data.billingActive,
      ...(activating ? { billingAnchor: new Date() } : {}),
    },
  });

  await logActivity({
    action: "UPDATE",
    entityType: "Client",
    entityId: clientId,
    summary: `${user.name} ${parsed.data.billingActive ? "activated" : "updated"} the billing schedule for ${existing.companyName}`,
  });
  revalidatePath(`/clients/${clientId}`);
  return { ok: true, message: parsed.data.billingActive ? "Billing schedule active." : "Billing schedule saved (automatic sending is off)." };
}

/** Adds or updates one recurring service line; its amount is what each invoice bills. */
export async function saveServiceAction(clientId: string, input: BillingServiceInput, serviceId?: string): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const client = await db.client.findUnique({ where: { id: clientId }, select: { id: true, companyName: true } });
  if (!client) return { ok: false, error: "This client no longer exists." };

  const parsed = billingServiceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  }

  if (serviceId) {
    const owned = await db.clientService.findFirst({ where: { id: serviceId, clientId } });
    if (!owned) return { ok: false, error: "That service does not belong to this client." };
    await db.clientService.update({ where: { id: serviceId }, data: parsed.data });
    await logActivity({
      action: "UPDATE",
      entityType: "Client",
      entityId: clientId,
      summary: `${user.name} updated the service “${parsed.data.description}” for ${client.companyName}`,
    });
    revalidatePath(`/clients/${clientId}`);
    return { ok: true, data: { id: serviceId }, message: "Service updated." };
  }

  const created = await db.clientService.create({ data: { ...parsed.data, clientId } });
  await logActivity({
    action: "CREATE",
    entityType: "Client",
    entityId: clientId,
    summary: `${user.name} added the service “${parsed.data.description}” for ${client.companyName}`,
  });
  revalidatePath(`/clients/${clientId}`);
  return { ok: true, data: { id: created.id }, message: "Service added." };
}

export async function deleteServiceAction(clientId: string, serviceId: string): Promise<ActionResult> {
  const user = await requireUser();
  const service = await db.clientService.findFirst({ where: { id: serviceId, clientId } });
  if (!service) return { ok: false, error: "Service not found." };

  await db.clientService.delete({ where: { id: serviceId } });
  await logActivity({
    action: "DELETE",
    entityType: "Client",
    entityId: clientId,
    summary: `${user.name} removed the service “${service.description}”`,
  });
  revalidatePath(`/clients/${clientId}`);
  return { ok: true, message: "Service removed." };
}

/** Generates an invoice right now (outside the schedule) and emails it to the client. */
export async function sendInvoiceNowAction(clientId: string): Promise<ActionResult<{ documentId: string; number: string }>> {
  const user = await requireUser();
  try {
    const { documentId, number, result } = await sendInvoiceNow(clientId, user.name);
    if (!result.ok) {
      return { ok: false, error: `Invoice ${number} was created, but the email failed: ${result.error}` };
    }
    return { ok: true, data: { documentId, number }, message: `Invoice ${number} generated and emailed.` };
  } catch (err) {
    return { ok: false, error: err instanceof InvoiceError ? err.message : "The invoice could not be generated." };
  }
}
