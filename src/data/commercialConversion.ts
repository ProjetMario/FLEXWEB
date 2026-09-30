import { automationOffers, websiteOffers } from './pricing';

export type CommercialService = 'site' | 'automation' | 'application';
export type CommercialArea = 'Savoie' | 'Haute-Savoie';

export const commercialQuoteHref = (service: CommercialService) => service === 'site'
  ? websiteOffers[0].href
  : service === 'automation' ? automationOffers[0].href : '/demarrer/?service=application';

export const commercialConversion = {
  site: {
    heading: 'Votre prochain client doit comprendre comment vous contacter.',
    promise: 'Un site qui présente vos prestations, montre votre travail et aide le visiteur à formuler une demande précise.',
    deliverables: ['Une structure de pages définie avec vous et adaptée au téléphone.', 'Vos prestations, votre zone réelle et vos coordonnées faciles à trouver.', 'Un formulaire testé, avec une demande transmise au bon interlocuteur.'],
    prepare: ['Votre activité et les services à présenter.', 'Quelques photos ou réalisations que vous pouvez publier.', 'Votre site actuel, si vous en avez un.'],
    proofSlug: 'serrurier73',
    proofLabel: 'Voir comment Serrurier 73 présente ses prestations',
  },
  automation: {
    heading: 'Retrouvez chaque demande et la prochaine action à faire.',
    promise: 'Nous partons d’une tâche qui revient chaque semaine : ressaisir un contact, retrouver un devis ou préparer un rappel. Le parcours retenu et ses limites sont écrits dans le devis.',
    deliverables: ['Un CRM organisé autour des contacts, demandes, devis et factures.', 'Les tâches répétitives et les connexions incluses précisées avant accord.', 'Une démonstration avec cas réels anonymisés, erreurs et reprise manuelle.'],
    prepare: ['La tâche que vous voulez simplifier en premier.', 'Les logiciels et fichiers utilisés aujourd’hui.', 'Un exemple anonymisé et la fréquence du besoin.'],
    proofSlug: '2savoie-immo',
    proofLabel: 'Explorer un parcours de demande sur 2 Savoie Immo',
  },
  application: {
    heading: 'Un outil conçu autour du travail de vos utilisateurs.',
    promise: 'Espace client, suivi d’interventions ou outil d’équipe : délimitons une première version utilisable, avec les écrans et les droits vraiment nécessaires.',
    deliverables: ['Un parcours prioritaire et des rôles définis avant développement.', 'Une maquette et les fonctionnalités du premier lot décrites au devis.', 'Des tests sur les appareils retenus et une prise en main prévue.'],
    prepare: ['Qui utilisera l’application et pour quelle action.', 'Un exemple de dossier ou de parcours à gérer.', 'Les outils à connecter et les contraintes de terrain.'],
    proofSlug: 'foot-nation',
    proofLabel: 'Explorer les parcours de la plateforme Foot Nation',
  },
} as const;

// Scénarios de cadrage : aucun gain ni réalisation client n’est revendiqué.
export const localCommercialNeeds = {
  Savoie: {
    site: 'Vous intervenez autour de Chambéry, d’Aix-les-Bains ou dans plusieurs vallées ? Le visiteur doit savoir si vous couvrez sa commune et ce qu’il doit vous transmettre pour obtenir un devis.',
    automation: 'Entre deux interventions ou pendant une période chargée, une demande ne devrait pas dépendre d’un pense-bête. Nous définissons le responsable, les informations manquantes et la prochaine action à suivre.',
    application: 'Pour une équipe qui se déplace en Savoie, le cadrage inclut les appareils, la connexion disponible et le compte rendu attendu. Le mode hors ligne est étudié seulement si l’usage l’exige.',
  },
  'Haute-Savoie': {
    site: 'À Annecy, dans le Genevois ou le Chablais, vos clients doivent distinguer vos prestations et savoir comment démarrer. Les langues, les secteurs desservis et les formulaires suivent votre activité réelle.',
    automation: 'Quand l’accueil, le commercial et l’équipe technique interviennent sur le même dossier, chacun doit retrouver son rôle. Le suivi distingue une demande reçue, une étude en cours et un engagement validé.',
    application: 'Pour une équipe répartie entre plusieurs sites en Haute-Savoie, nous définissons les documents partagés, leur version et les droits de chaque utilisateur avant de multiplier les écrans.',
  },
} satisfies Record<CommercialArea, Record<CommercialService, string>>;
