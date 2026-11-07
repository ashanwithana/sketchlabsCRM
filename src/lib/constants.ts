// Shared enums. Stored as strings in SQLite/Postgres and validated here.

export const CLIENT_CATEGORIES = [
  { value: "CORPORATE", label: "Corporate" },
  { value: "SME", label: "SME" },
  { value: "GOVERNMENT", label: "Government" },
  { value: "NONPROFIT", label: "Non-profit" },
  { value: "INDIVIDUAL", label: "Individual" },
] as const;

export const DOCUMENT_TYPES = {
  QUOTATION: "QUOTATION",
  CR: "CR",
  MAINTENANCE: "MAINTENANCE",
  INVOICE: "INVOICE",
} as const;

export const QUOTATION_STATUSES = [
  "DRAFT",
  "SENT",
  "PENDING",
  "APPROVED",
  "REJECTED",
  "EXPIRED",
] as const;

export const CR_STATUSES = ["DRAFT", "SENT", "APPROVED"] as const;

export const MAINTENANCE_STATUSES = ["ACTIVE", "CANCELLED"] as const;
export const INVOICE_STATUSES = ["DRAFT", "SENT", "PAID", "VOID"] as const;

// Recurring maintenance billing. `months` is the cycle length used by the invoice cron.
export const BILLING_CYCLES = [
  { value: "MONTHLY", label: "Monthly", months: 1 },
  { value: "QUARTERLY", label: "Quarterly", months: 3 },
  { value: "ANNUAL", label: "Annual", months: 12 },
] as const;

export type BillingCycle = (typeof BILLING_CYCLES)[number]["value"];

export const EMAIL_STATUSES = ["QUEUED", "SENT", "FAILED"] as const;

export const USER_ROLES = ["ADMIN", "STAFF"] as const;
