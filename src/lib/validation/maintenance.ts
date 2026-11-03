import { z } from "zod";
import { MAINTENANCE_STATUSES } from "@/lib/constants";

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

const MAX_SIGNATURE_CHARS = 400_000;
const signature = z
  .string()
  .transform((v) => (v === "" ? null : v))
  .refine(
    (v) => v === null || (v.startsWith("data:image/png;base64,") && v.length <= MAX_SIGNATURE_CHARS),
    "The signature could not be read. Draw it again.",
  );

export const maintenancePartSchema = z.object({
  name: z.string().trim().min(1, "Name the part.").max(120),
  quantity: z
    .string()
    .trim()
    .regex(/^\d{1,3}$/, "Quantity must be a whole number.")
    .transform(Number)
    .refine((n) => n >= 1, "Quantity must be at least 1."),
  notes: optionalText(200, "Part notes"),
});

export const maintenanceSchema = z
  .object({
    clientId: z.string().min(1, "Choose a client."),
    equipmentId: z.string().min(1, "Choose the equipment or service that was maintained."),
    status: z.enum(["SCHEDULED", "COMPLETED", "CANCELLED"], { errorMap: () => ({ message: "Choose a status." }) }),
    maintenanceDate: isoDate,
    nextMaintenanceDate: optionalDate,
    description: z.string().trim().min(10, "Describe the maintenance (at least 10 characters).").max(4000),
    workPerformed: optionalText(4000, "Work performed"),
    technicianName: optionalText(120, "Technician name"),
    technicianDetails: optionalText(500, "Technician details"),
    parts: z.array(maintenancePartSchema).max(100, "A report can list up to 100 parts."),
    customerRemarks: optionalText(2000, "Customer remarks"),
    recommendations: optionalText(4000, "Recommendations"),
    customerSignature: signature,
    technicianSignature: signature,
  })
  .superRefine((v, ctx) => {
    if (v.nextMaintenanceDate && v.nextMaintenanceDate < v.maintenanceDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["nextMaintenanceDate"], message: "The next service must be on or after this service." });
    }
    if (v.status === "COMPLETED") {
      if (!v.workPerformed) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["workPerformed"], message: "Describe the work performed before marking the service complete." });
      if (!v.technicianName) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["technicianName"], message: "Enter the technician's name before marking the service complete." });
    }
  });

export type MaintenanceInput = z.input<typeof maintenanceSchema>;
export type MaintenanceValues = z.output<typeof maintenanceSchema>;
export const MAINTENANCE_STATUS_CHOICES = MAINTENANCE_STATUSES;
