// Money is stored as integer minor units (cents). Parsing and formatting live here so the
// form, the server, and the PDF all agree.

/** "1,250.5" -> 125050. Returns null for anything that is not a plain amount with up to 2 decimals. */
export function parseMoney(input: string): number | null {
  const s = input.trim().replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}

/** "15" -> 1500 basis points. Returns null outside 0-100%. */
export function parsePercentToBp(input: string): number | null {
  const s = input.trim();
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(s)) return null;
  const bp = Math.round(Number(s) * 100);
  return bp <= 10000 ? bp : null;
}

/** 125050 -> "1,250.50" without a currency symbol. Used in form fields. */
export function toDecimalString(minor: number): string {
  return (minor / 100).toFixed(2);
}

/** 125050 with "LKR" -> "LKR 1,250.50". Falls back to a plain code if the currency is unknown. */
export function formatMoney(minor: number, currency: string): string {
  try {
    // Intl puts a non-breaking space after the code; use a normal space so text search and PDFs match.
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(minor / 100).replace(/\u00a0/g, " ");
  } catch {
    return `${currency} ${(minor / 100).toFixed(2)}`;
  }
}
