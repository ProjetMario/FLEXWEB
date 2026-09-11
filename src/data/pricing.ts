import publicQuotes from "../../apps/saas-platform/lib/automation/public-quotes.json";

// Public quote prices. Existing CRM billing records keep their accepted terms.
// New requests send an explicit version; legacy billing keeps its snapshot.
export type WebsiteOffer = {
  id: "essentielle" | "achat";
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
  monthlyCents: 0,
  href: `/demarrer/?service=site&offre=${offer.id}`,
}));
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
    question: "Combien coûte la création de mon site ?",
    answer: "Le site vitrine simple coûte 299 € HT et le site vitrine complet 990 € HT. Ce sont des prix de création payés une seule fois pour le périmètre de la formule. Votre devis précise les pages, les fonctionnalités, les modalités de paiement et les éventuels besoins supplémentaires avant votre engagement.",
  },
  {
    question: "Un abonnement mensuel est-il obligatoire ?",
    answer: "Non. Les options mensuelles sont facultatives : 49 € HT par mois pour la maintenance simple avec modifications, et 99 € HT par mois pour le CRM, l’automatisation et le référencement. Vous choisissez les options utiles dans votre devis ; elles ne sont pas ajoutées automatiquement.",
  },
  {
    question: "Que comprennent les options à 49 € et 99 € par mois ?",
    answer: "L’option à 49 € HT par mois couvre la maintenance simple et des modifications de contenu. L’option à 99 € HT par mois concerne le CRM, l’automatisation et le référencement. Le devis définit les interventions, les outils, les limites et les conditions de chaque option. Les licences, consommations et travaux sur mesure éventuels sont précisés avant accord.",
  },
  {
    question: "L’hébergement et le nom de domaine sont-ils compris ?",
    answer: "L’hébergement et le nom de domaine sont précisés séparément dans le devis, avec leurs éventuels coûts récurrents. Le domaine est enregistré à votre nom. Aucun coût supplémentaire ne doit être engagé sans votre accord.",
  },
  {
    question: "Combien coûte une automatisation IA ou une application ?",
    answer: "Les automatisations IA sur mesure et les applications web ou mobiles sont sur devis. Le budget dépend des tâches à automatiser, des fonctionnalités, des connexions à vos outils et du niveau d’accompagnement. L’option mensuelle à 99 € ne remplace pas le chiffrage d’un développement sur mesure.",
  },
  {
    question: "Quand dois-je payer et quand le projet est-il livré ?",
    answer: "La demande de devis est gratuite. Nous validons votre besoin, le périmètre, le calendrier et les conditions de paiement avec vous avant toute commande. Le délai dépend du projet et des contenus disponibles ; il est confirmé dans votre devis.",
  },
  {
    question: "Les prix comprennent-ils la TVA ?",
    answer: "Tous les prix affichés sont hors taxes (HT). Le devis présente les taxes applicables et le montant total à payer avant votre validation.",
  },
  {
    question: "Intervenez-vous en dehors de la Savoie et de la Haute-Savoie ?",
    answer: "Oui. Flex-Web accompagne les professionnels en Savoie, en Haute-Savoie et à distance dans toute la France pour les sites internet, les automatisations IA et les applications sur mesure.",
  },
];
