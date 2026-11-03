import { PrismaClient } from "@prisma/client";

// Debug: Log env vars when db module loads
console.log("🔍 DB.ts loading - NODE_ENV:", process.env.NODE_ENV);
console.log("🔍 DATABASE_URL present:", !!process.env.DATABASE_URL);
if (process.env.DATABASE_URL) {
  console.log("🔍 DATABASE_URL preview:", process.env.DATABASE_URL.substring(0, 50) + "...");
}

// One Prisma client per process. Reusing it avoids exhausting connections during hot reload.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
