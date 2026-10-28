const KEY = 'flexweb-acquisition-v1';
const CONSENT = 'flex-web-cookie-consent';
const channels = ['Google naturel', 'Autre moteur', 'Assistant IA', 'Lien externe', 'Accès direct', 'Campagne'] as const;
export const aiSources = ['chatgpt', 'claude', 'gemini', 'grok', 'copilot', 'perplexity', 'unknown'] as const;
export type AISource = typeof aiSources[number];
type Acquisition = { channel: typeof channels[number]; landing: string; aiSource: AISource; language?: 'fr' | 'en' | 'de' | 'it' };
const sourceAliases: Record<string, AISource> = {
  chatgpt: 'chatgpt', 'chatgpt.com': 'chatgpt', 'chat.openai.com': 'chatgpt',
  claude: 'claude', 'claude.ai': 'claude',
  gemini: 'gemini', 'gemini.google.com': 'gemini',
  grok: 'grok', 'grok.com': 'grok',
  copilot: 'copilot', 'copilot.microsoft.com': 'copilot',
  perplexity: 'perplexity', 'perplexity.ai': 'perplexity',
};
const campaign = (query: URLSearchParams) => query.has('gclid') || query.has('msclkid') || ['email', 'sms', 'cpc', 'paid', 'paid_social', 'social'].includes((query.get('utm_medium') || '').toLowerCase());

// Only public editorial routes may be recorded; never query strings or client URLs.
export function publicLanding(path: string): string | null {
  if (typeof path !== 'string' || path.length >= 120 || /[?#%\\\s]/.test(path)) return null;
  if (/^\/applications\/(?:ios|android|windows|macos|entreprises|particuliers|prix|web-mobile-ou-logiciel)\/$/.test(path) || /^\/en\/applications\/(?:ios|android|windows|macos|businesses|individuals|cost|web-mobile-or-desktop)\/$/.test(path) || /^\/de\/anwendungen\/(?:(?:ios|android|windows|macos|unternehmen|privatpersonen|kosten|web-mobil-oder-desktop)\/)?$/.test(path) || /^\/it\/applicazioni\/(?:(?:ios|android|windows|macos|aziende|privati|costi|web-mobile-o-desktop)\/)?$/.test(path)) return path;
  if (path === '/territoires/') return path;
  if (/^\/territoires\/(?:sites|automatisation)\/(?:page\/(?:[2-9]|[1-9][0-9]+)\/|[a-z0-9]+(?:-[a-z0-9]+)*-(?:[0-9]{5}|2[ab][0-9]{3})\/)?$/.test(path)) return path;
  if (/^\/territoires\/departements\/(?:0[1-9]|1[0-9]|2[1-9]|[3-8][0-9]|9[0-5]|2[ab]|97[1-8]|98[6-8])\/$/.test(path)) return path;
  if (path === '/' || path === '/crm-automatisation-entreprise/' || /^\/guides\/(?:preparer-projet-site-internet|preparer-projet-application-mobile)\/$/.test(path)) return path;
  if (/^\/en\/(?:about\/|crm\/|websites\/|applications\/|ai-automation\/|pricing\/|contact\/|guides\/(?:website-enquiries-to-crm|quote-follow-up|internal-ai-assistant|website-project-brief|application-project-brief)\/)?$/.test(path)) return path;
  if (/^\/ressources(?:\/(?:sites|automatisation)(?:\/(?:[a-z0-9-]+|page\/[1-9][0-9]*))?)?\/$/.test(path)) return path;
  return /^\/(?:creation-site-internet(?:-[a-z-]+)?|creation-application-mobile(?:-[a-z-]+)?|automatisation-ia(?:-[a-z-]+)?|pricing|contact|about|journal(?:\/[a-z-]+)?|realisations(?:\/[a-z0-9-]+)?|specialites\/(?:artisans|immobilier|entreprises-services)|outils\/(?:calculateur-temps-economise|demo-crm))\/$/.test(path) ? path : null;
}

// Only an officially rendered territorial page can set this marker. Store its
// country/code/audience, never arbitrary slug text that could contain a name.
const territoryPattern = /^territoire:(FR:(?:[0-9]{5}|2[AB][0-9]{3})|CH:[0-9]{1,4}):(particuliers|entreprises)$/;
export function territoryLanding(path: string, marker: string | null): string | null {
  if(typeof path !== 'string' || path.length >= 160 || /[?#%\\\s]/.test(path) || typeof marker !== 'string') return null;
  const translated=path.startsWith('/projets-sites/suisse/');
  const normalized=path.replace(/^\/projets-sites\/suisse\/(fr|de|it)\//,'/projets-sites/');
  const match=normalized.match(/^\/projets-sites\/(particuliers|entreprises)\/[a-z0-9]+(?:-[a-z0-9]+)*-(fr|ch)-([a-z0-9]+)\/$/);
  if(!match)return null;
  const [,audience,country,code]=match;
  if(translated&&country!=='ch')return null;
  if(marker!==`${audience}:${country.toUpperCase()}:${code.toUpperCase()}`)return null;
  const value=`territoire:${country.toUpperCase()}:${code.toUpperCase()}:${audience}`;
  return territoryPattern.test(value)?value:null;
}
const validTerritory = (value: unknown): value is string => typeof value === 'string' && territoryPattern.test(value);

/** An attribution hint, not proof of a citation. Ordinary Google/Bing visits stay unknown. */
export function identifyAISource(referrer: string, origin: string, search: string): AISource {
  const query = new URLSearchParams(search);
  if (campaign(query)) return 'unknown';
  const tag = (query.get('utm_source') || '').toLowerCase();
  const tagged = Object.hasOwn(sourceAliases, tag) ? sourceAliases[tag] : undefined;
  if (tagged) return tagged;
  try {
    const url = new URL(referrer);
    if (!['http:', 'https:'].includes(url.protocol) || url.origin === origin) return 'unknown';
    // Exact allowlist: chatgpt.com.example.org is not ChatGPT.
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    return Object.hasOwn(sourceAliases, host) ? sourceAliases[host] : 'unknown';
  } catch { return 'unknown'; }
}
export function classifySource(referrer: string, origin: string, search: string): Acquisition['channel'] {
  if (campaign(new URLSearchParams(search))) return 'Campagne';
  if (identifyAISource(referrer, origin, search) !== 'unknown') return 'Assistant IA';
  try {
    const url = new URL(referrer);
    if (url.origin === origin) return 'Accès direct';
    const host = url.hostname.toLowerCase();
    if (/^(?:www\.)?google\.(?:com|fr|co\.uk|de|ch|be|ca)$/.test(host)) return 'Google naturel';
    if (/^(?:www\.)?(?:bing\.com|duckduckgo\.com|search\.yahoo\.com)$/.test(host)) return 'Autre moteur';
    return 'Lien externe';
  } catch { return 'Accès direct'; }
}
export function readAcquisition(): Acquisition | null {
  try {
    if (localStorage.getItem(CONSENT) !== 'accepted') { sessionStorage.removeItem(KEY); return null; }
    const value = JSON.parse(sessionStorage.getItem(KEY) || 'null');
    if (!value || !channels.includes(value.channel) || (!publicLanding(value.landing) && !validTerritory(value.landing))) return null;
    const aiSource = value.channel === 'Assistant IA' && aiSources.includes(value.aiSource) ? value.aiSource : 'unknown';
    const language = ['fr','en','de','it'].includes(value.language) ? value.language : undefined;
    return { channel: value.channel, landing: value.landing, aiSource, ...(language ? {language} : {}) };
  } catch { return null; }
}
export function captureAcquisition(): void {
  try {
    if (localStorage.getItem(CONSENT) !== 'accepted') { sessionStorage.removeItem(KEY); return; }
    if (readAcquisition()) return;
    const marker = typeof document.querySelector === 'function' ? document.querySelector('meta[name="flexweb-territory"]')?.getAttribute('content') || null : null;
    const territory = territoryLanding(location.pathname, marker);
    const landing = publicLanding(location.pathname) || territory;
    if (!landing) return;
    const documentLanguage = document.documentElement?.lang;
    const language = (territory || landing) && ['fr','en','de','it'].includes(documentLanguage) ? documentLanguage : undefined;
    sessionStorage.setItem(KEY, JSON.stringify({
      channel: classifySource(document.referrer, location.origin, location.search),
      landing,
      ...(language ? {language} : {}),
      ...(identifyAISource(document.referrer, location.origin, location.search) !== 'unknown' ? { aiSource: identifyAISource(document.referrer, location.origin, location.search) } : {}),
    }));
  } catch { /* Tracking must not block navigation. */ }
}
export function acquisitionEventFields() {
  const value = readAcquisition();
  return { ai_source: value?.aiSource || 'unknown', landing_language: value ? (value.language || (value.landing.startsWith('/en/') ? 'en' : 'fr')) : 'unknown' };
}
export function leadSource(): string {
  const value = readAcquisition();
  if (!value) return 'site';
  const detail = value.aiSource === 'unknown' ? '' : ` (${value.aiSource})`;
  return `${value.channel}${detail} | ${value.landing}`.slice(0, 160);
}
