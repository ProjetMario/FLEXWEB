import offerCatalog from "../../apps/saas-platform/lib/automation/offers.json";

const euros = (cents: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(cents / 100);

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

const descriptions: Record<string, string> = {
  essentielle: "Pour présenter votre activité avec un site simple.",
  professionnelle:
    "Pour modifier régulièrement vos contenus, avec du temps inclus chaque mois.",
  croissance:
    "Pour recueillir des demandes de devis et faire le point sur leur suivi.",
  achat: "Pour devenir propriétaire de votre site dès sa livraison.",
};
const plainFeatures: Record<string, string> = {
  "SEO de base": "Réglages de base pour les moteurs de recherche",
  "Optimisation SEO initiale et support prioritaire":
    "Référencement optimisé au lancement et support prioritaire",
  "Suivi des demandes et bilan trimestriel":
    "Suivi des demandes reçues et bilan tous les 3 mois",
};

// Every displayed amount, including the initial total, comes from the same
// catalog as checkout. This page changes the explanation, never the price.
export const pricingPlans: PricingPlan[] = [
  "essentielle",
  "professionnelle",
  "croissance",
  "achat",
].map((id) => {
  const offer = offerCatalog.find((item) => item.id === id)!;
  return {
    id: offer.id,
    name: offer.name,
    description: descriptions[id],
    firstPayment: euros(offer.setupCents + offer.monthlyCents),
    setupPrice: euros(offer.setupCents),
    monthlyPrice: offer.monthlyCents ? euros(offer.monthlyCents) : null,
    features: offer.features.map(
      (feature) => plainFeatures[feature] || feature,
    ),
    href: `/demarrer/?offre=${offer.id}`,
    featured: id === "croissance",
  };
});
export const subscriptionPlans = pricingPlans.filter(
  (plan) => plan.monthlyPrice,
);
export const ownershipPlan = pricingPlans.find((plan) => plan.id === "achat")!;
// The optional hosting/maintenance package uses the existing published amount.
export const ownershipMaintenancePrice = euros(4900);

export type ComparisonRow = {
  label: string;
  essentielle: string;
  professionnelle: string;
  croissance: string;
  achat: string;
};
export const comparisonPlans = pricingPlans.map(({ id, name }) => ({
  id,
  name,
}));
export const comparisonRows: ComparisonRow[] = [
  {
    label: "Hébergement et maintenance",
    essentielle: "Inclus",
    professionnelle: "Inclus",
    croissance: "Inclus",
    achat: "En option",
  },
  {
    label: "Modifications de vos contenus",
    essentielle: "Sur devis",
    professionnelle: "30 min / mois",
    croissance: "30 min / mois",
    achat: "Sur devis",
  },
  {
    label: "Blog et galerie photos",
    essentielle: "Non inclus",
    professionnelle: "Inclus",
    croissance: "Selon devis",
    achat: "Selon devis",
  },
  {
    label: "Formulaire de devis qualifiant",
    essentielle: "Non inclus",
    professionnelle: "Non inclus",
    croissance: "Inclus",
    achat: "Selon devis",
  },
  {
    label: "Suivi des demandes et bilan tous les 3 mois",
    essentielle: "Non inclus",
    professionnelle: "Non inclus",
    croissance: "Inclus",
    achat: "Non inclus",
  },
  {
    label: "Propriété du site et remise du code",
    essentielle: "Rachat possible",
    professionnelle: "Rachat possible",
    croissance: "Rachat possible",
    achat: "Inclus",
  },
];

export const buyoutTiers = [
  { label: "Moins de 12 mois", price: "790 € HT" },
  { label: "12 à 24 mois", price: "590 € HT" },
  { label: "24 à 36 mois", price: "390 € HT" },
  { label: "Après 36 mois", price: "190 € HT" },
];
export type PricingFaqItem = { question: string; answer: string };
const essential = subscriptionPlans[0];
export const pricingFaq: PricingFaqItem[] = [
  {
    question: "Combien vais-je payer au départ ?",
    answer: `Pour un abonnement, le premier paiement comprend la création du site et le premier mois. Exemple avec Essentielle : ${essential.setupPrice} HT de création + ${essential.monthlyPrice} HT pour le premier mois = ${essential.firstPayment} HT au départ. Ensuite, vous payez ${essential.monthlyPrice} HT par mois.`,
  },
  {
    question: "Les frais de création reviennent-ils chaque mois ?",
    answer:
      "La création est payée une seule fois au démarrage. Ensuite, seule la mensualité de votre formule est facturée, avec les éventuelles options que vous avez acceptées.",
  },
  {
    question: "Pourquoi un abonnement mensuel ?",
    answer:
      "L’abonnement comprend l’hébergement qui permet de garder votre site en ligne, ainsi que sa maintenance technique. Selon la formule, il comprend aussi du temps pour modifier vos contenus et le suivi des demandes reçues.",
  },
  {
    question: "Quelle différence entre Professionnelle et Croissance ?",
    answer:
      "Professionnelle prévoit un blog, une galerie et 30 minutes de modifications par mois. Croissance comprend un formulaire de devis qualifiant, le suivi des demandes reçues et un bilan tous les 3 mois, ainsi que 30 minutes de modifications par mois. Ces minutes ne se reportent pas au mois suivant.",
  },
  {
    question: "Les montants affichés comprennent-ils la TVA ?",
    answer:
      "Tous les prix sont indiqués hors taxes (HT). La TVA n’est pas comprise dans les montants affichés ici. Les taxes applicables et le total à payer sont indiqués avant la validation du paiement.",
  },
  {
    question: "Quand vais-je payer ?",
    answer:
      "Vous préparez d’abord votre demande en ligne. Nous vérifions votre besoin et vous présentons une proposition. Vous payez après l’avoir acceptée ; l’abonnement commence à la commande.",
  },
  {
    question: "Comment acheter mon site sans abonnement ?",
    answer: `Choisissez Achat définitif : ${ownershipPlan.firstPayment} HT pour le site vitrine prévu dans cette offre, payable une seule fois. Vous recevez le code du site et une formation. L’hébergement et la maintenance se choisissent séparément, avec une option FLEX-WEB à ${ownershipMaintenancePrice} HT par mois.`,
  },
  {
    question: "Puis-je arrêter un abonnement ou racheter mon site ?",
    answer:
      "Sauf engagement particulier indiqué dans votre devis, la résiliation se fait par écrit avec un préavis de 30 jours. Vous pouvez aussi racheter une version autonome du site selon le barème ci-dessous. Vos textes, images et documents restent votre propriété. Les modalités complètes figurent dans les CGV.",
  },
  {
    question: "Qui possède le nom de domaine ?",
    answer:
      "Le nom de domaine est enregistré à votre nom. Vous en restez propriétaire.",
  },
];
