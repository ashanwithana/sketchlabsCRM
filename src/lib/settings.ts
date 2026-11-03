import "server-only";
import { db } from "@/lib/db";

/** Returns the single company settings row, creating it with defaults on first use. */
export async function getCompanySettings() {
  return db.companySettings.upsert({
    where: { id: "company" },
    update: {},
    create: { id: "company" },
  });
}
