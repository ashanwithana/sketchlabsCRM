// Quotation arithmetic. Everything is integer minor units, so there is no floating-point drift.
//
// Per line:  gross    = quantity x unit price
//            discount = the entered discount, capped between 0 and gross
//            taxable  = gross - discount
//            tax      = taxable x tax rate, rounded half up to the nearest minor unit
//            total    = taxable + tax
// Per document: subtotal = sum of gross, discountTotal = sum of discounts,
//               taxTotal = sum of tax, grandTotal = subtotal - discountTotal + taxTotal.

export type CalcLine = {
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRateBp: number;
};

export type CalcLineResult = {
  gross: number;
  discount: number;
  taxable: number;
  tax: number;
  total: number;
};

export type CalcTotals = {
  lines: CalcLineResult[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
};

export function calcLine(line: CalcLine): CalcLineResult {
  const gross = Math.max(0, Math.round(line.quantity * line.unitPrice));
  const discount = Math.min(Math.max(0, Math.round(line.discount)), gross);
  const taxable = gross - discount;
  const tax = Math.round((taxable * line.taxRateBp) / 10000);
  return { gross, discount, taxable, tax, total: taxable + tax };
}

export function calcTotals(lines: CalcLine[]): CalcTotals {
  const results = lines.map(calcLine);
  const sum = (pick: (r: CalcLineResult) => number) => results.reduce((acc, r) => acc + pick(r), 0);
  const subtotal = sum((r) => r.gross);
  const discountTotal = sum((r) => r.discount);
  const taxTotal = sum((r) => r.tax);
  return {
    lines: results,
    subtotal,
    discountTotal,
    taxTotal,
    grandTotal: subtotal - discountTotal + taxTotal,
  };
}
