import path from "node:path";
import { defineConfig } from "vitest/config";

// Temporary config for running DB-free tests (e.g. invoice schedule) without the
// sqlite globalSetup, which does not match this project's Postgres schema.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "src/test/server-only-stub.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    env: {
      SESSION_SECRET: "test-secret-that-is-long-enough-for-hs256-0123456789",
      ADMIN_EMAIL: "admin@example.com",
      ADMIN_PASSWORD: "test-password-123",
    },
  },
});
