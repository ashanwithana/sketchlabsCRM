import path from "node:path";
import fs from "node:fs/promises";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getEnv } from "@/lib/env";
import { logActivity } from "@/lib/activity";
import { createBackup, sqliteFileFromUrl } from "@/lib/backup/backup";
import { storageRoot } from "@/lib/storage";

// Creates a backup and sends it to an administrator. Restores are done from the command line,
// because replacing the database while the app is serving requests is unsafe.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  if (user.role !== "ADMIN") return new NextResponse("Only administrators can create backups.", { status: 403 });

  try {
    const databaseFile = sqliteFileFromUrl(getEnv().DATABASE_URL);
    const outDir = path.resolve(/*turbopackIgnore: true*/ process.env.BACKUP_DIR ?? "backups");
    const { file, manifest } = await createBackup({ databaseFile, storageDir: storageRoot(), outDir, label: "backup" });
    const bytes = await fs.readFile(file);

    await logActivity({
      action: "BACKUP",
      entityType: "Backup",
      entityId: null,
      summary: `${user.name} created a backup (${manifest.storageFiles} stored file(s))`,
    });

    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/gzip",
        "Content-Disposition": `attachment; filename="${path.basename(file)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("Backup failed", err instanceof Error ? err.message : err);
    return new NextResponse("The backup could not be created. Check the server log.", { status: 500 });
  }
}
