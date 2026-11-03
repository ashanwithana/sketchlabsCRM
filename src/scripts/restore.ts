// Restores a backup archive over the current data.
// Stop the app first (npm run dev / npm start), then run:
//   npm run restore -- backups/backup-<timestamp>.tar.gz
// Add --yes to skip the confirmation prompt (for scripted use).
import "dotenv/config";
import path from "node:path";
import readline from "node:readline/promises";
import { restoreBackup, sqliteFileFromUrl, RestoreError } from "../lib/backup/backup";

async function main() {
  const args = process.argv.slice(2);
  const yes = args.includes("--yes");
  const archive = args.find((a) => !a.startsWith("--"));
  if (!archive) throw new RestoreError("Usage: npm run restore -- <backup.tar.gz> [--yes]");

  const databaseFile = sqliteFileFromUrl(process.env.DATABASE_URL ?? "");
  const storageDir = path.resolve(process.env.STORAGE_DIR ?? "storage");
  const safetyDir = path.resolve(process.env.BACKUP_DIR ?? "backups");

  if (!yes) {
    if (!process.stdin.isTTY) throw new RestoreError("Run this in a terminal to confirm, or pass --yes.");
    console.log(`This replaces the current database and storage with ${archive}.`);
    console.log("Make sure the app is stopped. The current data is saved to backups/ first.");
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question('Type "restore" to continue: ');
    rl.close();
    if (answer.trim() !== "restore") {
      console.log("Cancelled. Nothing was changed.");
      return;
    }
  }

  const { safetyBackup, manifest } = await restoreBackup({ archive: path.resolve(archive), databaseFile, storageDir, safetyDir });
  console.log(`Restored backup "${manifest.label}" created ${manifest.createdAt}.`);
  console.log(`Previous data saved to: ${safetyBackup}`);
  console.log("Start the app again.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
