import { defineConfig } from "prisma/config";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

export default defineConfig({
  schema: "./prisma/schema.prisma",
  ...((process.env.DATABASE_URL || process.env.NETLIFY_DB_URL) ? { datasource: { url: (process.env.DATABASE_URL || process.env.NETLIFY_DB_URL)! } } : {}),
});
