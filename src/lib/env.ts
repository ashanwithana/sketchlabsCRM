import { z } from "zod";

// Server-only environment. Read lazily so importing this module during build does not fail.
const schema = z.object({
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z
    .string()
    .min(32, "SESSION_SECRET must be at least 32 characters. Generate one with: openssl rand -base64 48"),
  ADMIN_EMAIL: z.string().email(),
  ADMIN_PASSWORD: z.string().min(12, "ADMIN_PASSWORD must be at least 12 characters"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  SMTP_HOST: z.string().optional().default(""),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z
    .enum(["true", "false"])
    .optional()
    .default("false")
    .transform((v) => v === "true"),
  SMTP_USER: z.string().optional().default(""),
  SMTP_PASSWORD: z.string().optional().default(""),
  SMTP_FROM: z.string().optional().default(""),
  // Optional path to a Chrome/Chromium binary for PDF rendering. Auto-detected on macOS if unset.
  PDF_CHROME_PATH: z.string().optional().default(""),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function getEnv(): Env {
  if (cached) return cached;

  // Debug logging for Vercel
  if (process.env.NODE_ENV === "production") {
    console.log("🔍 Environment Check:");
    console.log("DATABASE_URL present:", !!process.env.DATABASE_URL);
    console.log("DATABASE_URL starts with:", process.env.DATABASE_URL?.substring(0, 30));
    console.log("SESSION_SECRET present:", !!process.env.SESSION_SECRET);
    console.log("All env keys:", Object.keys(process.env).filter(k => k.includes("DATABASE") || k.includes("SESSION") || k.includes("ADMIN")));
  }

  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment configuration. ${problems}`);
  }
  cached = parsed.data;
  return cached;
}
