// Expiry-aware quotation status. A quotation that was sent or is pending but has passed its
// validity date reads as Expired. This is computed when data is read, so it is always current.

export type QuotationStatus = "DRAFT" | "SENT" | "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";

export function effectiveQuotationStatus(
  stored: string,
  validUntil: Date,
  now: Date = new Date(),
): QuotationStatus {
  const open = stored === "SENT" || stored === "PENDING";
  if (open && validUntil.getTime() < now.getTime()) return "EXPIRED";
  return stored as QuotationStatus;
}
