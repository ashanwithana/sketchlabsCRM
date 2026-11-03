import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { ensurePdfRevision, PdfError } from "@/lib/documents/pdf-revisions";

// Serves a document's PDF to signed-in users. ?download=1 downloads; otherwise it opens inline.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  const download = new URL(req.url).searchParams.get("download") === "1";

  try {
    const result = await ensurePdfRevision(id, user.name);
    const safeRef = result.reference.replace(/[^A-Za-z0-9-]/g, "");
    const filename = `${safeRef}-rev${result.revision}.pdf`;

    return new NextResponse(new Uint8Array(result.buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(result.buffer.length),
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    if (err instanceof PdfError) return new NextResponse(err.message, { status: 404 });
    console.error("PDF generation failed", err instanceof Error ? err.message : err);
    const message = err instanceof Error && err.message.includes("No Chrome")
      ? err.message
      : "The PDF could not be generated. Check the server log.";
    return new NextResponse(message, { status: 503 });
  }
}
