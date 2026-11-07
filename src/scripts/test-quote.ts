import "dotenv/config";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const serverOnlyPath = require.resolve("server-only");
require.cache[serverOnlyPath] = { id: serverOnlyPath, filename: serverOnlyPath, loaded: true, exports: {} } as any;

async function main() {
  const { db } = await import("../lib/db");
  const { createQuotation } = await import("../lib/quotations/service");
  const { quotationSchema } = await import("../lib/validation/quotation");

  const client = await db.client.findFirst({ where: { companyName: "Alpha Ltd" } });
  if (!client) throw new Error("no client");

  const input = quotationSchema.parse({
    clientId: client.id,
    crId: "",
    issueDate: "2026-11-07",
    validUntil: "2026-12-31",
    terms: "Terms",
    notes: "",
    items: [{ description: "Website maintenance", quantity: "1", unitPrice: "15000", discount: "", taxRate: "0" }],
  });

  const created = await createQuotation(input, "Tester");
  console.log("Created quotation", created.number, created.id);

  await db.document.deleteMany({ where: { id: created.id } });
  await db.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });