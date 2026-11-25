const frenchCountries = new Set('FR GP MQ GF RE YT BL MF PM WF PF NC TF CH BE'.split(' '));
const regions = new Intl.DisplayNames('en',{type:'region',fallback:'none'});
const unlocated = new Set(['XX','ZZ','EU','UN','XK-UNKNOWN']);
export function countryLanguage(value) {
  const code = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return /^[A-Z]{2}$/.test(code) && regions.of(code) && !unlocated.has(code) && !frenchCountries.has(code) ? 'en' : 'fr';
}
export function eligible(path) {
  return path.startsWith('/') && !path.startsWith('//') && !/\.(?!html?$)[a-z0-9]+$/i.test(path) &&
    !/^\/(?:api|admin|private|crm|projet|portail|espace-client|espace-projet|sites|maquettes|\.netlify|\.well-known|_astro|_next|images|sitemaps|studio-redesign|contact-assets|language-assets)(?:\/|$)/.test(path) &&
    !/^\/(?:404|500)(?:\.html|\/|$)/.test(path);
}
