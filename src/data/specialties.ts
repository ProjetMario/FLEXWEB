import { automationOffers, pricingOptions, websiteOffers } from "./pricing";

export type SpecialtySlug = "artisans" | "immobilier" | "entreprises-services";

const siteOffer = websiteOffers[1];
const automationOffer = automationOffers[0];
const maintenance = pricingOptions.find((option) => option.id === "maintenance");
const crm = pricingOptions.find((option) => option.id === "crm");

export const specialties = [
  {
    slug: "artisans",
    title: "Sites internet, devis et automatisation pour artisans",
    eyebrow: "Artisans",
    description:
      "Flex-Web aide les artisans à présenter leurs prestations, recevoir des demandes qualifiées, suivre les devis et automatiser les tâches répétitives sans perdre la main.",
    audience: "Artisans du bâtiment, dépannage, rénovation, services à domicile et métiers techniques.",
    problems: [
      "Des appels ou messages incomplets qui obligent à rappeler plusieurs fois.",
      "Des photos et réalisations dispersées, alors qu’elles rassurent les clients.",
      "Des devis, relances et informations client suivis dans plusieurs endroits.",
    ],
    demo: [
      "Le client choisit une prestation, indique la commune et décrit son besoin.",
      "La demande arrive dans le CRM avec le statut, les coordonnées et la prochaine action.",
      "Une relance ou une réponse préparée peut être validée avant envoi.",
    ],
    recommended: [
      { name: websiteOffers[0].name, price: websiteOffers[0].setupCents, href: websiteOffers[0].href, note: "présence claire jusqu’à 5 pages" },
      { name: automationOffer.name, price: automationOffer.setupCents, href: automationOffer.href, note: "suivi des demandes, devis et assistant IA interne" },
    ],
    links: [
      { label: "Étude de cas Serrurier 73", href: "/realisations/serrurier73/" },
      { label: "Guide artisan en Haute-Savoie", href: "/journal/site-internet-artisan-haute-savoie/" },
      { label: "Calculer le temps gagné", href: "/outils/calculateur-temps-economise/" },
    ],
    faq: [
      ["Un artisan doit-il commencer par un site ou un CRM ?", "Un site suffit si l’objectif prioritaire est de présenter les prestations et recevoir des demandes. Le CRM devient utile quand plusieurs demandes, devis ou relances doivent être suivis chaque semaine."],
      ["Peut-on automatiser les réponses aux clients ?", "Oui, mais les réponses importantes doivent rester validées par l’entreprise. Le devis précise ce qui peut être préparé automatiquement et ce qui doit rester manuel."],
      ["Les résultats commerciaux sont-ils garantis ?", "Non. Flex-Web travaille la clarté du parcours, la visibilité et le suivi des demandes ; les demandes reçues dépendent aussi du marché, de l’offre et de la réputation de l’entreprise."],
    ],
  },
  {
    slug: "immobilier",
    title: "Sites, CRM et automatisations pour l’immobilier",
    eyebrow: "Immobilier",
    description:
      "Flex-Web structure les parcours immobiliers : visibilité locale, formulaires vendeurs et acquéreurs, suivi CRM et automatisation des demandes entrantes.",
    audience: "Agences, mandataires, chasseurs immobiliers, conciergeries et acteurs locaux de l’immobilier.",
    problems: [
      "Des visiteurs qui cherchent un bien, une estimation ou un contact mais n’ont pas le même besoin.",
      "Des demandes entrantes à qualifier avant de rappeler.",
      "Des annonces, contenus locaux et relances qui demandent une organisation régulière.",
    ],
    demo: [
      "Le visiteur choisit achat, vente, estimation ou investissement.",
      "Le CRM distingue le type de projet, la commune et les informations manquantes.",
      "Les relances et prochaines actions sont préparées selon le statut du dossier.",
    ],
    recommended: [
      { name: siteOffer.name, price: siteOffer.setupCents, href: siteOffer.href, note: "pages locales, SEO et GEO" },
      { name: automationOffer.name, price: automationOffer.setupCents, href: automationOffer.href, note: "demandes, contacts, devis et assistant IA interne" },
    ],
    links: [
      { label: "Étude de cas 2 Savoie Immo", href: "/realisations/2savoie-immo/" },
      { label: "Relier les demandes à un CRM", href: "/journal/connecter-demandes-crm/" },
      { label: "Voir la démonstration CRM", href: "/outils/demo-crm/" },
    ],
    faq: [
      ["Peut-on séparer les demandes vendeurs et acquéreurs ?", "Oui. Les formulaires, statuts et prochaines actions peuvent être différents pour éviter de traiter toutes les demandes comme un simple message de contact."],
      ["Le site peut-il aider le référencement local ?", "Oui, avec des contenus utiles, des zones réelles, une structure propre et des pages reliées. Les positions Google et les citations IA restent décidées par les moteurs."],
      ["Peut-on connecter un logiciel immobilier existant ?", "C’est étudié au devis. Il faut vérifier l’existence d’une API, d’un export fiable ou d’un connecteur compatible avant de promettre une synchronisation."],
    ],
  },
  {
    slug: "entreprises-services",
    title: "Automatisation IA, CRM et applications pour entreprises de services",
    eyebrow: "Entreprises de services",
    description:
      "Flex-Web aide les PME de services à centraliser les demandes, préparer les réponses, suivre les devis et créer des outils métier simples autour de leurs vrais processus.",
    audience: "PME, indépendants, prestataires B2B, services administratifs, support client et équipes terrain.",
    problems: [
      "Des informations clients recopiées entre e-mails, tableurs et logiciels.",
      "Des relances oubliées ou dépendantes d’une seule personne.",
      "Des documents, comptes rendus ou réponses à préparer avec les mêmes données.",
    ],
    demo: [
      "Une demande est enregistrée avec son origine et sa priorité.",
      "Le CRM propose le statut, la prochaine action et les éléments à vérifier.",
      "Un assistant IA interne peut aider à retrouver une information ou préparer une réponse à valider.",
    ],
    recommended: [
      { name: automationOffer.name, price: automationOffer.setupCents, href: automationOffer.href, note: "CRM, automatisations et assistant IA interne" },
      { name: "Application web ou mobile", price: null, href: "/demarrer/?service=application", note: "outil métier sur devis" },
    ],
    links: [
      { label: "Guide tâches à automatiser", href: "/journal/taches-automatiser-pme/" },
      { label: "Assistant IA interne", href: "/journal/assistant-ia-interne-entreprise/" },
      { label: "Automatisation ou application ?", href: "/journal/automatisation-ou-application-sur-mesure/" },
    ],
    faq: [
      ["Quand choisir une automatisation plutôt qu’une application ?", "Une automatisation convient quand il faut relier ou préparer des actions entre outils existants. Une application devient pertinente lorsqu’il faut créer un espace dédié avec rôles, écrans et droits."],
      ["Un assistant IA interne peut-il répondre seul aux clients ?", "Le fonctionnement recommandé est la préparation avec validation humaine. Les envois sensibles, commerciaux ou contractuels doivent rester contrôlés."],
      ["Comment démarrer sans gros projet ?", "Commencez par une tâche répétée chaque semaine : qualification de demandes, préparation de relances, suivi de devis ou résumé de documents."],
    ],
  },
] as const;

export const specialtyOptions = [
  maintenance && `${maintenance.name} : ${maintenance.monthlyCents / 100} € TTC/mois`,
  crm && `${crm.name} : ${crm.monthlyCents / 100} € TTC/mois`,
].filter(Boolean);

