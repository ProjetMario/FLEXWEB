import { topics } from '../applications/content.mjs';
import { automationOffers, websiteOffers, pricingOptions } from '../pricing';

export const geoUpdatedOn = '2026-10-28';
export const money = (cents: number, lang: 'fr' | 'en' = 'fr') => new Intl.NumberFormat(lang === 'fr' ? 'fr-FR' : 'en-GB', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(cents / 100);
export const crmOffer = automationOffers[0];
export const crmSupport = pricingOptions.find(option => option.id === 'crm')!;
export const websiteSupport = pricingOptions.find(option => option.id !== 'crm')!;
export const offers = { websites: websiteOffers, crm: crmOffer, crmSupport, websiteSupport };

// Only published equivalents belong here. Country pages are not translations.
export const languagePairs = [
  { fr: '/', en: '/en/' },
  { fr: '/about/', en: '/en/about/' },
  { fr: '/creation-site-internet/', en: '/en/websites/' },
  { fr: '/creation-application-mobile/', en: '/en/applications/', de: '/de/anwendungen/', it: '/it/applicazioni/' },
  ...topics.map(topic => topic.paths),
  { fr: '/guides/preparer-projet-site-internet/', en: '/en/guides/website-project-brief/' },
  { fr: '/guides/preparer-projet-application-mobile/', en: '/en/guides/application-project-brief/' },
  { fr: '/automatisation-ia/', en: '/en/ai-automation/' },
  { fr: '/crm-automatisation-entreprise/', en: '/en/crm/' },
  { fr: '/pricing/', en: '/en/pricing/' },
  { fr: '/contact/', en: '/en/contact/' },
  { fr: '/journal/connecter-demandes-crm/', en: '/en/guides/website-enquiries-to-crm/' },
  { fr: '/ressources/automatisation/relance-devis/', en: '/en/guides/quote-follow-up/' },
  { fr: '/journal/assistant-ia-interne-entreprise/', en: '/en/guides/internal-ai-assistant/' },
] as const;
export const languagePairFor = (path: string) => languagePairs.find(pair => Object.values(pair).includes(path));

export const englishNavigation = { links: [
  { label: 'Websites', href: '/en/websites/' },
  { label: 'Applications', href: '/en/applications/' },
  { label: 'CRM', href: '/en/crm/' },
  { label: 'AI automation', href: '/en/ai-automation/' },
  { label: 'Pricing', href: '/en/pricing/' },
  { label: 'About', href: '/en/about/' },
  { label: 'Contact', href: '/en/contact/' },
] };
export type GeoLink = { label: string; href: string };
export type GeoSection = { title: string; paragraphs?: string[]; items?: string[]; links?: GeoLink[]; table?: { caption: string; columns: string[]; rows: string[][] } };
export type GeoPage = {
  path: string; lang: 'fr' | 'en'; service?: 'site' | 'application' | 'automation'; title: string; description: string; answer: string;
  kind: 'service' | 'article' | 'page' | 'about' | 'contact';
  sections: GeoSection[]; faq: { question: string; answer: string }[];
  related: GeoLink[]; cta?: GeoLink;
};
