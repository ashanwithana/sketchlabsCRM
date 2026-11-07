import { z } from "zod";
import { parseMoney, parsePercentToBp } from "@/lib/money";

// Form input is strings; parsing produces the integer units the database stores.
// The same schema runs in the browser and on the server, so the server never trusts the client.

export const billingScheduleSchema = z.object({
  billingCycle: z.enum(["MONTHLY", "QUARTERLY", "ANNUAL"], { errorMap: () => ({ message: "Choose a billing cycle." }) }),
  billingDay: z
    .string()
    .trim()
    .regex(/^\d{1,2}$/, "Choose the day of the month.")
    .transform(Number)
    .refine((n) => n >= 1 && n <= 28, "The send day must be between 1 and 28."),
  billingActive: z.boolean(),
});

export type BillingScheduleInput = z.input<typeof billingScheduleSchema>;
export type BillingScheduleValues = z.output<typeof billingScheduleSchema>;

export const billingServiceSchema = z.object({
  description: z.string().trim().min(1, "Describe the service.").max(500, "Keep descriptions under 500 characters."),
  amount: z.string().trim().transform((v, ctx) => {
    if (v === "") {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter an amount." });
      return z.NEVER;
    }
    const minor = parseMoney(v);
    if (minor === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "The amount must be such as 1250 or 1250.50." });
      return z.NEVER;
    }
    return minor;
  }),
  taxRateBp: z.string().trim().transform((v, ctx) => {
    if (v === "") return 0;
    const bp = parsePercentToBp(v);
    if (bp === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Tax must be a percentage from 0 to 100." });
      return z.NEVER;
    }
    return bp;
  }),
});

export type BillingServiceInput = z.input<typeof billingServiceSchema>;
export type BillingServiceValues = z.output<typeof billingServiceSchema>;
