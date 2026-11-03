import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // server-only throws outside React Server Components. Tests import server modules, so stub it.
      "server-only": path.resolve(__dirname, "src/test/server-only-stub.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    globalSetup: ["src/test/global-setup.ts"],
    fileParallelism: false,
    env: {
      SESSION_SECRET: "test-secret-that-is-long-enough-for-hs256-0123456789",
      ADMIN_EMAIL: "admin@example.com",
      ADMIN_PASSWORD: "test-password-123",
      DATABASE_URL: "file:./test.db",
    },
  },
});
