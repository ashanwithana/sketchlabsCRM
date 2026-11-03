import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string({ required_error: "Enter your email address." })
    .trim()
    .toLowerCase()
    .email("Enter a valid email address.")
    .max(254),
  password: z.string({ required_error: "Enter your password." }).min(1, "Enter your password.").max(200),
  next: z
    .string()
    .optional()
    .transform((v) => (v && v.startsWith("/") && !v.startsWith("//") ? v : "/dashboard")),
});

export type LoginInput = z.infer<typeof loginSchema>;
