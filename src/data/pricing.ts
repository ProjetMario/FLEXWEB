import offerCatalog from "../../apps/saas-platform/lib/automation/offers.json";

export type PricingPlan = {
  name: string;
  price: string;
  priceNote: string;
  badge: string;
  description: string;
  features: string[];
  cta: string;
  href: string;
  featured?: boolean;
  maintenance?: {
    price: string;
    features: string[];
  };
};

export type ComparisonRow = {
  label: string;
  essential: boolean | string;
  professional: boolean | string;
  ownership: boolean | string;
};

export type PricingFaqItem = {
  question: string;
  answer: string;
};

export const pricingPlans: PricingPlan[] = [
  ...["croissance", "essentielle", "professionnelle", "achat"].map(id => {
    const offer = offerCatalog.find(item => item.id === id)!;
    return {
      name: offer.name,
      price: offer.monthlyCents ? `${offer.monthlyCents / 100}€` : `À partir de ${offer.setupCents / 100}€`,
      priceNote: offer.monthlyCents ? `HT/mois · + ${offer.setupCents / 100}€ HT de création` : "HT · Paiement unique",
      badge: id === "croissance" ? "Avec suivi" : id === "achat" ? "Vous êtes propriétaire" : "Site vitrine",
      description: id === "croissance" ? "Un site adapté à votre métier, un formulaire de devis et un suivi régulier de votre activité." : "Une formule au périmètre clair, validée avec vous avant paiement.",
      features: offer.features,
      cta: "Préparer mon projet",
      href: `/demarrer/?offre=${offer.id}`,
      featured: id === "croissance",
      ...(id === "achat" ? { maintenance: { price: "49€ HT/mois", features: ["Hébergement", "Sauvegardes", "Sécurité", "Support", "Mises à jour"] } } : {}),
    };
  }),
  {
    name: "Applications", price: "Sur devis", priceNote: "Web & mobile sur mesure", badge: "Sur mesure",
    description: "Votre application fait l’objet d’un cadrage et d’un devis spécifiques.",
    features: ["Applications web et mobiles", "API et intégrations", "Interface d’administration", "Maintenance sur devis"],
    cta: "Parler de mon application", href: "/creation-application-mobile/#contact",
  },
];

export const comparisonRows: ComparisonRow[] = [
  { label: "Création du site", essential: true, professional: true, ownership: true },
  { label: "Responsive", essential: true, professional: true, ownership: true },
  { label: "SEO", essential: "Base", professional: "Optimisation initiale", ownership: "Base" },
  { label: "Maintenance", essential: true, professional: true, ownership: "Optionnelle" },
  { label: "Support", essential: "Email", professional: "Prioritaire", ownership: "Optionnel" },
  { label: "Nom de domaine", essential: "Offert 1 an", professional: "Offert 1 an", ownership: "À votre nom" },
  { label: "Hébergement", essential: true, professional: true, ownership: "Optionnel" },
  { label: "Tableau de bord", essential: false, professional: true, ownership: false },
  { label: "Modifications incluses", essential: false, professional: "30 min/mois", ownership: false },
  { label: "Propriété du site", essential: false, professional: false, ownership: true },
  { label: "Paiement mensuel", essential: true, professional: true, ownership: false },
  { label: "Paiement unique", essential: false, professional: false, ownership: true },
];

export const buyoutTiers = [
  { label: "Moins de 12 mois", price: "790€" },
  { label: "12 à 24 mois", price: "590€" },
  { label: "24 à 36 mois", price: "390€" },
  { label: "Après 36 mois", price: "190€" },
];

export const pricingFaq: PricingFaqItem[] = [
  { question: "Puis-je acheter mon site directement ?", answer: "Oui. L'offre Achat définitif vous permet de devenir propriétaire de votre site dès sa livraison, avec le code source remis." },
  { question: "Puis-je commencer avec un abonnement puis acheter mon site plus tard ?", answer: "Oui. Vous pouvez démarrer avec une formule mensuelle puis racheter votre site à tout moment selon le tarif dégressif." },
  { question: "Que se passe-t-il si je résilie mon abonnement ?", answer: "Vous pouvez soit arrêter votre abonnement, soit racheter votre site selon le tarif de rachat correspondant à la durée de votre abonnement." },
  { question: "Suis-je propriétaire de mon contenu ?", answer: "Oui. Vos textes, images, logo et documents vous appartiennent toujours, quelle que soit l'offre choisie." },
  { question: "Qui possède le nom de domaine ?", answer: "Le nom de domaine est enregistré à votre nom. Vous en restez propriétaire." },
  { question: "Puis-je changer d'offre ?", answer: "Oui, vous pouvez changer d'offre à tout moment. Nous vous accompagnons pour choisir la solution la plus adaptée." },
];
