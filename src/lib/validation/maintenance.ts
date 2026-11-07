import { z } from "zod";
import { parseMoney, parsePercentToBp } from "@/lib/money";
import { MAINTENANCE_STATUSES } from "@/lib/constants";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date.")
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), "Choose a valid date.");

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be under ${max} characters.`)
    .transform((v) => (v === "" ? null : v));

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

export const maintenanceLineSchema = z.object({
  description: z.string().trim().min(1, "Describe the service.").max(200, "Keep the description under 200 characters."),
  quantity: z
    .string()
    .trim()
    .regex(/^\d{1,4}$/, "Quantity must be a whole number.")
    .transform(Number)
    .refine((n) => n >= 1, "Quantity must be at least 1."),
  unitPrice: moneyField("Unit price", true),
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

export const maintenanceSchema = z
  .object({
    clientId: z.string().min(1, "Choose a client."),
    validFrom: isoDate,
    validUntil: isoDate,
    cycle: z.enum(["MONTHLY", "QUARTERLY", "ANNUAL"]),
    billingDay: z
      .string()
      .trim()
      .regex(/^\d{1,2}$/, "Day must be a whole number.")
      .transform(Number)
      .refine((n) => n >= 1 && n <= 28, "Day must be between 1 and 28."),
    description: z.string().trim().min(1, "Describe the scope of the agreement.").max(4000, "Keep the scope under 4000 characters."),
    terms: optionalText(4000, "Terms"),
    notes: optionalText(2000, "Notes"),
    items: z
      .array(maintenanceLineSchema)
      .min(1, "Add at least one service.")
      .max(100, "An agreement can hold up to 100 services."),
  })
  .superRefine((v, ctx) => {
    if (v.validUntil < v.validFrom) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["validUntil"], message: "The end date must be on or after the start date." });
    }
  });

export type MaintenanceInput = z.input<typeof maintenanceSchema>;
export type MaintenanceLineInput = z.input<typeof maintenanceLineSchema>;
export type MaintenanceValues = z.output<typeof maintenanceSchema>;

export const MAINTENANCE_STATUS_CHOICES = MAINTENANCE_STATUSES.filter((s) => s !== "CANCELLED");