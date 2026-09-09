import type { Config } from "@netlify/functions";
export default async () => {
  if (Netlify.env.get("OUTREACH_JOBS_ENABLED") !== "true") return;
  const base = Netlify.env.get("NEXT_PUBLIC_APP_URL");
  const secret = Netlify.env.get("AUTOMATION_SHARED_SECRET");
  if (!base || !secret)
    throw new Error("Configuration de prospection manquante.");
  const url = new URL("/api/outreach/run", base);
  if (url.protocol !== "https:") throw new Error("HTTPS requis.");
  const response = await fetch(url, {
    method: "POST",
    headers: { "x-automation-secret": secret },
    signal: AbortSignal.timeout(26000),
  });
  if (!response.ok)
    throw new Error(`Prospection interrompue : HTTP ${response.status}`);
  console.log(`Prospection : ${(await response.json()).detail}`);
};
export const config: Config = { schedule: "3,13,23,33,43,53 * * * *" };
