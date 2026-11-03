// Creates a backup of the database and storage folder in ./backups.
// Run with: npm run backup   (safe while the app is running)
import "dotenv/config";
import path from "node:path";
import { createBackup, sqliteFileFromUrl } from "../lib/backup/backup";

async function main() {
  const databaseUrl = process.env.DATABASE_URL ?? "";
  const databaseFile = sqliteFileFromUrl(databaseUrl);
  const storageDir = path.resolve(process.env.STORAGE_DIR ?? "storage");
  const outDir = path.resolve(process.env.BACKUP_DIR ?? "backups");

  const { file, manifest } = await createBackup({ databaseFile, storageDir, outDir, label: "backup" });
  console.log(`Backup written: ${file}`);
  console.log(`Created ${manifest.createdAt} · ${manifest.storageFiles} stored file(s)`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
