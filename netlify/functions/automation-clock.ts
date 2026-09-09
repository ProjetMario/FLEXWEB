import type { Config } from "@netlify/functions";
export default async () => {
  const base = Netlify.env.get("AUTOMATION_API_URL");
  const secret = Netlify.env.get("AUTOMATION_SHARED_SECRET");
  if (Netlify.env.get("AUTOMATION_WORKER_ENABLED") !== "true") return;
  if (!base || !secret || secret.length < 32 || !base.startsWith("https://"))
    throw new Error("Automation worker configuration missing");
  const response = await fetch(
    `${base.replace(/\/$/, "")}/api/automation/run`,
    {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(25000),
      headers: { "x-automation-secret": secret },
    },
  );
  if (!response.ok)
    throw new Error(`Automation worker returned ${response.status}`);
  const stats = await response.json();
  console.log("Automation run", stats);
  if (stats.failed)
    throw new Error("Some automation actions need attention in the dashboard");
};
export const config: Config = { schedule: "*/10 * * * *" };
