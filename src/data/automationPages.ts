export interface AutomationPage {
  slug: string;
  title: string;
  description: string;
  label: string;
  heading: string;
  intro: string;
  area: string;
  contextTitle: string;
  context: string[];
  examples: { audience: string; title: string; description: string; steps: string[]; review: string }[];
  faq: { question: string; answer: string }[];
}

export const automationPages: Record<string, AutomationPage> = {
  france: {
    slug: "automatisation-ia",
    title: "Automatisation IA pour entreprises en France | FLEX-WEB",
    description: "Automatisez vos tâches, connectez vos demandes à un CRM et préparez vos réponses avec l’IA. FLEX-WEB accompagne les entreprises en France. Projet sur devis.",
    label: "Automatisation IA · France",
    heading: "L’automatisation IA au service de votre entreprise.",
    intro: "FLEX-WEB conçoit des automatisations de tâches avec ou sans intelligence artificielle : centraliser les demandes, préparer des réponses, organiser les relances et connecter vos outils. Commencez par un besoin concret, avec un projet sur devis.",
    area: "France",
    contextTitle: "Un projet à distance, ancré dans votre façon de travailler",
    context: [
      "Nous proposons cet accompagnement aux artisans, indépendants et PME en France, avec une attention particulière aux projets en Savoie et Haute-Savoie. Le cadrage, les démonstrations et la prise en main peuvent se faire à distance.",
      "Le point de départ n’est pas un nouvel outil à ajouter. Nous étudions la tâche, sa fréquence, les informations disponibles et les logiciels que vous utilisez déjà. Une connexion est retenue après vérification de ses possibilités et de ses accès.",
      "Une règle simple suffit souvent pour classer une demande ou créer une tâche. L’IA devient utile lorsqu’il faut interpréter un texte libre, en préparer un résumé ou proposer un brouillon. Les décisions commerciales et les cas sensibles restent soumis à votre validation.",
    ],
    examples: [
      { audience: "Artisans & services", title: "Du formulaire à une demande bien rangée", description: "Une demande reçue sur votre site devient une fiche de suivi avec les coordonnées et le besoin exprimé.", steps: ["Demande sur le site", "Fiche dans le CRM", "Tâche de rappel"], review: "Vous vérifiez le besoin et le devis avant de répondre." },
      { audience: "PME & équipes commerciales", title: "Préparer le suivi d’un prospect", description: "À partir des échanges autorisés, une automatisation prépare un résumé et propose la prochaine action à traiter.", steps: ["Échange reçu", "Résumé proposé", "Action à valider"], review: "L’envoi d’un message suit vos règles et votre validation." },
      { audience: "Gestion & opérations", title: "Rassembler les informations utiles", description: "Les données issues de vos outils alimentent un tableau de suivi pour limiter les recopies entre fichiers.", steps: ["Sources connectées", "Données contrôlées", "Tableau de suivi"], review: "Les données manquantes ou incohérentes sont signalées." },
    ],
    faq: [
      { question: "Qu’est-ce que l’automatisation des tâches avec l’IA ?", answer: "Une automatisation exécute une suite d’actions à partir d’un événement, par exemple la réception d’une demande. L’IA peut compléter ce parcours en proposant un classement, un résumé ou un brouillon de réponse. Elle n’est pas nécessaire pour toutes les étapes." },
      { question: "Quels outils peut-on connecter ?", answer: "Un site, un formulaire, un CRM, une messagerie ou un tableau de suivi peuvent participer au projet. La faisabilité dépend des connexions disponibles, des accès accordés et des limites de chaque service. Nous vérifions ces points pendant le cadrage." },
      { question: "Combien coûte une automatisation sur mesure ?", answer: "Les projets d’automatisation IA sur mesure sont établis sur devis. Le coût dépend du parcours, des outils à connecter, des volumes, du contrôle attendu et du suivi. Les abonnements éventuels aux outils tiers sont précisés dans la proposition." },
      { question: "Faut-il remplacer mon site ou mon CRM ?", answer: "Pas nécessairement. Nous examinons d’abord les outils existants. Un remplacement n’est envisagé que si leurs possibilités ou leurs contraintes empêchent le parcours défini ensemble." },
      { question: "Intervenez-vous partout en France ?", answer: "Oui, le cadrage, les démonstrations et la prise en main peuvent être organisés à distance pour une entreprise en France. Des pages dédiées détaillent également les besoins des entreprises en Savoie et Haute-Savoie." },
    ],
  },
  savoie: {
    slug: "automatisation-ia-savoie",
    title: "Automatisation IA en Savoie : tâches et CRM | FLEX-WEB",
    description: "Automatisation des demandes, du suivi client et des tâches administratives en Savoie : Chambéry, Aix-les-Bains, Albertville. Projet IA sur devis avec FLEX-WEB.",
    label: "Automatisation IA · Savoie (73)",
    heading: "Automatisation IA en Savoie : simplifiez votre quotidien.",
    intro: "Une demande à rappeler, un devis à préparer, une information à recopier : FLEX-WEB vous aide à définir un parcours d’automatisation adapté à votre entreprise en Savoie. Un site, un CRM et des règles de suivi peuvent travailler ensemble.",
    area: "Savoie",
    contextTitle: "Des parcours adaptés aux entreprises de Savoie",
    context: [
      "À Chambéry, Aix-les-Bains ou Albertville, un artisan peut recevoir ses demandes entre deux interventions et avoir besoin de retrouver rapidement l’adresse, le métier concerné et les disponibilités du client. L’enjeu est d’organiser ce suivi avec les informations réellement recueillies.",
      "Pour une activité de tourisme ou de services en Tarentaise et en Maurienne, les demandes peuvent varier selon les périodes. Un formulaire structuré et un suivi centralisé permettent de préparer leur traitement sans promettre automatiquement un créneau ou une disponibilité non vérifiée.",
      "Le cadrage peut se faire à distance. Nous commençons par décrire une semaine de travail habituelle, les tâches qui reviennent et les exceptions. Ces situations servent ensuite de base à une démonstration et aux tests avant mise en service.",
    ],
    examples: [
      { audience: "Artisan à Chambéry", title: "Organiser une demande d’intervention", description: "Le formulaire collecte le type de besoin et les coordonnées. Le suivi attribue un statut et prépare une tâche de rappel.", steps: ["Besoin renseigné", "Fiche de demande", "Rappel à organiser"], review: "L’artisan confirme le périmètre, le prix et le rendez-vous." },
      { audience: "Activité touristique en Savoie", title: "Préparer une réponse de disponibilité", description: "Une demande est triée par période et prestation ; un brouillon peut reprendre les informations validées par votre équipe.", steps: ["Période demandée", "Informations regroupées", "Brouillon de réponse"], review: "La disponibilité et les conditions sont vérifiées avant l’envoi." },
      { audience: "PME à Aix-les-Bains ou Albertville", title: "Retrouver les devis à suivre", description: "Les étapes commerciales sont regroupées dans une vue de suivi qui fait ressortir les actions à traiter.", steps: ["Statut du devis", "Échéance de suivi", "Tâche commerciale"], review: "Votre équipe choisit quand et comment contacter le client." },
    ],
    faq: [
      { question: "À quelles entreprises de Savoie s’adresse ce service ?", answer: "Aux artisans, indépendants, entreprises de services et PME qui souhaitent organiser des tâches répétitives. Le projet doit partir d’un besoin identifiable, comme centraliser les demandes ou suivre les devis." },
      { question: "Peut-on automatiser le suivi des demandes pendant les interventions ?", answer: "Oui, un formulaire peut alimenter un suivi et préparer des tâches de rappel si les outils le permettent. Le système doit aussi signaler les échecs de connexion pour qu’une demande ne passe pas inaperçue." },
      { question: "L’IA peut-elle fixer un devis ou un rendez-vous seule ?", answer: "Nous privilégions un devis et une prise de rendez-vous validés par l’entreprise. L’IA peut préparer des éléments, mais les prix, disponibilités et engagements doivent provenir de données fiables et de règles définies avec vous." },
      { question: "Comment démarrer un projet en Savoie ?", answer: "Décrivez dans la demande de devis une tâche répétitive, les outils utilisés et la fréquence du besoin. Le cadrage précise les connexions possibles, les étapes, les contrôles et le coût du projet sur mesure." },
    ],
  },
  hauteSavoie: {
    slug: "automatisation-ia-haute-savoie",
    title: "Automatisation IA en Haute-Savoie : CRM et tâches | FLEX-WEB",
    description: "Structurez vos demandes et automatisez le suivi avec un CRM en Haute-Savoie : Annecy, Annemasse, Thonon-les-Bains, Cluses. Automatisation IA sur devis.",
    label: "Automatisation IA · Haute-Savoie (74)",
    heading: "Automatisation IA en Haute-Savoie : un suivi client plus simple.",
    intro: "FLEX-WEB accompagne les projets d’automatisation de tâches en Haute-Savoie : centralisation des demandes, préparation de réponses et circulation des informations entre vos outils. L’objectif est de réduire les recopies et de rendre les prochaines actions visibles.",
    area: "Haute-Savoie",
    contextTitle: "Partir du terrain, du formulaire jusqu’au suivi d’équipe",
    context: [
      "Pour un professionnel de services à Annecy ou Annemasse, une demande peut nécessiter plusieurs informations avant de devenir un rendez-vous. Un parcours structuré aide à réunir le besoin, le lieu d’intervention et les documents utiles au même endroit.",
      "Une entreprise à Cluses ou dans la vallée de l’Arve peut vouloir mieux transmettre les demandes entre son accueil et son équipe technique. Le projet peut prévoir un classement, un responsable de traitement et une liste des éléments manquants, sans demander à l’IA de valider une faisabilité technique.",
      "Dans le Chablais, à Thonon-les-Bains ou Évian-les-Bains, comme pour une activité autour de Chamonix, un fonctionnement saisonnier ou plusieurs sites peuvent demander des règles de suivi différentes. Nous définissons les périodes, responsables et exceptions pendant le cadrage, réalisable à distance.",
    ],
    examples: [
      { audience: "Entreprise de services à Annecy", title: "Préparer une demande avant le rappel", description: "Les informations du formulaire deviennent une fiche et une liste de points à compléter avant de proposer une prestation.", steps: ["Formulaire reçu", "Informations vérifiées", "Rappel préparé"], review: "Le professionnel confirme les besoins et les engagements." },
      { audience: "PME dans la vallée de l’Arve", title: "Transmettre au bon interlocuteur", description: "Une demande est orientée selon une règle de métier. Un résumé proposé peut aider l’équipe à en prendre connaissance.", steps: ["Demande entrante", "Classement proposé", "Responsable désigné"], review: "Les cas ambigus et la faisabilité sont revus par l’équipe." },
      { audience: "Activité avec plusieurs sites", title: "Suivre les actions d’une équipe", description: "Chaque demande dispose d’un état et d’un responsable, avec une vue partagée des éléments restant à traiter.", steps: ["Demande affectée", "État partagé", "Action de suivi"], review: "Les droits d’accès et les responsabilités sont définis au départ." },
    ],
    faq: [
      { question: "Pouvez-vous accompagner une entreprise à Annecy ou Annemasse ?", answer: "Oui, FLEX-WEB propose un accompagnement aux entreprises de Haute-Savoie, notamment autour d’Annecy, Annemasse, Cluses et du Chablais. Le cadrage et la prise en main peuvent se faire à distance." },
      { question: "Peut-on conserver un contrôle avant les envois ?", answer: "Oui. Une étape de validation peut être prévue entre la préparation d’un brouillon et l’envoi. Les exceptions, les informations manquantes et les demandes sensibles doivent être orientées vers une personne." },
      { question: "Une automatisation convient-elle à plusieurs établissements ?", answer: "Cela dépend des outils et de leur gestion des accès. Le cadrage détermine comment affecter une demande, quelles informations chaque équipe peut consulter et comment suivre les actions entre établissements." },
      { question: "Quel budget prévoir pour mon projet en Haute-Savoie ?", answer: "Le projet sur mesure est chiffré sur devis après étude du parcours et des connexions. Le devis précise les prestations et les frais récurrents éventuels liés aux logiciels, aux volumes et au suivi." },
    ],
  },
};
