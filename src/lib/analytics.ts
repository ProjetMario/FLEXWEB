type LeadService = "site" | "automation" | "application";
type AnalyticsWindow = Window & {
  gtag?: (...args: unknown[]) => void;
};

/** Record a confirmed request only. Never pass form values or private URLs. */
export function trackLead(formId: "project_quote", service: LeadService): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.localStorage.getItem("flex-web-cookie-consent") !== "accepted") return false;
    if (window.location.pathname.startsWith("/espace-projet")) return false;
    const analyticsWindow = window as AnalyticsWindow;
    if (typeof analyticsWindow.gtag !== "function") return false;
    if (formId !== "project_quote" || !["site", "automation", "application"].includes(service)) return false;
    analyticsWindow.gtag("event", "generate_lead", {
      form_id: formId,
      service_type: service,
      page_location: window.location.origin + window.location.pathname,
      transport_type: "beacon",
    });
    return true;
  } catch {
    // Analytics must never prevent a successfully recorded quote request.
    return false;
  }
}
