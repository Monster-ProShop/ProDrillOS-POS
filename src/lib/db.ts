import { AsyncLocalStorage } from "node:async_hooks";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
neonConfig.webSocketConstructor = globalThis.WebSocket;
const scope = new AsyncLocalStorage<PrismaClient>();
let local: PrismaClient | undefined;
function createClient() {
  const connectionString = process.env.DATABASE_URL;
  const neon =
    connectionString &&
    new URL(connectionString).hostname.endsWith(".neon.tech");
  return new PrismaClient({
    adapter: neon
      ? new PrismaNeon({ connectionString })
      : new PrismaPg({ connectionString }),
  });
}
// Workers sockets must never cross request boundaries.
export async function withDatabase<T>(fn: () => Promise<T>): Promise<T> {
  const client = createClient();
  try {
    return await scope.run(client, fn);
  } finally {
    await client.$disconnect();
  }
}
export const db = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = scope.getStore() ?? (local ??= createClient());
    const value = Reflect.get(client, prop);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
