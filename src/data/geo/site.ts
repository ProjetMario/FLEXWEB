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
  { fr: '/automatisation-ia/', en: '/en/ai-automation/' },
  { fr: '/crm-automatisation-entreprise/', en: '/en/crm/' },
  { fr: '/pricing/', en: '/en/pricing/' },
  { fr: '/contact/', en: '/en/contact/' },
  { fr: '/journal/connecter-demandes-crm/', en: '/en/guides/website-enquiries-to-crm/' },
  { fr: '/ressources/automatisation/relance-devis/', en: '/en/guides/quote-follow-up/' },
  { fr: '/journal/assistant-ia-interne-entreprise/', en: '/en/guides/internal-ai-assistant/' },
] as const;
export const languagePairFor = (path: string) => languagePairs.find(pair => pair.fr === path || pair.en === path);

export const englishNavigation = { links: [
  { label: 'CRM', href: '/en/crm/' },
  { label: 'AI automation', href: '/en/ai-automation/' },
  { label: 'Pricing', href: '/en/pricing/' },
  { label: 'About', href: '/en/about/' },
  { label: 'Contact', href: '/en/contact/' },
] };
export type GeoLink = { label: string; href: string };
export type GeoSection = { title: string; paragraphs?: string[]; items?: string[]; links?: GeoLink[]; table?: { caption: string; columns: string[]; rows: string[][] } };
export type GeoPage = {
  path: string; lang: 'fr' | 'en'; title: string; description: string; answer: string;
  kind: 'service' | 'article' | 'page' | 'about' | 'contact';
  sections: GeoSection[]; faq: { question: string; answer: string }[];
  related: GeoLink[]; cta?: GeoLink;
};
