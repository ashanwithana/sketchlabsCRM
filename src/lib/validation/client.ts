import { z } from "zod";
import { CLIENT_CATEGORIES } from "@/lib/constants";

const phone = z
  .string()
  .trim()
  .max(40)
  .refine((v) => /^\+?[\d\s()\-]{7,40}$/.test(v), "Enter a valid phone number, for example +94 77 123 4567.");

const categoryValues = CLIENT_CATEGORIES.map((c) => c.value) as [
  (typeof CLIENT_CATEGORIES)[number]["value"],
  ...(typeof CLIENT_CATEGORIES)[number]["value"][],
];

export const clientSchema = z.object({
  companyName: z.string().trim().min(2, "Enter the company name.").max(160),
  contactPerson: z.string().trim().min(2, "Enter the contact person's name.").max(120),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Enter an email address.")
    .email("Enter a valid email address.")
    .max(254),
  phone,
  billingAddress: z.string().trim().min(5, "Enter the billing address.").max(500),
  registrationNumber: z.string().trim().min(3, "Enter the company registration number.").max(60),
  vatNumber: z
    .string()
    .trim()
    .max(60)
    .transform((v) => (v === "" ? null : v)),
  category: z.enum(categoryValues, { errorMap: () => ({ message: "Choose a category." }) }),
  notes: z
    .string()
    .trim()
    .max(2000, "Keep notes under 2000 characters.")
    .transform((v) => (v === "" ? null : v)),
});

export type ClientInput = z.input<typeof clientSchema>;
export type ClientValues = z.output<typeof clientSchema>;

export const equipmentSchema = z.object({
  name: z.string().trim().min(2, "Enter the system name.").max(120),
  model: z.string().trim().max(120).transform((v) => (v === "" ? null : v)),
  serialNumber: z.string().trim().max(120).transform((v) => (v === "" ? null : v)),
  location: z.string().trim().max(200).transform((v) => (v === "" ? null : v)),
  installedOn: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .refine((v) => v === null || !Number.isNaN(Date.parse(v)), "Enter a valid installation date.")
    .transform((v) => (v === null ? null : new Date(v))),
  notes: z.string().trim().max(2000).transform((v) => (v === "" ? null : v)),
});

export type EquipmentInput = z.input<typeof equipmentSchema>;
export type EquipmentValues = z.output<typeof equipmentSchema>;
