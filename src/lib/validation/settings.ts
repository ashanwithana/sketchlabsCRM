import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters.`)
    .transform((v) => (v === "" ? null : v));

const requiredText = (label: string, max: number) =>
  z.string().trim().min(1, `${label} is required.`).max(max, `Keep ${label.toLowerCase()} under ${max} characters.`);

const optionalEmail = z
  .string()
  .trim()
  .max(254)
  .transform((v) => (v === "" ? null : v))
  .refine((v) => v === null || z.string().email().safeParse(v).success, "Enter a valid email address.");

const optionalPhone = optionalText(40).refine(
  (v) => v === null || /^[+()\-\s\d]{5,40}$/.test(v),
  "Enter a valid phone number.",
);

// Percent typed by the user, e.g. "15" or "7.5". Stored as basis points (1500, 750).
const taxPercent = z
  .string()
  .trim()
  .transform((v) => (v === "" ? "0" : v))
  .refine((v) => /^\d{1,3}(\.\d{1,2})?$/.test(v), "Tax must be a percentage such as 15 or 7.5.")
  .transform((v) => Math.round(Number(v) * 100))
  .refine((bp) => bp >= 0 && bp <= 10000, "Tax must be between 0% and 100%.");

export const companySettingsSchema = z.object({
  companyName: requiredText("Company name", 120),
  tagline: optionalText(160),
  addressLine: optionalText(300),
  phone: optionalPhone,
  email: optionalEmail,
  website: optionalText(200),
  registrationNumber: optionalText(60),
  vatNumber: optionalText(60),
  bankName: optionalText(120),
  bankAccountName: optionalText(120),
  bankAccountNumber: optionalText(60),
  bankBranch: optionalText(120),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, "Use a three-letter currency code such as USD or LKR."),
  defaultTaxRateBp: taxPercent,
  defaultValidDays: z.coerce
    .number({ invalid_type_error: "Enter a number of days." })
    .int("Use whole days.")
    .min(1, "Validity must be at least 1 day.")
    .max(365, "Validity cannot exceed 365 days."),
  quotationTerms: requiredText("Quotation terms", 4000),
  crTerms: requiredText("CR terms", 4000),
  maintenanceTerms: requiredText("Maintenance terms", 4000),
  emailQuotationSubject: requiredText("Quotation email subject", 200),
  emailQuotationBody: requiredText("Quotation email message", 4000),
  emailCrSubject: requiredText("CR email subject", 200),
  emailCrBody: requiredText("CR email message", 4000),
  emailMaintenanceSubject: requiredText("Maintenance email subject", 200),
  emailMaintenanceBody: requiredText("Maintenance email message", 4000),
});

export type CompanySettingsInput = z.input<typeof companySettingsSchema>;
export type CompanySettingsValues = z.output<typeof companySettingsSchema>;
