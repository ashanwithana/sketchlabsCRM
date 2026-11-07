import { z } from "zod";
import { parseMoney } from "@/lib/money";
import { CR_STATUSES } from "@/lib/constants";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date.")
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), "Choose a valid date.");

const optionalDate = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .refine((v) => v === null || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`))), "Choose a valid date.");

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be under ${max} characters.`)
    .transform((v) => (v === "" ? null : v));

// Drawn signatures arrive as PNG data URLs from the signature pad.
const MAX_SIGNATURE_CHARS = 400_000;
const signature = z
  .string()
  .transform((v) => (v === "" ? null : v))
  .refine(
    (v) => v === null || (v.startsWith("data:image/png;base64,") && v.length <= MAX_SIGNATURE_CHARS),
    "The signature could not be read. Draw it again.",
  );

export const crSchema = z.object({
  clientId: z.string().min(1, "Choose a client."),
  quotationId: z.string().trim().transform((v) => (v === "" ? null : v)),
  issueDate: isoDate,
  requestDetails: z
    .string()
    .trim()
    .min(10, "Describe the customer's request (at least 10 characters).")
    .max(4000, "Keep the request under 4000 characters."),
  scopeOfWork: z
    .string()
    .trim()
    .min(10, "Describe the scope of work (at least 10 characters).")
    .max(6000, "Keep the scope of work under 6000 characters."),
  deliveryDate: optionalDate,
  customerRequirements: optionalText(4000, "Customer requirements"),
  remarks: optionalText(2000, "Remarks"),
  cost: z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (v === "") return 0;
      const minor = parseMoney(v);
      if (minor === null) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Cost must be an amount such as 1250 or 1250.50." });
        return z.NEVER;
      }
      return minor;
    }),
  approvalName: optionalText(120, "Approver name"),
  approvalDate: optionalDate,
  customerSignature: signature,
});

export type CrInput = z.input<typeof crSchema>;
export type CrValues = z.output<typeof crSchema>;

export const CR_STATUS_CHOICES = CR_STATUSES;
