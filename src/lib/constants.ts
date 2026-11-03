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

export const MAINTENANCE_STATUSES = ["SCHEDULED", "COMPLETED", "CANCELLED"] as const;

export const EMAIL_STATUSES = ["QUEUED", "SENT", "FAILED"] as const;

export const USER_ROLES = ["ADMIN", "STAFF"] as const;
