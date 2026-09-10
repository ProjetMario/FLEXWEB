import type { Config } from "@netlify/functions";
export default async () => {
  if (Netlify.env.get("STUDIO_JOBS_ENABLED") !== "true") return;
  const base =
    Netlify.env.get("STUDIO_APP_URL") || "https://flexweb-gestion.netlify.app";
  const secret = Netlify.env.get("AUTOMATION_SHARED_SECRET");
  if (!secret) throw Error("Missing worker secret");
  const response = await fetch(
    `${base}/.netlify/functions/studio-worker-background`,
    {
      method: "POST",
      headers: { "x-automation-secret": secret },
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!response.ok) throw Error(`Studio worker HTTP ${response.status}`);
};
export const config: Config = { schedule: "*/5 * * * *" };
