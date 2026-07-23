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
  {
    name: "Essentielle",
    price: "49€",
    priceNote: "/mois · + 299€ de mise en service",
    badge: "Le plus accessible",
    description: "La solution idéale pour lancer votre présence en ligne rapidement.",
    features: [
      "Création du site",
      "Jusqu'à 5 pages",
      "Design personnalisé",
      "Responsive",
      "Hébergement inclus",
      "Nom de domaine offert la première année",
      "Certificat SSL",
      "Sauvegardes automatiques",
      "Maintenance",
      "Mises à jour de sécurité",
      "Formulaire de contact",
      "SEO de base",
      "Support par email",
    ],
    cta: "Commencer",
    href: "/#contact",
  },
  {
    name: "Professionnelle",
    price: "99€",
    priceNote: "/mois · + 299€ de mise en service",
    badge: "⭐ Recommandé",
    description: "Notre formule la plus complète pour développer votre activité.",
    features: [
      "Tout de l'offre Essentielle",
      "Modifications de contenu incluses",
      "Optimisation SEO avancée",
      "Galerie photos",
      "Blog",
      "Tableau de bord client",
      "Modification des textes",
      "Modification des images",
      "Gestion des réalisations",
      "Support prioritaire",
      "Assistance",
    ],
    cta: "Choisir cette offre",
    href: "/#contact",
    featured: true,
  },
  {
    name: "Achat définitif",
    price: "À partir de 990€",
    priceNote: "Paiement unique",
    badge: "Vous êtes propriétaire",
    description: "Vous achetez votre site une seule fois.",
    features: [
      "Création complète",
      "Jusqu'à 5 pages",
      "Design personnalisé",
      "Responsive",
      "SEO de base",
      "Livraison clé en main",
      "Formation",
      "Code source remis",
      "Vous êtes propriétaire du site",
    ],
    cta: "Demander un devis",
    href: "/#contact",
    maintenance: {
      price: "49€/mois",
      features: ["Hébergement", "Sauvegardes", "Sécurité", "Support", "Mises à jour"],
    },
  },
];

export const comparisonRows: ComparisonRow[] = [
  { label: "Création du site", essential: true, professional: true, ownership: true },
  { label: "Responsive", essential: true, professional: true, ownership: true },
  { label: "SEO", essential: "Base", professional: "Avancé", ownership: "Base" },
  { label: "Maintenance", essential: true, professional: true, ownership: "Optionnelle" },
  { label: "Support", essential: "Email", professional: "Prioritaire", ownership: "Optionnel" },
  { label: "Nom de domaine", essential: "Offert 1 an", professional: "Offert 1 an", ownership: "À votre nom" },
  { label: "Hébergement", essential: true, professional: true, ownership: "Optionnel" },
  { label: "Tableau de bord", essential: false, professional: true, ownership: false },
  { label: "Modifications incluses", essential: false, professional: true, ownership: false },
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
