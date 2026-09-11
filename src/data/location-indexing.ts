/**
 * Existing website pages keep their URLs while their organic traffic is audited.
 * Mobile pages were generated from website entries with an identical body. Only
 * seven pages with editorial content are retained; others permanently redirect.
 * Sallanches is preserved because Search Console reports organic clicks there.
 * This policy is shared by route generation, internal links and the sitemap.
 */
export type LocationRouteData = { slug: string; department?: string; type?: string };

export const retainedMobileLocations = new Set([
  "creation-site-internet-savoie",
  "creation-site-internet-haute-savoie",
  "creation-site-internet-chambery",
  "creation-site-internet-annecy",
  "creation-site-internet-aix-les-bains",
  "creation-site-internet-albertville",
  "creation-site-internet-sallanches",
]);

export const isIndexableMobileLocation = (data: LocationRouteData) =>
  retainedMobileLocations.has(data.slug);

export const mobileLocationPath = (data: LocationRouteData) =>
  `/${data.slug.replace("creation-site-internet-", "creation-application-mobile-")}/`;

export function mobileRedirectTarget(data: LocationRouteData): string | null {
  if (isIndexableMobileLocation(data)) return null;
  if (data.department === "Savoie") return "/creation-application-mobile-savoie/";
  if (data.department === "Haute-Savoie") return "/creation-application-mobile-haute-savoie/";
  return "/creation-application-mobile/";
}

export const mobileDestination = (data: LocationRouteData) =>
  mobileRedirectTarget(data) ?? mobileLocationPath(data);

type ApplicationEditorial = {
  intro: string;
  heading: string;
  context: string;
  scenarios: { title: string; text: string }[];
  preparation: string[];
  faq: { question: string; answer: string };
};

// These are explanatory project scenarios, never claimed as client references.
export const localApplicationContent: Record<string, ApplicationEditorial> = {
  "creation-site-internet-sallanches": {
    intro: "FLEX-WEB développe des applications web et mobiles sur mesure pour les entreprises à Sallanches. Le projet peut organiser un service après-vente, le suivi de matériel ou les demandes entre un comptoir et un atelier. Nous commençons par le parcours à améliorer et les informations nécessaires à chaque intervenant.",
    heading: "Suivre un matériel ou un dossier du dépôt à la restitution",
    context: "Pour une entreprise à Sallanches qui reçoit des demandes au comptoir, par téléphone et sur son site, l'enjeu peut être de retrouver le même dossier à chaque étape. Le cadrage distingue les informations visibles par le client, celles de l'équipe et les validations nécessaires avant de confirmer un prix ou une disponibilité.",
    scenarios: [
      { title: "Suivi d'un atelier et du service après-vente", text: "Un collaborateur enregistre le matériel déposé, les coordonnées utiles et le problème signalé. L'atelier renseigne le diagnostic et prépare une proposition ; le responsable valide ce qui est communiqué au client. Le dossier distingue l'accord du client, les pièces attendues, l'intervention et la restitution pour éviter de confondre une demande reçue avec un travail terminé." },
      { title: "Mise à disposition et retour de matériel", text: "Une équipe consulte les demandes, attribue un équipement disponible puis enregistre sa sortie et son retour. Le contrôle de l'état du matériel reste une action explicite. Les règles d'indisponibilité, de prolongation et de remise en service sont définies avant de connecter un stock ou de permettre une réservation en ligne." },
      { title: "Information du client au bon moment", text: "Le client peut consulter l'état de son dossier et fournir une précision depuis un espace dédié. Les messages sont déclenchés par des changements de statut validés, avec des exceptions à traiter par l'équipe. Une intégration au CRM ou au logiciel de caisse est étudiée selon les possibilités réelles de ces outils." },
    ],
    preparation: ["Fournir un exemple anonymisé de fiche de dépôt ou de dossier de service après-vente.", "Définir les statuts du dossier, les responsables et les accords à conserver.", "Préciser comment sont identifiés les équipements et quels logiciels gèrent aujourd'hui le stock ou la facturation.", "Choisir un premier parcours à tester et les données nécessaires à sa reprise."],
    faq: { question: "L'application peut-elle reprendre notre suivi actuel sur tableur ?", answer: "Oui, après examen de la structure et de la qualité des données. Nous définissons les identifiants, les statuts et les correspondances avant un import de test. Les doublons et les informations manquantes sont examinés avec vous. Le devis précise les données reprises, la vérification et les conditions de passage au nouvel outil." },
  },
  "creation-site-internet-savoie": {
    intro: "FLEX-WEB conçoit des applications web et mobiles pour les entreprises de Savoie : outils de gestion, portails clients et suivi d'interventions. Le projet commence par les tâches à simplifier et les personnes qui utiliseront l'application, avant de choisir les fonctionnalités.",
    heading: "Relier le bureau, les clients et les équipes sur le terrain",
    context: "Un projet en Savoie peut concerner une équipe autour de Chambéry, des interventions dans plusieurs vallées ou un service touristique saisonnier. Les déplacements, la qualité de la connexion et les pics d'activité sont des contraintes à décrire dans le cahier des charges ; ils ne justifient pas tous la même application.",
    scenarios: [
      { title: "Interventions d'un artisan", text: "Le bureau attribue une demande à un intervenant. Celui-ci consulte les consignes, ajoute des photos et transmet un compte rendu. Le client reçoit le document après validation. Les droits d'accès et le besoin d'une saisie hors connexion sont cadrés avant développement." },
      { title: "Demandes saisonnières", text: "Une structure touristique rassemble les demandes reçues sur son site, suit les disponibilités et distingue les dossiers incomplets. L'application peut échanger avec un logiciel existant si celui-ci offre une intégration ; elle ne remplace pas automatiquement son moteur de réservation." },
      { title: "Portail d'une PME", text: "Un espace permet à chaque client de retrouver ses documents et l'état de ses demandes. Les responsables gardent la validation des éléments commerciaux et une vue sur les actions à traiter." },
    ],
    preparation: ["Décrire un parcours complet, de la demande au dossier terminé.", "Lister les équipes concernées, les logiciels utilisés et les droits nécessaires.", "Préciser les périodes chargées, les contraintes de connexion et les données à reprendre."],
    faq: { question: "Faut-il une application sur les stores pour les équipes en Savoie ?", answer: "Pas systématiquement. Une application web accessible depuis le navigateur peut suffire pour un portail ou un outil interne. Une application mobile est à étudier si les usages exigent des fonctions du téléphone ou une expérience hors connexion. Ce choix est validé pendant le cadrage." },
  },
  "creation-site-internet-haute-savoie": {
    intro: "FLEX-WEB développe des applications web et mobiles sur mesure pour les PME, les professionnels du tourisme et les entreprises de services en Haute-Savoie. L'objectif est de réunir les informations utiles et de rendre le suivi des opérations plus simple pour vos équipes et vos clients.",
    heading: "Un outil adapté aux demandes, aux réservations et aux échanges entre équipes",
    context: "Pour un projet entre le bassin annécien, le Genevois et les vallées, le périmètre doit préciser les lieux d'utilisation, les langues nécessaires et les systèmes déjà en place. Les besoins d'un atelier, d'un cabinet et d'un hébergeur touristique ne se traitent pas avec le même parcours.",
    scenarios: [
      { title: "Suivi de demandes industrielles", text: "Une PME reçoit une demande accompagnée de fichiers, attribue son étude à un responsable et partage une réponse validée. L'application organise les versions et les autorisations sans transmettre les documents de tous les clients à tous les utilisateurs." },
      { title: "Accueil et demandes voyageurs", text: "Un hébergeur centralise les informations pratiques et les demandes de ses clients. Les contenus peuvent être multilingues selon le devis ; le lien avec les disponibilités et les réservations dépend des possibilités du logiciel déjà utilisé." },
      { title: "Espace de suivi pour une entreprise de services", text: "Le client fournit les pièces utiles, consulte les étapes de son dossier et échange avec son interlocuteur. Les notifications sont déclenchées par un changement réel de statut, avec un historique consultable par l'équipe." },
    ],
    preparation: ["Choisir un premier métier ou une première équipe à équiper.", "Fournir la liste des intégrations et les langues réellement nécessaires.", "Définir qui peut lire, modifier et valider chaque type de document."],
    faq: { question: "Peut-on connecter l'application à notre logiciel existant ?", answer: "Oui si votre logiciel permet l'échange de données via une API, un connecteur ou un export exploitable. Nous vérifions ces possibilités avant le devis. En l'absence d'intégration fiable, une procédure d'import contrôlée ou un périmètre différent est étudié." },
  },
  "creation-site-internet-chambery": {
    intro: "Vous cherchez à développer une application à Chambéry pour gérer des dossiers clients ou organiser votre équipe ? FLEX-WEB vous accompagne du cadrage au déploiement d'un outil web ou mobile, avec un périmètre et un devis définis avant développement.",
    heading: "Du formulaire de demande au dossier suivi par votre équipe",
    context: "Une entreprise de services à Chambéry peut commencer par un portail partagé plutôt que de disperser les échanges entre plusieurs boîtes mail. La priorité est d'identifier ce que le client doit voir et ce que l'équipe doit valider.",
    scenarios: [
      { title: "Portail de dossiers", text: "Le client dépose les pièces attendues ; le responsable marque les éléments reçus ou manquants et partage la prochaine étape. Des profils distincts séparent l'accès client de la vue interne." },
      { title: "Coordination des interventions", text: "Une équipe répartit les demandes entre plusieurs intervenants, suit les changements de planning et retrouve les comptes rendus. Le premier lot peut se limiter à une activité avant d'ajouter d'autres services." },
    ],
    preparation: ["Apporter un exemple anonymisé de dossier et son cycle de traitement.", "Lister les validations qui doivent rester humaines.", "Choisir un groupe pilote et les critères d'acceptation avant la généralisation."],
    faq: { question: "Peut-on commencer par un prototype pour notre équipe à Chambéry ?", answer: "Oui. Le devis peut porter sur un premier périmètre limité à un parcours, avec des données de démonstration et un groupe pilote. Les retours permettent ensuite de décider quelles fonctions développer et d'estimer le lot suivant." },
  },
  "creation-site-internet-annecy": {
    intro: "FLEX-WEB conçoit des applications web et mobiles pour les entreprises à Annecy : espace client, service de réservation ou produit SaaS. Le travail part du parcours utilisateur et des règles de votre activité, pour développer un premier périmètre utile.",
    heading: "Passer d'une idée de service à un premier parcours utilisable",
    context: "Pour un service destiné à des clients autour d'Annecy ou à une clientèle nationale, le premier enjeu est de rendre la proposition compréhensible. Une maquette puis un prototype permettent d'examiner l'inscription, la demande et le suivi avant d'investir dans toutes les fonctions.",
    scenarios: [
      { title: "Réservation d'une prestation", text: "Un utilisateur sélectionne une prestation et transmet sa demande. L'équipe confirme le créneau selon ses règles. Le paiement et la synchronisation d'agenda sont chiffrés séparément lorsqu'ils font partie du besoin." },
      { title: "Premier produit SaaS", text: "Un service destiné à plusieurs entreprises nécessite des espaces séparés, des rôles et des règles d'accès. Le premier lot teste un usage précis avec des données de démonstration avant une ouverture à de vrais clients." },
    ],
    preparation: ["Décrire l'utilisateur, le problème et l'action principale de l'application.", "Préciser les règles de réservation, d'annulation ou d'abonnement envisagées.", "Distinguer les fonctionnalités du lancement de celles des prochaines versions."],
    faq: { question: "Pouvez-vous développer un SaaS depuis Annecy pour des clients en France ?", answer: "Oui, un service peut être conçu pour une clientèle nationale. Le cadrage doit alors préciser l'isolation des espaces d'entreprise, les rôles, le support et les modalités de facturation. Le devis dépend de ce périmètre, pas uniquement du nombre d'écrans." },
  },
  "creation-site-internet-aix-les-bains": {
    intro: "FLEX-WEB développe des applications pour les professionnels à Aix-les-Bains qui souhaitent organiser les demandes, les prestations et la relation client. Une application web peut servir de point d'accès commun à votre équipe et à vos clients, sur ordinateur comme sur téléphone.",
    heading: "Mieux préparer une prestation et suivre les demandes clients",
    context: "Pour une activité d'accueil, de loisirs ou de services à Aix-les-Bains, un parcours utile commence souvent avant le rendez-vous : demande, informations à fournir, confirmation, puis suivi. La conception doit tenir compte des créneaux, des annulations et de l'accès aux documents.",
    scenarios: [
      { title: "Préparation d'une prestation", text: "Le client retrouve les informations pratiques et complète les éléments nécessaires. L'équipe vérifie le dossier et confirme la prestation. L'envoi d'un rappel est prévu selon les préférences du client et les règles fixées au cadrage." },
      { title: "Demandes d'un hébergeur ou d'une activité de loisirs", text: "Un tableau regroupe les demandes et leur statut. Les disponibilités restent gérées dans l'outil de réservation habituel jusqu'à ce qu'une intégration fiable ait été validée." },
    ],
    preparation: ["Documenter les changements possibles entre demande et confirmation.", "Identifier les informations strictement utiles à chaque prestation.", "Fournir les règles de planning et les accès aux outils à connecter."],
    faq: { question: "Une application remplace-t-elle mon site vitrine à Aix-les-Bains ?", answer: "Le site présente votre activité et facilite la découverte de vos services. L'application permet une action ou un suivi personnalisé. Les deux peuvent fonctionner ensemble, avec un lien depuis le site et des accès réservés aux utilisateurs concernés." },
  },
  "creation-site-internet-albertville": {
    intro: "FLEX-WEB crée des applications web et mobiles pour les entreprises à Albertville : préparation d'interventions, comptes rendus, suivi de demandes et outils internes. Le projet se construit autour du travail réel de vos équipes, y compris lorsqu'elles se déplacent.",
    heading: "Préparer, exécuter et documenter les interventions",
    context: "Une entreprise qui intervient depuis Albertville sur plusieurs sites a besoin de retrouver le bon dossier et de transmettre des informations fiables au bureau. Les usages en déplacement demandent de vérifier le réseau disponible, les appareils utilisés et le moment où une validation est nécessaire.",
    scenarios: [
      { title: "Compte rendu de terrain", text: "L'intervenant ouvre le dossier attribué, renseigne les opérations effectuées et ajoute les éléments utiles. Le responsable vérifie le compte rendu avant son partage au client ou son transfert dans un logiciel de gestion." },
      { title: "Suivi d'équipements", text: "Une équipe consulte l'historique d'un équipement, planifie une action et suit les pièces ou documents associés. Les données de départ et les règles de mise à jour sont définies avant la reprise de l'existant." },
    ],
    preparation: ["Préciser les appareils, les conditions de connexion et les besoins hors ligne.", "Fournir un compte rendu type et les règles de validation.", "Identifier les informations à transmettre au logiciel de gestion existant."],
    faq: { question: "L'application peut-elle fonctionner sans réseau pendant une intervention ?", answer: "Un fonctionnement hors connexion peut être étudié, mais il demande des règles de stockage et de synchronisation. Le devis précise les écrans concernés, les données accessibles et le traitement des modifications concurrentes. Ce n'est pas une fonction incluse par défaut." },
  },
};
