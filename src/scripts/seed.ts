// Creates or updates the admin account and the company settings row from .env.
// Run with: npm run db:seed
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "";

  if (!email || password.length < 12) {
    throw new Error("Set ADMIN_EMAIL and an ADMIN_PASSWORD of at least 12 characters in .env first.");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await db.user.upsert({
    where: { email },
    update: { passwordHash },
    create: { email, name: "Administrator", passwordHash, role: "ADMIN" },
  });

  await db.companySettings.upsert({
    where: { id: "company" },
    update: {},
    create: { id: "company" },
  });

  console.log(`Admin account ready for ${email}.`);
  console.log("Company settings row ready.");
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
