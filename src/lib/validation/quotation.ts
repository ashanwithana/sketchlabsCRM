import { z } from "zod";
import { parseMoney, parsePercentToBp } from "@/lib/money";
import { QUOTATION_STATUSES } from "@/lib/constants";

// Form input is strings. Parsing turns them into the integer units the database stores.
// The same schema runs in the browser and on the server, so the server never trusts the client.

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date.")
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), "Choose a valid date.");

const moneyField = (label: string, required: boolean) =>
  z.string().trim().transform((v, ctx) => {
    if (v === "") {
      if (!required) return 0;
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Enter a ${label.toLowerCase()}.` });
      return z.NEVER;
    }
    const minor = parseMoney(v);
    if (minor === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${label} must be an amount such as 1250 or 1250.50.` });
      return z.NEVER;
    }
    return minor;
  });

export const quotationLineSchema = z.object({
  description: z.string().trim().min(1, "Describe the item.").max(500, "Keep descriptions under 500 characters."),
  quantity: z
    .string()
    .trim()
    .regex(/^\d{1,6}$/, "Quantity must be a whole number.")
    .transform(Number)
    .refine((n) => n >= 1, "Quantity must be at least 1."),
  unitPrice: moneyField("Unit price", true),
  discount: moneyField("Discount", false),
  taxRate: z.string().trim().transform((v, ctx) => {
    if (v === "") return 0;
    const bp = parsePercentToBp(v);
    if (bp === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Tax must be a percentage from 0 to 100." });
      return z.NEVER;
    }
    return bp;
  }),
});

export const quotationSchema = z
  .object({
    clientId: z.string().min(1, "Choose a client."),
    issueDate: isoDate,
    validUntil: isoDate,
    terms: z.string().trim().max(4000, "Keep terms under 4000 characters.").transform((v) => (v === "" ? null : v)),
    notes: z.string().trim().max(2000, "Keep notes under 2000 characters.").transform((v) => (v === "" ? null : v)),
    items: z
      .array(quotationLineSchema)
      .min(1, "Add at least one item.")
      .max(100, "A quotation can hold up to 100 items."),
  })
  .superRefine((v, ctx) => {
    if (v.validUntil < v.issueDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["validUntil"],
        message: "The expiry date must be on or after the issue date.",
      });
    }
  });

export type QuotationInput = z.input<typeof quotationSchema>;
export type QuotationLineInput = z.input<typeof quotationLineSchema>;
export type QuotationValues = z.output<typeof quotationSchema>;

export const QUOTATION_STATUS_CHOICES = QUOTATION_STATUSES.filter((s) => s !== "EXPIRED");
