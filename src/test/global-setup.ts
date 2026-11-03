import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// Creates a fresh test database (prisma/test.db) before the suite runs.
// Tests never touch the development database.
export default function setup() {
  const root = path.resolve(__dirname, "../..");
  const testDb = path.join(root, "prisma", "test.db");
  for (const file of [testDb, `${testDb}-journal`]) {
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
  execSync("npx prisma migrate deploy", {
    cwd: root,
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: "file:./test.db" },
  });
}
