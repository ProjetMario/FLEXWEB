const KEY = 'flexweb-acquisition-v1';
const CONSENT = 'flex-web-cookie-consent';
const channels = ['Google naturel', 'Autre moteur', 'Assistant IA', 'Lien externe', 'Accès direct', 'Campagne'] as const;
// Only public editorial routes may be recorded; never query strings or client URLs.
export function publicLanding(path: string): string | null {
  if (path === '/') return path;
  return /^\/(?:creation-site-internet(?:-[a-z-]+)?|creation-application-mobile(?:-[a-z-]+)?|automatisation-ia(?:-[a-z-]+)?|pricing|contact|about|journal(?:\/[a-z-]+)?|realisations(?:\/[a-z0-9-]+)?)\/$/.test(path) && path.length < 120 ? path : null;
}
export function classifySource(referrer: string, origin: string, search: string): string {
  const query = new URLSearchParams(search);
  if (query.has('gclid') || query.has('msclkid') || ['email','sms','cpc','paid','social'].includes(query.get('utm_medium') || '')) return 'Campagne';
  try {
    const url = new URL(referrer);
    if (url.origin === origin) return 'Accès direct';
    const host = url.hostname.toLowerCase();
    if (/^(?:www\.)?google\.(?:com|fr|co\.uk|de|ch|be|ca)$/.test(host)) return 'Google naturel';
    if (/^(?:www\.)?(?:bing\.com|duckduckgo\.com|search\.yahoo\.com)$/.test(host)) return 'Autre moteur';
    if (/^(?:www\.)?(?:chatgpt\.com|chat\.openai\.com|perplexity\.ai|claude\.ai|gemini\.google\.com)$/.test(host)) return 'Assistant IA';
    return 'Lien externe';
  } catch { return 'Accès direct'; }
}
export function captureAcquisition(): void {
  try {
    if (localStorage.getItem(CONSENT) !== 'accepted') { sessionStorage.removeItem(KEY); return; }
    if (sessionStorage.getItem(KEY)) return;
    const landing = publicLanding(location.pathname);
    if (!landing) return;
    sessionStorage.setItem(KEY, JSON.stringify({ channel:classifySource(document.referrer, location.origin, location.search), landing }));
  } catch { /* Tracking must not block navigation. */ }
}
export function leadSource(): string {
  try {
    if (localStorage.getItem(CONSENT) !== 'accepted') return 'site';
    const value = JSON.parse(sessionStorage.getItem(KEY) || 'null');
    if (!value || !channels.includes(value.channel) || !publicLanding(value.landing)) return 'site';
    return `${value.channel} | ${value.landing}`.slice(0,160);
  } catch { return 'site'; }
}
