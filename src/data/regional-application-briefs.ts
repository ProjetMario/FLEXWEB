type ProjectBrief = {
  heading: string;
  summary: string;
  scenario: string;
  decisions: { title: string; detail: string }[];
  acceptance: string[];
  questions: { question: string; answer: string }[];
  guide: { href: string; label: string; reason: string };
};

/** Project examples for scoping discussions, not claims about delivered clients. */
export const regionalApplicationBriefs: Record<string, ProjectBrief> = {
  'creation-site-internet-savoie': {
    heading: 'Cadrer une application de terrain avant de demander un devis',
    summary: 'Commencez par une intervention complète : qui la prépare, quelles informations l’équipe emporte, puis qui valide le compte rendu. Le nombre d’écrans vient après ces décisions.',
    scenario: 'Exemple illustratif : une entreprise d’entretien répartit ses interventions entre un bureau et plusieurs techniciens. Le premier lot couvre l’attribution d’un dossier et le retour d’intervention ; le stock, la facturation et la planification avancée peuvent rester dans les outils actuels.',
    decisions: [
      { title: 'Utilisateurs et autorisations', detail: 'Le bureau attribue les dossiers. Le technicien accède aux interventions qui lui sont confiées et prépare son compte rendu. Le responsable valide le document partagé au client. Ces droits sont testés avec des comptes distincts.' },
      { title: 'Données et connexion sur le terrain', detail: 'Listez les coordonnées utiles, consignes, photos et documents nécessaires à chaque étape. Précisez les appareils utilisés et ce qui doit rester accessible sans réseau. Une saisie hors connexion exige de prévoir la synchronisation et les modifications concurrentes.' },
      { title: 'Reprise des dossiers en cours', detail: 'Un échantillon anonymisé permet de vérifier les identifiants, les doublons et les statuts. Convenez des dossiers à importer, de la date de bascule et de la procédure de retour à l’ancien suivi si l’import de contrôle échoue.' },
    ],
    acceptance: [
      'Le bureau crée et attribue une intervention ; le technicien ne voit que les dossiers autorisés.',
      'Un compte rendu reste en brouillon jusqu’à validation et une pièce manquante est signalée avant partage.',
      'Un échec de transmission reste visible. Si le mode hors connexion est retenu, la reprise du réseau ne crée pas un deuxième compte rendu.',
      'L’équipe rapproche les dossiers importés de la source et teste l’export convenu avant la mise en service.',
    ],
    questions: [
      { question: 'Doit-on équiper toute l’équipe dès le premier jour ?', answer: 'Un groupe pilote peut commencer sur un type d’intervention. Le devis précise ce premier périmètre, les conditions de validation et les étapes de généralisation. Le planning dépend aussi des données disponibles et du temps consacré aux essais par votre équipe.' },
      { question: 'Comment préparer le premier échange sans cahier des charges ?', answer: 'Apportez un dossier anonymisé, décrivez son parcours actuel et indiquez l’étape qui pose problème. Ajoutez la liste des logiciels et appareils utilisés. Ces éléments suffisent pour commencer le cadrage ; les documents sensibles ne sont pas nécessaires dans le formulaire public.' },
    ],
    guide: { href: '/journal/automatisation-ou-application-sur-mesure/', label: 'Automatisation ou application : choisir le bon périmètre', reason: 'Pour déterminer si une connexion entre vos outils suffit ou si vos utilisateurs ont besoin d’un espace dédié.' },
  },
  'creation-site-internet-haute-savoie': {
    heading: 'Définir un espace de dossiers partagé avec vos clients',
    summary: 'Un portail utile permet de connaître la version d’un document, la prochaine action et la personne qui doit la valider. Décrivez ces règles avant de prévoir toutes les fonctionnalités.',
    scenario: 'Exemple illustratif : une PME reçoit des demandes techniques et des fichiers depuis plusieurs interlocuteurs. Son premier lot réunit la demande, les pièces attendues et la réponse validée dans un dossier. Il ne remplace pas automatiquement le logiciel de production ou de comptabilité.',
    decisions: [
      { title: 'Comptes clients et rôles internes', detail: 'Le client consulte ses propres dossiers et dépose les pièces demandées. L’équipe prépare l’étude ; un responsable approuve les documents partagés. Précisez aussi qui peut inviter un collègue et ce qu’il advient de ses accès lorsqu’il quitte l’entreprise.' },
      { title: 'Documents et changements de version', detail: 'Définissez les formats acceptés, la taille des fichiers et les règles de conservation. Un document remplacé doit rester identifiable comme ancienne version selon les règles retenues. Les langues du portail et celles des documents sont deux besoins à cadrer séparément.' },
      { title: 'Reprise et échanges avec les outils actuels', detail: 'Choisissez la source de référence pour les contacts, les numéros de dossier et les statuts. Testez une reprise sur un petit échantillon avant la bascule. Si un logiciel ne permet pas une connexion fiable, un import contrôlé peut être étudié avec ses limites et sa fréquence.' },
    ],
    acceptance: [
      'Deux comptes de démonstration appartenant à des clients différents ne peuvent jamais consulter les mêmes dossiers privés.',
      'Le dépôt d’une nouvelle pièce met à jour le bon dossier, et la personne chargée de sa vérification retrouve la version à examiner.',
      'Un document préparé en interne ne devient visible au client qu’après l’approbation convenue.',
      'Un nouvel essai après une erreur de connexion ne crée pas un doublon ; les échanges en échec sont identifiables et peuvent être repris.',
    ],
    questions: [
      { question: 'Le portail peut-il accueillir plusieurs interlocuteurs d’une même entreprise ?', answer: 'Oui, si ce fonctionnement est prévu au cadrage. Il faut définir qui invite les utilisateurs, quels dossiers sont partagés entre collègues et qui peut valider une réponse. Le devis distingue ces accès clients des droits de votre équipe interne.' },
      { question: 'Que doit préciser le devis sur les coûts après lancement ?', answer: 'Il distingue le développement initial, l’hébergement, le stockage des fichiers, les éventuelles licences et le suivi. Les volumes attendus et les conditions d’évolution sont précisés avant accord ; le nombre d’utilisateurs seul ne suffit pas à établir le budget.' },
    ],
    guide: { href: '/journal/connecter-demandes-crm/', label: 'Relier les demandes au CRM sans perdre le suivi', reason: 'Pour cadrer les statuts, la source de référence et les contrôles avant d’ajouter un portail à votre suivi commercial.' },
  },
};
