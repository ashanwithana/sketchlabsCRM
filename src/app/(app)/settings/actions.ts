"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { deleteStoredFile, saveImage } from "@/lib/storage";
import { getCompanySettings } from "@/lib/settings";
import { companySettingsSchema } from "@/lib/validation/settings";

export type SettingsState = {
  status?: "idle" | "saved" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
};

const TEXT_FIELDS = [
  "companyName",
  "tagline",
  "addressLine",
  "phone",
  "email",
  "website",
  "registrationNumber",
  "vatNumber",
  "bankName",
  "bankAccountName",
  "bankAccountNumber",
  "bankBranch",
  "currency",
  "defaultTaxRate",
  "defaultValidDays",
  "quotationTerms",
  "crTerms",
  "maintenanceTerms",
  "emailQuotationSubject",
  "emailQuotationBody",
  "emailCrSubject",
  "emailCrBody",
  "emailMaintenanceSubject",
  "emailMaintenanceBody",
] as const;

/** Saves company details and document defaults, and uploads the logo or signature when provided. */
export async function updateSettingsAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const user = await requireUser();

  const raw: Record<string, unknown> = {};
  for (const field of TEXT_FIELDS) {
    raw[field === "defaultTaxRate" ? "defaultTaxRateBp" : field] = formData.get(field) ?? "";
  }

  const parsed = companySettingsSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0]);
      fieldErrors[key === "defaultTaxRateBp" ? "defaultTaxRate" : key] ??= issue.message;
    }
    return { status: "error", message: "Please fix the highlighted fields.", fieldErrors };
  }

  const logo = formData.get("logo");
  const signature = formData.get("signature");
  const current = await getCompanySettings();

  const uploads: { logoPath?: string; signaturePath?: string } = {};
  const uploadErrors: Record<string, string> = {};

  // Each image is checked separately so the error appears on the field that failed.
  const attempt = async (file: FormDataEntryValue | null, field: "logo" | "signature") => {
    if (!(file instanceof File) || file.size === 0) return;
    try {
      const saved = await saveImage(file, "branding");
      if (field === "logo") uploads.logoPath = saved;
      else uploads.signaturePath = saved;
    } catch (err) {
      uploadErrors[field] = err instanceof Error ? err.message : "The image could not be saved.";
    }
  };
  await attempt(logo, "logo");
  await attempt(signature, "signature");

  if (Object.keys(uploadErrors).length > 0) {
    // Remove any image that did save, so a failed save leaves nothing behind.
    await deleteStoredFile(uploads.logoPath);
    await deleteStoredFile(uploads.signaturePath);
    return { status: "error", message: "Please fix the highlighted fields.", fieldErrors: uploadErrors };
  }

  const data = parsed.data;
  await db.companySettings.update({
    where: { id: "company" },
    data: {
      companyName: data.companyName,
      tagline: data.tagline,
      addressLine: data.addressLine,
      phone: data.phone,
      email: data.email,
      website: data.website,
      registrationNumber: data.registrationNumber,
      vatNumber: data.vatNumber,
      bankName: data.bankName,
      bankAccountName: data.bankAccountName,
      bankAccountNumber: data.bankAccountNumber,
      bankBranch: data.bankBranch,
      currency: data.currency,
      defaultTaxRateBp: data.defaultTaxRateBp,
      defaultValidDays: data.defaultValidDays,
      quotationTerms: data.quotationTerms,
      crTerms: data.crTerms,
      maintenanceTerms: data.maintenanceTerms,
      emailQuotationSubject: data.emailQuotationSubject,
      emailQuotationBody: data.emailQuotationBody,
      emailCrSubject: data.emailCrSubject,
      emailCrBody: data.emailCrBody,
      emailMaintenanceSubject: data.emailMaintenanceSubject,
      emailMaintenanceBody: data.emailMaintenanceBody,
      ...uploads,
    },
  });

  // Remove the replaced images so old files do not pile up in storage.
  if (uploads.logoPath) await deleteStoredFile(current.logoPath);
  if (uploads.signaturePath) await deleteStoredFile(current.signaturePath);

  await logActivity({
    action: "UPDATE",
    entityType: "Settings",
    entityId: "company",
    summary: `${user.name} updated company settings`,
  });

  revalidatePath("/settings");
  return { status: "saved", message: "Settings saved." };
}
