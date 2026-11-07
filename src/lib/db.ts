import { PrismaClient } from "@prisma/client";
import { PrismaD1 } from "@prisma/adapter-d1";

let localPrisma: PrismaClient | null = null;
const d1ClientCache = new WeakMap<object, PrismaClient>();

export function getDb(): PrismaClient {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getCloudflareContext } = require("@opennextjs/cloudflare");
    const ctx = getCloudflareContext();
    const d1 = ctx?.env?.company_db ?? ctx?.env?.DB;
    if (d1) {
      let client = d1ClientCache.get(d1);
      if (!client) {
        const adapter = new PrismaD1(d1);
        client = new PrismaClient({ adapter });
        d1ClientCache.set(d1, client);
      }
      return client;
    }
  } catch {
    // Not running inside a Cloudflare request context (e.g. build time, local script, or tests)
  }

  if (!localPrisma) {
    localPrisma = new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    });
  }
  return localPrisma;
}

export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getDb();
    const value = Reflect.get(client, prop);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
