import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { getConnectionString } from "@netlify/database";
import { Pool } from "pg";
import { env } from "@/lib/env";

const cache = globalThis as unknown as { flexwebPrisma?: PrismaClient };
function getClient(): PrismaClient {
  if (!cache.flexwebPrisma) {
    const connectionString = env.DATABASE_PROVIDER === "netlify"
      ? getConnectionString()
      : env.DATABASE_URL;
    if (!connectionString) throw new Error("La base de données doit être configurée.");
    const pool = new Pool({connectionString, max: 5, connectionTimeoutMillis: 10000, idleTimeoutMillis: 30000});
    cache.flexwebPrisma = new PrismaClient({adapter:new PrismaPg(pool)});
  }
  return cache.flexwebPrisma;
}

// Netlify supplies the database connection at runtime, after the build.
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getClient();
    const value = Reflect.get(client, property);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
