// CSV export helpers. Cells that start with a spreadsheet formula character are
// prefixed with an apostrophe so opening the file in Excel or Sheets cannot run them.

const FORMULA_START = /^[=+\-@\t\r]/;

export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text = value instanceof Date ? value.toISOString() : String(value);
  if (FORMULA_START.test(text)) text = `'${text}`;
  if (/[",\n\r]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeCsvCell).join(","));
  // BOM so Excel reads UTF-8 correctly.
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}
