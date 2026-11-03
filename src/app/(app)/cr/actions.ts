"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { createCr, CrError, duplicateCr, setCrStatus, updateCr } from "@/lib/cr/service";
import { crSchema, type CrInput } from "@/lib/validation/cr";

export type CrActionResult =
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

function revalidateCr(id?: string) {
  revalidatePath("/cr");
  if (id) revalidatePath(`/cr/${id}`);
  revalidatePath("/dashboard");
  revalidatePath("/clients");
  revalidatePath("/quotations");
}

export async function saveCrAction(input: CrInput, id?: string): Promise<CrActionResult> {
  const user = await requireUser();
  const parsed = crSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: firstErrors(parsed.error.issues) };
  }
  try {
    if (id) {
      await updateCr(id, parsed.data, user.name);
      revalidateCr(id);
      return { ok: true, id, message: "CR document saved." };
    }
    const created = await createCr(parsed.data, user.name);
    revalidateCr(created.id);
    return { ok: true, id: created.id, message: `${created.number} created.` };
  } catch (err) {
    if (err instanceof CrError) return { ok: false, error: err.message };
    throw err;
  }
}

export async function duplicateCrAction(id: string): Promise<CrActionResult> {
  const user = await requireUser();
  try {
    const copy = await duplicateCr(id, user.name);
    revalidateCr(copy.id);
    return { ok: true, id: copy.id, message: `Duplicated as ${copy.number}.` };
  } catch (err) {
    if (err instanceof CrError) return { ok: false, error: err.message };
    throw err;
  }
}

export async function setCrStatusAction(id: string, status: string): Promise<CrActionResult> {
  const user = await requireUser();
  try {
    await setCrStatus(id, status, user.name);
    revalidateCr(id);
    return { ok: true, message: "Status updated." };
  } catch (err) {
    if (err instanceof CrError) return { ok: false, error: err.message };
    throw err;
  }
}
