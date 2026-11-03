// Backup and restore for the SQLite database and the storage folder.
//
// A backup is a .tar.gz containing:
//   database.db     consistent snapshot made with VACUUM INTO (safe while the app runs)
//   storage/        logos, signatures, PDF revisions, and the dev outbox
//   manifest.json   format version, timestamp, checksum of the database, and file counts
//
// Restore verifies the archive first, takes a safety backup of the current data, and only then
// replaces the database and storage folder.

import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { PrismaClient } from "@prisma/client";

const run = promisify(execFile);
const FORMAT = 1;

export type Manifest = {
  format: number;
  label: string;
  createdAt: string;
  databaseSha256: string;
  storageFiles: number;
};

/** Resolves a SQLite DATABASE_URL ("file:./dev.db") to an absolute path. Relative paths are relative to prisma/. */
export function sqliteFileFromUrl(databaseUrl: string, projectRoot = process.cwd()): string {
  if (!databaseUrl.startsWith("file:")) {
    throw new Error("Backups currently support SQLite only. For Postgres, use pg_dump (see the README).");
  }
  const raw = databaseUrl.slice("file:".length).split("?")[0];
  return path.isAbsolute(raw) ? raw : path.resolve(projectRoot, "prisma", raw);
}

async function exists(p: string) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function countFiles(dir: string): Promise<number> {
  if (!(await exists(dir))) return 0;
  let n = 0;
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    n += entry.isDirectory() ? await countFiles(full) : 1;
  }
  return n;
}

async function sha256File(file: string) {
  return createHash("sha256").update(await fs.readFile(file)).digest("hex");
}

/** Makes a consistent copy of an SQLite file. The target must not exist yet. */
async function snapshotDatabase(databaseFile: string, target: string) {
  if (target.includes("'")) throw new Error("Backup path cannot contain a single quote.");
  const client = new PrismaClient({ datasources: { db: { url: `file:${databaseFile}` } } });
  try {
    await client.$executeRawUnsafe(`VACUUM INTO '${target}'`);
  } finally {
    await client.$disconnect();
  }
}

export type BackupOptions = {
  databaseFile: string;
  storageDir: string;
  outDir: string;
  label?: string;
};

/** Writes a new backup archive into outDir and returns its path and manifest. */
export async function createBackup(opts: BackupOptions): Promise<{ file: string; manifest: Manifest }> {
  const label = opts.label ?? "backup";
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const name = `${label}-${stamp}`;
  const stage = path.join(os.tmpdir(), `cma-stage-${randomUUID()}`);
  await fs.mkdir(stage, { recursive: true });

  try {
    const dbCopy = path.join(stage, "database.db");
    await snapshotDatabase(opts.databaseFile, dbCopy);

    if (await exists(opts.storageDir)) {
      await fs.cp(opts.storageDir, path.join(stage, "storage"), { recursive: true });
    } else {
      await fs.mkdir(path.join(stage, "storage"));
    }

    const manifest: Manifest = {
      format: FORMAT,
      label,
      createdAt: new Date().toISOString(),
      databaseSha256: await sha256File(dbCopy),
      storageFiles: await countFiles(path.join(stage, "storage")),
    };
    await fs.writeFile(path.join(stage, "manifest.json"), JSON.stringify(manifest, null, 2));

    await fs.mkdir(opts.outDir, { recursive: true });
    const file = path.join(path.resolve(opts.outDir), `${name}.tar.gz`);
    await run("tar", ["-czf", file, "-C", stage, "."]);
    return { file, manifest };
  } finally {
    await fs.rm(stage, { recursive: true, force: true });
  }
}

export class RestoreError extends Error {}

async function readManifest(dir: string): Promise<Manifest> {
  let parsed: Manifest;
  try {
    parsed = JSON.parse(await fs.readFile(path.join(dir, "manifest.json"), "utf8"));
  } catch {
    throw new RestoreError("This file is not a backup made by this app (no manifest).");
  }
  if (parsed.format !== FORMAT) throw new RestoreError(`Unsupported backup format ${parsed.format}.`);
  return parsed;
}

/** Checks the extracted database: checksum, SQLite integrity, and the expected tables. */
async function verifyDatabase(dbFile: string, manifest: Manifest) {
  if ((await sha256File(dbFile)) !== manifest.databaseSha256) {
    throw new RestoreError("The database in this backup does not match its checksum. The file may be damaged.");
  }
  const client = new PrismaClient({ datasources: { db: { url: `file:${dbFile}` } } });
  try {
    const rows = await client.$queryRawUnsafe<{ integrity_check: string }[]>("PRAGMA integrity_check");
    if (rows[0]?.integrity_check !== "ok") throw new RestoreError("The database in this backup failed the SQLite integrity check.");
    await client.$queryRawUnsafe("SELECT count(*) AS n FROM User");
    await client.$queryRawUnsafe("SELECT count(*) AS n FROM Document");
  } catch (err) {
    if (err instanceof RestoreError) throw err;
    throw new RestoreError("The database in this backup is missing expected tables.");
  } finally {
    await client.$disconnect();
  }
}

export type RestoreOptions = {
  archive: string;
  databaseFile: string;
  storageDir: string;
  safetyDir: string;
};

/**
 * Restores an archive over the current database and storage folder.
 * The current data is backed up first to safetyDir, and that path is returned.
 */
export async function restoreBackup(opts: RestoreOptions): Promise<{ safetyBackup: string; manifest: Manifest }> {
  if (!(await exists(opts.archive))) throw new RestoreError("The backup file does not exist.");

  const extract = path.join(os.tmpdir(), `cma-restore-${randomUUID()}`);
  await fs.mkdir(extract, { recursive: true });
  try {
    try {
      await run("tar", ["-xzf", path.resolve(opts.archive), "-C", extract]);
    } catch {
      throw new RestoreError("This file could not be read as a backup archive.");
    }
    const manifest = await readManifest(extract);
    const dbSrc = path.join(extract, "database.db");
    if (!(await exists(dbSrc))) throw new RestoreError("The backup has no database file.");
    await verifyDatabase(dbSrc, manifest);

    // Safety copy of what is about to be replaced.
    const safety = await createBackup({
      databaseFile: opts.databaseFile,
      storageDir: opts.storageDir,
      outDir: opts.safetyDir,
      label: "pre-restore",
    });

    for (const suffix of ["", "-journal", "-wal", "-shm"]) {
      await fs.rm(`${opts.databaseFile}${suffix}`, { force: true });
    }
    await fs.copyFile(dbSrc, opts.databaseFile);

    await fs.rm(opts.storageDir, { recursive: true, force: true });
    const storageSrc = path.join(extract, "storage");
    if (await exists(storageSrc)) {
      await fs.cp(storageSrc, opts.storageDir, { recursive: true });
    } else {
      await fs.mkdir(opts.storageDir, { recursive: true });
    }

    return { safetyBackup: safety.file, manifest };
  } finally {
    await fs.rm(extract, { recursive: true, force: true });
  }
}
