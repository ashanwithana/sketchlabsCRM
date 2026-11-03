import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { readStoredFile } from "@/lib/storage";

// Serves a stored PDF revision exactly as it was generated. Nothing is re-rendered.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; rev: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { id, rev } = await params;
  const revisionNumber = Number.parseInt(rev, 10);
  if (!Number.isInteger(revisionNumber) || revisionNumber < 1) return new NextResponse("Not found", { status: 404 });

  const row = await db.documentRevision.findUnique({
    where: { documentId_revision: { documentId: id, revision: revisionNumber } },
    include: { document: { select: { number: true } } },
  });
  if (!row) return new NextResponse("Not found", { status: 404 });

  try {
    const bytes = await readStoredFile(row.filePath);
    const safeRef = row.document.number.replace(/[^A-Za-z0-9-]/g, "");
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(bytes.length),
        "Content-Disposition": `attachment; filename="${safeRef}-rev${row.revision}.pdf"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse("This revision's file is missing from storage.", { status: 404 });
  }
}
