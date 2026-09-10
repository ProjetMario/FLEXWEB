/** Netlify can expose an internal request URL behind its public HTTPS origin. */
export function crmOriginAllowed(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const allowed = [new URL(request.url).origin, "https://flexweb-gestion.netlify.app"];
  for (const value of [process.env.AUTH_URL, process.env.URL, process.env.DEPLOY_PRIME_URL]) {
    if (value) { try { allowed.push(new URL(value).origin); } catch { /* Ignore malformed configuration. */ } }
  }
  return allowed.includes(origin);
}
