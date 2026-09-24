import publicQuotes from "../../apps/saas-platform/lib/automation/public-quotes.json";

// Public quote prices. Existing CRM billing records keep their accepted terms.
// New requests send an explicit version; legacy billing keeps its snapshot.
export type WebsiteOffer = {
  id: "essentielle" | "visibilite";
  tier: "simple" | "visibility";
  service: "site";
  name: string;
  description: string;
  setupCents: number;
  monthlyCents: 0;
  features: string[];
  href: string;
};

export const publicQuoteVersion = publicQuotes.version;
export const websiteOffers: WebsiteOffer[] = publicQuotes.websiteOffers.map((offer) => ({
  ...offer,
  id: offer.id as WebsiteOffer["id"],
  tier: offer.tier as WebsiteOffer["tier"],
  service: "site",
  monthlyCents: 0,
  href: `/demarrer/?service=site&offre=${offer.id}`,
}));
export const automationOffers = publicQuotes.automationOffers.map(offer => ({
  ...offer,
  href: `/demarrer/?service=automation&offre=${offer.id}`,
}));
export const projectOffers = [...websiteOffers, ...automationOffers];
export const pricingOptions = publicQuotes.options;

// Keep the two presentational component types compatible without publishing
// the former subscription catalog or buyout prices.
export type PricingPlan = {
  id: string;
  name: string;
  description: string;
  firstPayment: string;
  setupPrice: string;
  monthlyPrice: string | null;
  features: string[];
  href: string;
  featured: boolean;
};
export type ComparisonRow = { label: string; [plan: string]: string };
export type PricingFaqItem = { question: string; answer: string };

export const pricingFaq: PricingFaqItem[] = [
  {
    question: "Que comprennent les trois offres ?",
    answer: "299 € TTC : un site vitrine jusqu’à 5 pages. 590 € TTC : un site de 5 pages et plus avec référencement naturel (SEO) et optimisation pour la recherche par IA (GEO), notamment sur Google et Bing. 990 € TTC : la mise en place d’un CRM pour les contacts, clients, devis et factures, avec automatisation des tâches répétitives. Chaque forfait est payé une seule fois ; le devis fixe les pages, les outils, les automatisations et le périmètre exact.",
  },
  {
    question: "L’offre à 590 € garantit-elle une position sur Google ou dans les réponses IA ?",
    answer: "Elle comprend le travail sur la structure, les contenus, les données structurées et la préparation à l’exploration des moteurs, avec soumission à Google et Bing. Ces optimisations servent aussi les autres moteurs compatibles et la recherche par IA. Chaque moteur décide de l’indexation, du classement et des citations : aucune position ni présence dans une réponse IA n’est garantie. Le nombre de pages, à partir de 5, est fixé au devis.",
  },
  {
    question: "Un abonnement mensuel est-il obligatoire ?",
    answer: "Non. Les options mensuelles sont facultatives : 49 € TTC par mois pour la maintenance, les modifications et le suivi du référencement ; 99 € TTC par mois pour le CRM, l’automatisation, le référencement et le suivi des dernières technologies. Vous choisissez les options utiles dans votre devis ; elles ne sont pas ajoutées automatiquement.",
  },
  {
    question: "Que comprennent les options à 49 € et 99 € par mois ?",
    answer: "L’option à 49 € TTC par mois couvre la maintenance simple, les modifications de contenu et le suivi du référencement. L’option à 99 € TTC par mois concerne le CRM, l’automatisation, le référencement et le suivi des dernières technologies, avec veille et recommandations adaptées à votre activité. Le devis définit les interventions, les outils, les limites et les conditions de chaque option. Les licences, consommations et travaux sur mesure éventuels sont précisés avant accord.",
  },
  {
    question: "L’hébergement et le nom de domaine sont-ils compris ?",
    answer: "L’hébergement et le nom de domaine sont précisés séparément dans le devis, avec leurs éventuels coûts récurrents. Le domaine est enregistré à votre nom. Aucun coût supplémentaire ne doit être engagé sans votre accord.",
  },
  {
    question: "Quelle différence entre le forfait CRM à 990 € et l’option à 99 €/mois ?",
    answer: "Le forfait à 990 € TTC finance la mise en place du CRM et les automatisations définies au devis. L’option facultative à 99 € TTC/mois sert au suivi du CRM, des automatisations, du référencement et des dernières technologies, avec veille et recommandations. Les outils, interventions, licences et limites sont précisés avant accord. Les automatisations IA avancées et les applications web ou mobiles font l’objet d’un devis sur mesure.",
  },
  {
    question: "Quand dois-je payer et quand le projet est-il livré ?",
    answer: "La demande de devis est gratuite. Nous validons votre besoin, le périmètre, le calendrier et les conditions de paiement avec vous avant toute commande. Le délai dépend du projet et des contenus disponibles ; il est confirmé dans votre devis.",
  },
  {
    question: "Les prix comprennent-ils la TVA ?",
    answer: "Les prix des offres publiques sont toutes taxes comprises (TTC). La TVA applicable est incluse dans les montants affichés. Le devis détaille le total de votre projet avant validation.",
  },
  {
    question: "Intervenez-vous en dehors de la Savoie et de la Haute-Savoie ?",
    answer: "Oui. Flex-Web accompagne les professionnels en Savoie, en Haute-Savoie et à distance dans toute la France pour les sites internet, les automatisations IA et les applications sur mesure.",
  },
];
