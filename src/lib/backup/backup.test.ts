import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { createBackup, restoreBackup, RestoreError, sqliteFileFromUrl } from "./backup";

const run = promisify(execFile);

describe("database path parsing", () => {
  it("resolves relative SQLite URLs against prisma/ and keeps absolute ones", () => {
    expect(sqliteFileFromUrl("file:./dev.db", "/app")).toBe("/app/prisma/dev.db");
    expect(sqliteFileFromUrl("file:/var/data/app.db", "/app")).toBe("/var/data/app.db");
  });

  it("refuses non-SQLite databases with a pointer to pg_dump", () => {
    expect(() => sqliteFileFromUrl("postgresql://user@host/db")).toThrow("pg_dump");
  });
});

describe("backup and restore round trip", () => {
  let root = "";
  let dbFile = "";
  let storageDir = "";
  let outDir = "";
  let safetyDir = "";
  const marker = `BACKUP_TEST_${Date.now()}`;

  const countMarker = async () => {
    const client = new PrismaClient({ datasources: { db: { url: `file:${dbFile}` } } });
    try {
      return await client.activityLog.count({ where: { summary: marker } });
    } finally {
      await client.$disconnect();
    }
  };

  beforeAll(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "cma-backup-test-"));
    dbFile = path.join(root, "app.db");
    storageDir = path.join(root, "storage");
    outDir = path.join(root, "backups");
    safetyDir = path.join(root, "safety");

    // Start from the migrated test database, then add a recognisable row.
    await fs.copyFile(path.resolve(process.cwd(), "prisma", "test.db"), dbFile);
    const client = new PrismaClient({ datasources: { db: { url: `file:${dbFile}` } } });
    await client.activityLog.create({ data: { action: "CREATE", entityType: "Test", summary: marker } });
    await client.$disconnect();

    await fs.mkdir(path.join(storageDir, "branding"), { recursive: true });
    await fs.writeFile(path.join(storageDir, "branding", "logo.png"), Buffer.from("logo-bytes"));
  });

  afterAll(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it("writes an archive with a manifest, the database, and the storage files", async () => {
    const { file, manifest } = await createBackup({ databaseFile: dbFile, storageDir, outDir, label: "test" });
    expect(path.basename(file)).toMatch(/^test-.*\.tar\.gz$/);
    expect(manifest.storageFiles).toBe(1);
    expect(manifest.databaseSha256).toHaveLength(64);
    const listing = (await run("tar", ["-tzf", file])).stdout;
    expect(listing).toContain("manifest.json");
    expect(listing).toContain("database.db");
    expect(listing).toContain("storage/branding/logo.png");
  });

  it("restores the database and storage, and keeps a safety copy of what it replaced", async () => {
    const { file } = await createBackup({ databaseFile: dbFile, storageDir, outDir, label: "roundtrip" });
    expect(await countMarker()).toBe(1);

    // Simulate losing data after the backup was taken.
    const client = new PrismaClient({ datasources: { db: { url: `file:${dbFile}` } } });
    await client.activityLog.deleteMany({ where: { summary: marker } });
    await client.$disconnect();
    await fs.rm(path.join(storageDir, "branding", "logo.png"));
    await fs.writeFile(path.join(storageDir, "branding", "new-after-backup.png"), Buffer.from("later"));
    expect(await countMarker()).toBe(0);

    const result = await restoreBackup({ archive: file, databaseFile: dbFile, storageDir, safetyDir });
    expect(await countMarker()).toBe(1);
    expect((await fs.readFile(path.join(storageDir, "branding", "logo.png"))).toString()).toBe("logo-bytes");
    await expect(fs.access(path.join(storageDir, "branding", "new-after-backup.png"))).rejects.toThrow();
    expect(result.safetyBackup.startsWith(safetyDir)).toBe(true);
    await expect(fs.access(result.safetyBackup)).resolves.toBeUndefined();
  }, 60_000);

  it("refuses an archive that is not a backup, and leaves the data untouched", async () => {
    const junk = path.join(root, "junk");
    await fs.mkdir(junk, { recursive: true });
    await fs.writeFile(path.join(junk, "notes.txt"), "not a backup");
    const archive = path.join(root, "not-a-backup.tar.gz");
    await run("tar", ["-czf", archive, "-C", junk, "."]);

    await expect(restoreBackup({ archive, databaseFile: dbFile, storageDir, safetyDir })).rejects.toBeInstanceOf(RestoreError);
    expect(await countMarker()).toBe(1);
  });

  it("refuses a backup whose database was altered after it was made", async () => {
    const { file } = await createBackup({ databaseFile: dbFile, storageDir, outDir, label: "tamper" });

    // Unpack, change the database, and repack without updating the manifest.
    const unpacked = path.join(root, "unpacked");
    await fs.mkdir(unpacked, { recursive: true });
    await run("tar", ["-xzf", file, "-C", unpacked]);
    const dbPath = path.join(unpacked, "database.db");
    await fs.appendFile(dbPath, Buffer.from("tampered"));
    const tampered = path.join(root, "tampered.tar.gz");
    await run("tar", ["-czf", tampered, "-C", unpacked, "."]);

    await expect(restoreBackup({ archive: tampered, databaseFile: dbFile, storageDir, safetyDir })).rejects.toThrow("checksum");
    expect(await countMarker()).toBe(1);
  });
});
