"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { createMaintenance, MaintenanceError, setMaintenanceStatus, updateMaintenance } from "@/lib/maintenance/service";
import { maintenanceSchema, type MaintenanceInput } from "@/lib/validation/maintenance";

export type MaintenanceActionResult =
  | { ok: true; id?: string; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

function firstErrors(issues: { path: (string | number)[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

function revalidateMaintenance(id?: string) {
  revalidatePath("/maintenance");
  if (id) revalidatePath(`/maintenance/${id}`);
  revalidatePath("/dashboard");
  revalidatePath("/clients");
}

export async function saveMaintenanceAction(input: MaintenanceInput, id?: string): Promise<MaintenanceActionResult> {
  const user = await requireUser();
  const parsed = maintenanceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: firstErrors(parsed.error.issues) };
  }
  try {
    if (id) {
      await updateMaintenance(id, parsed.data, user.name);
      revalidateMaintenance(id);
      return { ok: true, id, message: "Maintenance record saved." };
    }
    const created = await createMaintenance(parsed.data, user.name);
    revalidateMaintenance(created.id);
    return { ok: true, id: created.id, message: `${created.number} created.` };
  } catch (err) {
    if (err instanceof MaintenanceError) return { ok: false, error: err.message };
    throw err;
  }
}

export async function setMaintenanceStatusAction(id: string, status: string): Promise<MaintenanceActionResult> {
  const user = await requireUser();
  try {
    await setMaintenanceStatus(id, status, user.name);
    revalidateMaintenance(id);
    return { ok: true, message: "Status updated." };
  } catch (err) {
    if (err instanceof MaintenanceError) return { ok: false, error: err.message };
    throw err;
  }
}
