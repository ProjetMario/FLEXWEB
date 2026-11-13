import { trackLead as trackGoogleLead } from "./analytics.ts";

/** Form-only advertising measurement; keep the shared analytics bundle stable. */
export function trackLead(...args: Parameters<typeof trackGoogleLead>): boolean {
  const googleRecorded = trackGoogleLead(...args);
  const [formId, service] = args;
  let advertisingRecorded = false;
  try {
    if (typeof window !== "undefined"
      && window.location.pathname.replace(/\/$/, "") === "/demarrer"
      && formId === "project_quote"
      && ["site", "automation", "application"].includes(service)
      && window.localStorage.getItem("flex-web-cookie-consent") === "accepted"
      && window.localStorage.getItem("flex-web-openai-consent") === "accepted") {
      const pixel = (window as Window & { oaiq?: (...values: unknown[]) => void }).oaiq;
      if (typeof pixel === "function") {
        pixel("measure", "lead_created", { type: "customer_action" });
        advertisingRecorded = true;
      }
    }
  } catch {
    // A confirmed request must succeed even when advertising is unavailable.
  }
  return googleRecorded || advertisingRecorded;
}
