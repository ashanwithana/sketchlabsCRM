import { z } from "zod";

const emailAddress = z.string().trim().toLowerCase().email().max(254);

export const MAX_RECIPIENTS = 5;

export type RecipientResult = { ok: true; emails: string[] } | { ok: false; error: string };

/**
 * Splits a list typed by a person ("a@x.com, b@y.com; c@z.com") into valid, unique addresses.
 * Blank input is allowed only when `required` is false.
 */
export function parseRecipients(input: string, options: { required: boolean; max?: number } = { required: true }): RecipientResult {
  const max = options.max ?? MAX_RECIPIENTS;
  const parts = input
    .split(/[,;\s]+/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return options.required
      ? { ok: false, error: "Enter at least one email address." }
      : { ok: true, emails: [] };
  }

  const invalid = parts.filter((p) => !emailAddress.safeParse(p).success);
  if (invalid.length > 0) {
    return { ok: false, error: `These addresses are not valid: ${invalid.slice(0, 3).join(", ")}` };
  }

  const unique = [...new Set(parts.map((p) => p.toLowerCase()))];
  if (unique.length > max) {
    return { ok: false, error: `Send to at most ${max} addresses at a time.` };
  }
  return { ok: true, emails: unique };
}
