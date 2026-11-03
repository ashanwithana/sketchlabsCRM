"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { getCompanySettings } from "@/lib/settings";
import {
  createQuotation,
  duplicateQuotation,
  QuotationError,
  setQuotationStatus,
  updateQuotation,
} from "@/lib/quotations/service";
import { quotationSchema, type QuotationInput } from "@/lib/validation/quotation";

export type QuotationActionResult =
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

function revalidateQuotation(id?: string) {
  revalidatePath("/quotations");
  if (id) revalidatePath(`/quotations/${id}`);
  revalidatePath("/dashboard");
  revalidatePath("/clients");
}

/** Creates a quotation when `id` is missing, otherwise updates it. Totals are always recalculated here. */
export async function saveQuotationAction(input: QuotationInput, id?: string): Promise<QuotationActionResult> {
  const user = await requireUser();
  const parsed = quotationSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: firstErrors(parsed.error.issues) };
  }

  try {
    if (id) {
      await updateQuotation(id, parsed.data, user.name);
      revalidateQuotation(id);
      return { ok: true, id, message: "Quotation saved." };
    }
    const created = await createQuotation(parsed.data, user.name);
    revalidateQuotation(created.id);
    return { ok: true, id: created.id, message: `Quotation ${created.number} created.` };
  } catch (err) {
    if (err instanceof QuotationError) return { ok: false, error: err.message };
    throw err;
  }
}

export async function duplicateQuotationAction(id: string): Promise<QuotationActionResult> {
  const user = await requireUser();
  const settings = await getCompanySettings();
  try {
    const copy = await duplicateQuotation(id, user.name, settings.defaultValidDays);
    revalidateQuotation(copy.id);
    return { ok: true, id: copy.id, message: `Duplicated as ${copy.number}.` };
  } catch (err) {
    if (err instanceof QuotationError) return { ok: false, error: err.message };
    throw err;
  }
}

export async function setQuotationStatusAction(id: string, status: string): Promise<QuotationActionResult> {
  const user = await requireUser();
  try {
    await setQuotationStatus(id, status, user.name);
    revalidateQuotation(id);
    return { ok: true, message: "Status updated." };
  } catch (err) {
    if (err instanceof QuotationError) return { ok: false, error: err.message };
    throw err;
  }
}
