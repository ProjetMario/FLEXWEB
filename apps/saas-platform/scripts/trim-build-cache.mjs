// Webpack's incremental cache is not a deployment artifact. Avoid retaining it
// alongside Next standalone output and Netlify's function copies on small disks.
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
await rm(resolve(".next/cache"), { recursive: true }).catch((error) => {
  if (error.code !== "ENOENT") throw error;
});
