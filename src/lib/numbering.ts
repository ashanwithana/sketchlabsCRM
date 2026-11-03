import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

// Document and client numbers. Each kind has a counter in the Sequence table.
// The counter is incremented atomically, so two requests never receive the same number.
// Numbers are never reused, even if the record that received one is later deleted.

export type NumberKind = "CLIENT" | "QUOTATION" | "CR" | "MAINTENANCE";

const PREFIX: Record<NumberKind, string> = {
  CLIENT: "CL",
  QUOTATION: "QT",
  CR: "CR",
  MAINTENANCE: "MR",
};

/** CL-0001 for clients, QT-2026-0001 for documents. Pure, so it is easy to test. */
export function formatNumber(kind: NumberKind, sequence: number, year: number): string {
  const padded = String(sequence).padStart(4, "0");
  if (kind === "CLIENT") return `${PREFIX[kind]}-${padded}`;
  return `${PREFIX[kind]}-${year}-${padded}`;
}

/** The Sequence key. Clients share one counter; documents restart each calendar year. */
export function sequenceKey(kind: NumberKind, year: number): string {
  return kind === "CLIENT" ? PREFIX.CLIENT : `${PREFIX[kind]}-${year}`;
}

type Tx = Prisma.TransactionClient | typeof db;

/**
 * Returns the next number for `kind`. Pass the transaction client when the number is
 * used to create a record, so a failed save does not burn a number.
 */
export async function nextNumber(kind: NumberKind, tx: Tx = db, now: Date = new Date()): Promise<string> {
  const year = now.getUTCFullYear();
  const key = sequenceKey(kind, year);

  let row;
  try {
    row = await tx.sequence.upsert({
      where: { key },
      create: { key, value: 1 },
      update: { value: { increment: 1 } },
    });
  } catch (err) {
    // Two first-ever calls can both try to create the row. The loser retries as an update.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      row = await tx.sequence.update({ where: { key }, data: { value: { increment: 1 } } });
    } else {
      throw err;
    }
  }

  return formatNumber(kind, row.value, year);
}
