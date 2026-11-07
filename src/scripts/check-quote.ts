import "dotenv/config";
async function main() {
  const { db } = await import("../lib/db");
  const doc = await db.document.findFirst({ where: { number: "QT-2026-0004" }, include: { quotation: true } });
  console.log("crId:", doc?.quotation?.crId);
  await db.$disconnect();
}
main().catch(e=>{console.error(e);process.exit(1);});
