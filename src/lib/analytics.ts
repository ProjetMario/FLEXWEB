type LeadService = "site" | "automation" | "application";
type AnalyticsWindow = Window & {
  gtag?: (...args: unknown[]) => void;
};

function canTrack(allowProjectPortal = false): AnalyticsWindow | null {
  if (typeof window === "undefined") return null;
  try {
    if (window.localStorage.getItem("flex-web-cookie-consent") !== "accepted") return null;
    if (!allowProjectPortal && window.location.pathname.startsWith("/espace-projet")) return null;
    const analyticsWindow = window as AnalyticsWindow;
    return typeof analyticsWindow.gtag === "function" ? analyticsWindow : null;
  } catch {
    return null;
  }
}

/** Record a confirmed request only. Never pass form values or private URLs. */
export function trackLead(formId: "project_quote", service: LeadService): boolean {
  try {
    const analyticsWindow = canTrack();
    if (!analyticsWindow) return false;
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

export function trackConversionEvent(eventName: string, service: string = "unknown"): boolean {
  try {
    const analyticsWindow = canTrack(eventName === "crm_link_open");
    if (!analyticsWindow) return false;
    if (!["quote_click", "form_start", "crm_link_open", "appointment_click"].includes(eventName)) return false;
    analyticsWindow.gtag("event", eventName, {
      service_type: String(service || "unknown").slice(0, 40),
      page_location: window.location.origin + window.location.pathname,
      transport_type: "beacon",
    });
    return true;
  } catch {
    return false;
  }
}
