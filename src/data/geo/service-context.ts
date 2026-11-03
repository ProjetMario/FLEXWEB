import { business } from '../business';

export const serviceContext = {
  fr: {
    heading: 'Un projet à distance, un périmètre clair',
    description: 'Flex-Web, marque de Fleximmo à Voglans en Savoie, accompagne les entreprises et les particuliers en France et en Suisse. Les projets des autres pays francophones sont étudiés à distance selon les besoins et les conditions du devis. Les échanges se font en français ou en anglais ; aucun bureau à l’étranger n’est revendiqué.',
    process: 'Décrivez votre besoin et les outils ou contenus disponibles. Le devis précise les livrables, le prix, les éventuels coûts tiers, le calendrier et les validations à votre charge avant toute commande.',
  },
  en: {
    heading: 'Remote delivery with a clear scope',
    description: 'Flex-Web, a brand of Fleximmo based in Voglans, Savoie, works with businesses and individuals in France and Switzerland. Projects from other French-speaking countries are assessed for remote delivery according to the needs and quote conditions. Discussions are in French or English; no office abroad is claimed.',
    process: 'Describe your needs and the tools or content available. The quote defines deliverables, price, any third-party costs, schedule and your approval responsibilities before an order.',
  },
};

export const interiorServiceRoutes: Record<string, 'site' | 'application' | 'automation' | 'unknown'> = {
  '/creation-site-internet/': 'site', '/creation-application-mobile/': 'application',
  '/automatisation-ia/': 'automation', '/crm-automatisation-entreprise/': 'automation',
  '/pricing/': 'unknown', '/en/websites/': 'site', '/en/applications/': 'application',
  '/en/ai-automation/': 'automation', '/en/crm/': 'automation', '/en/pricing/': 'unknown',
};

export const projectEmail = (subject: string) => `mailto:${business.email}?subject=${encodeURIComponent(subject)}`;
