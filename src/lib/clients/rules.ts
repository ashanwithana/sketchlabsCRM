// Business rules for client records. Kept free of database calls so they are easy to test.

export type ClientDeletionCheck = { allowed: true } | { allowed: false; reason: string };

/**
 * A client with any document (quotation, CR, or maintenance record) cannot be deleted,
 * because those records are part of the company's history. Archive the client instead.
 */
export function checkClientDeletion(documentCount: number): ClientDeletionCheck {
  if (documentCount > 0) {
    const noun = documentCount === 1 ? "document" : "documents";
    return {
      allowed: false,
      reason: `This client has ${documentCount} ${noun}. Archive the client to hide it while keeping its records.`,
    };
  }
  return { allowed: true };
}

/** Client IDs are generated as CL-0001. Users may paste one, so match it loosely. */
export function normaliseClientCode(input: string): string | null {
  const match = /^\s*(?:cl-?)?(\d{1,6})\s*$/i.exec(input);
  if (!match) return null;
  return `CL-${match[1].padStart(4, "0")}`;
}
