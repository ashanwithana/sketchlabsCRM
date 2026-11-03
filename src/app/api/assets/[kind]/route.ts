import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getCompanySettings } from "@/lib/settings";
import { contentTypeFor, readStoredFile } from "@/lib/storage";

// Serves the company logo and signature to signed-in users only.
const KINDS = {
  logo: "logoPath",
  signature: "signaturePath",
} as const;

export async function GET(_req: Request, { params }: { params: Promise<{ kind: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { kind } = await params;
  const field = KINDS[kind as keyof typeof KINDS];
  if (!field) return new NextResponse("Not found", { status: 404 });

  const settings = await getCompanySettings();
  const relative = settings[field];
  if (!relative) return new NextResponse("Not found", { status: 404 });

  try {
    const bytes = await readStoredFile(relative);
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": contentTypeFor(relative),
        "Cache-Control": "private, no-cache",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
