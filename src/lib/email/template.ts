// Email templates use {{placeholder}} tokens. Unknown or empty tokens become empty text,
// so a typo shows as a gap rather than leaking the raw token to a client.

export const EMAIL_PLACEHOLDERS = [
  { key: "contact", label: "Client contact name" },
  { key: "client", label: "Client company name" },
  { key: "number", label: "Document number" },
  { key: "company", label: "Your company name" },
  { key: "date", label: "Issue date" },
  { key: "validUntil", label: "Valid until (quotations)" },
  { key: "amount", label: "Grand total (quotations)" },
] as const;

export function renderTemplate(template: string, vars: Record<string, string | undefined>): string {
  return template.replace(/\{\{\s*([A-Za-z]+)\s*\}\}/g, (_, key: string) => vars[key] ?? "");
}

/** Subjects are one line. Stripping line breaks also blocks header injection. */
export function cleanSubject(subject: string): string {
  return subject.replace(/[\r\n]+/g, " ").replace(/\s{2,}/g, " ").trim();
}
