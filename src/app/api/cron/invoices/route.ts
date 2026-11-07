import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { runScheduledInvoices } from "@/lib/invoices/service";

// Daily billing cron. Vercel Cron calls this at the schedule in vercel.json and sends
// `Authorization: Bearer <CRON_SECRET>` when that environment variable is configured.
// The run generates and emails at most one invoice per client whose due date has arrived.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { CRON_SECRET } = getEnv();
  if (!CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 500 });
  }

  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const run = await runScheduledInvoices();
    return NextResponse.json({ ok: true, ...run });
  } catch (err) {
    console.error("Invoice cron failed:", err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
