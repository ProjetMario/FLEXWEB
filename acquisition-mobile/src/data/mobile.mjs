// Maintain established public routes; a regional page has no English equivalent.
const routes = {
  hub: {fr: "/creation-application-mobile/", en: "/en/applications/"},
  ios: {fr: "/applications/ios/", en: "/en/applications/ios/"},
  android: {fr: "/applications/android/", en: "/en/applications/android/"},
  businesses: {fr: "/applications/entreprises/", en: "/en/applications/businesses/"},
  individuals: {fr: "/applications/particuliers/", en: "/en/applications/individuals/"},
  budget: {fr: "/applications/prix/", en: "/en/applications/cost/"},
  compare: {fr: "/applications/web-mobile-ou-logiciel/", en: "/en/applications/web-mobile-or-desktop/"},
  suisse: {fr: "/applications/suisse-romande/"},
  belgique: {fr: "/applications/belgique-francophone/"},
};

const fr = {
  hub: {
    title: "Développement d’applications mobiles iOS et Android pour entreprises et particuliers",
    description: "Confiez à Flex-Web votre application iOS et Android à partir de 1 990 € TTC. Découvrez FootNation, préparez votre première version et demandez un devis.",
    intro: "Flex-Web développe depuis Voglans, en Savoie, des applications mobiles sur mesure pour les entreprises et les particuliers. L’offre démarre à 1 990 € TTC pour les deux plateformes, iOS et Android. Nous travaillons en français ou en anglais, en France et à distance avec les porteurs de projets francophones.",
    sections: [
      ["Que doit pouvoir faire la première personne qui ouvre votre application ?", "Décrivez une seule action de bout en bout. Pour un outil terrain, un technicien retrouve une intervention, renseigne le travail effectué puis transmet son compte rendu. Pour une idée grand public, un utilisateur découvre une activité puis enregistre son choix. Ces exemples servent à définir votre besoin avant le chiffrage."],
      ["Comment passons-nous de ce besoin à une application testable ?", "Nous précisons les utilisateurs, les écrans, les données et les outils à connecter. Nous proposons ensuite un premier périmètre, des critères de test sur iOS et Android et des étapes de validation. Le devis fixe les fonctions, les responsabilités et le calendrier. Vous pouvez ainsi vérifier concrètement chaque livraison."],
      ["Comment travailler depuis la Suisse, la Belgique ou un autre pays ?", "Les ateliers et les démonstrations s’organisent à distance. Indiquez le pays des utilisateurs, leur langue, le fuseau horaire et les boutiques visées. Nous établissons les conditions du projet à partir de ces éléments. Les projets au Québec et dans les autres pays francophones peuvent suivre ce même parcours."],
    ],
    faq: [
      ["L’offre à 1 990 € couvre-t-elle iOS et Android ?", "Oui. Le seuil de 1 990 € TTC concerne une application simple pour les deux plateformes. Le devis précise les fonctions retenues, les comptes, les frais éventuels, la distribution et les étapes de recette."],
      ["Quand pourrai-je installer une première version ?", "Le calendrier dépend notamment des écrans, des accès aux outils existants et des appareils à tester. Le devis distingue la mise à disposition pour les essais et, si elle est prévue, la soumission aux boutiques."],
    ],
  },
  ios: {
    title: "Faire développer une application iOS pour iPhone et iPad",
    description: "Préparez votre application iPhone avec Flex-Web. Modèles à tester, autorisations, essais avant diffusion et démarches App Store sont précisés au devis.",
    intro: "Une application iOS est pertinente lorsqu’un usage sur iPhone ou iPad exige une interface mobile, l’appareil photo ou des notifications. Précisez l’appareil réellement utilisé et la tâche à accomplir avant de choisir les fonctions.",
    sections: [
      ["Quels appareils et autorisations tester ?", "Dressez la liste des modèles d’iPhone et d’iPad à couvrir. Pour une prise de photo, définissez ce que l’utilisateur peut faire s’il refuse l’accès à l’appareil, manque de réseau ou souhaite remplacer le cliché. Ces situations entrent dans la recette."],
      ["Comment essayer l’application avant sa mise en ligne ?", "Constituez un petit groupe qui utilise réellement les appareils visés. Donnez-lui un parcours à terminer et un résultat attendu. L’équipe peut ainsi reproduire les problèmes et vérifier leur correction avant la soumission."],
      ["Qui prépare la publication Apple ?", "Le devis indique le titulaire du compte développeur, la personne qui prépare les captures, les textes, les déclarations et l’envoi à Apple. Les frais de compte et les éventuelles reprises après examen sont détaillés. Apple décide de l’acceptation."],
    ],
    faq: [["Existe-t-il un exemple visible sur iPhone ?", "Oui. La fiche Apple de FootNation, éditée par FLEX IMMO, présente ses profils, sa recherche de clubs et sa messagerie. Notre étude de cas détaille ces parcours."], ["L’iPad est-il prévu dans tous les projets ?", "Indiquez les tailles d’écran et les usages tablette nécessaires. Le devis liste les appareils et orientations sur lesquels les interfaces seront vérifiées."]],
  },
  android: {
    title: "Développement d’application Android pour smartphones et tablettes",
    description: "Choisissez les téléphones, les usages hors connexion et le mode de diffusion de votre application Android. Flex-Web chiffre et teste le parcours convenu.",
    intro: "Pour créer une application Android, partez des appareils que vos utilisateurs ont déjà. Un téléphone personnel, une tablette d’atelier et un terminal terrain n’imposent pas les mêmes contraintes de saisie ou de connexion.",
    sections: [
      ["Votre application doit-elle fonctionner sans réseau ?", "Prenez le cas d’une intervention dans un sous-sol. Il faut décider quelles données restent disponibles, ce que l’utilisateur peut modifier et comment lui indiquer qu’un envoi reste en attente. Un mode hors connexion et la gestion des conflits ont leur propre chiffrage."],
      ["Comment limiter les surprises entre modèles Android ?", "Fournissez quelques modèles représentatifs du parc, les versions d’Android et les accessoires indispensables. Le plan de tests reprend les tailles d’écran, les permissions et les interruptions possibles pendant une action."],
      ["Diffusion interne ou Google Play ?", "Précisez si l’application doit rester réservée aux salariés ou être accessible au public. Le devis fixe la méthode de distribution, les accès au compte, la préparation des fiches et les éventuels frais. Google examine les soumissions à Google Play."],
    ],
    faq: [["Les téléphones personnels sont-ils utilisables ?", "Cela dépend des données, des règles de l’entreprise et des versions prises en charge. Ces éléments sont examinés avant de choisir le mode de déploiement."], ["Comment budgéter iPhone et Android ensemble ?", "Les deux plateformes sont comprises dans le prix de départ de 1 990 € TTC. Les fonctions, versions, terminaux particuliers et services externes sont décrits et chiffrés au devis."]],
  },
  businesses: {
    title: "Application mobile sur mesure pour entreprise et équipes terrain",
    description: "Préparez un devis d’application métier pour vos salariés ou clients. Rôles, reprise de données, accès CRM, fonctionnement hors ligne et recette.",
    intro: "Une application métier simplifie une tâche précise pour une équipe ou un client. Pour définir la première version, choisissez le processus où une double saisie, un échange de pièces ou une validation ralentit aujourd’hui le travail.",
    sections: [
      ["Quel processus choisir pour un premier lot ?", "Suivez une intervention depuis l’affectation jusqu’au compte rendu. Qui affecte la tâche ? Quelles informations le technicien peut-il modifier ? Qui vérifie le résultat ? Un exemple anonymisé de formulaire existant permet de cadrer cette circulation des données."],
      ["Comment relier l’application au CRM ou à un portail ?", "Identifiez la source de référence pour chaque donnée, les droits d’accès et la fréquence des échanges. Pour un devis fiable, fournissez la documentation disponible et précisez qui peut ouvrir un environnement de test."],
      ["Comment décider que la livraison est acceptable ?", "Choisissez un parcours complet, les comptes de test et les situations d’erreur. Par exemple, vérifier qu’un salarié retrouve uniquement les interventions qui lui sont affectées et qu’un responsable peut suivre les rapports transmis."],
    ],
    faq: [["Faut-il remplacer nos logiciels actuels ?", "Un projet peut démarrer par une interface mobile reliée à l’existant. La faisabilité dépend des accès, des formats et des interfaces de votre logiciel."], ["Peut-on commencer avec une seule équipe ?", "Oui. Indiquez le groupe pilote, les droits de chaque rôle et le résultat attendu. Les extensions à d’autres services pourront être chiffrées après cet essai."]],
  },
  individuals: {
    title: "Faire créer une application mobile quand on est particulier",
    description: "Vous avez une idée d’application ? Définissez son premier usage, son budget et ses conditions de publication avec Flex-Web. iOS et Android dès 1 990 € TTC.",
    intro: "Vous pouvez demander un devis en votre nom pour transformer une idée en application. Pour le premier échange, expliquez qui l’utiliserait, pourquoi cette personne l’ouvrirait et ce qu’elle devrait avoir accompli en la refermant.",
    sections: [
      ["Par quoi commencer quand on a beaucoup d’idées ?", "Écrivez un seul scénario avec un début et un résultat. Exemple illustratif : une personne cherche une activité, consulte une fiche puis la garde pour plus tard. Repoussez ensuite les options qui ne servent pas directement ce scénario, comme un classement ou une messagerie."],
      ["Que préparer sans compétence technique ?", "Un croquis, quelques écrans dessinés sur papier et des exemples de textes suffisent pour expliquer l’idée. Notez les moments où une connexion, un compte, un paiement ou une notification devient nécessaire. Ces choix font évoluer le budget."],
      ["Qui aura accès au projet après livraison ?", "Faites préciser dans le devis les comptes développeur, les accès techniques, les éléments remis et les conditions de maintenance. Prévoyez aussi qui répond aux utilisateurs et qui peut mettre à jour les contenus."],
    ],
    faq: [["Ai-je besoin d’une société pour demander un devis ?", "Vous pouvez utiliser le parcours Particulier et décrire votre projet avec vos coordonnées de contact. Les conditions de distribution seront examinées si vous envisagez une publication."], ["Une idée similaire à FootNation peut-elle démarrer à 1 990 € ?", "Le tarif de départ correspond à un périmètre simple. Les profils, vidéos, annuaire et messagerie d’un réseau complet sont des fonctions distinctes à chiffrer selon votre projet."]],
  },
  budget: {
    title: "Quel budget prévoir pour créer une application iOS et Android ?",
    description: "Le prix d’une application Flex-Web démarre à 1 990 € TTC pour iOS et Android. Comparez premier développement, frais de boutique et maintenance facultative.",
    intro: "Flex-Web propose une première application simple à partir de 1 990 € TTC, iOS et Android inclus. Un prix utile se lit avec la liste des fonctions livrées et des essais prévus. Les trois fourchettes ci-dessous servent à préparer le devis.",
    sections: [
      ["Qu’est-ce qui change le coût d’une première version ?", "Une liste consultable et une fiche détaillée n’ont pas les mêmes besoins qu’un compte sécurisé avec paiements et synchronisation hors ligne. Précisez les profils utilisateurs, les écrans, les règles et ce qui doit remonter dans votre logiciel métier."],
      ["Quelles dépenses reviennent après livraison ?", "Demandez une ligne distincte pour les comptes de boutique, les services d’envoi, l’hébergement, le stockage et toute consommation externe utile. Les options mensuelles publiées sont facultatives. Le devis précise leur contenu et les responsabilités de mise à jour."],
      ["Comment comparer deux devis ?", "Prenez un même scénario et vérifiez, pour chaque offre, les appareils couverts, les tests, les corrections, la distribution et les éléments remis. Un calendrier exploitable indique aussi ce que vous devez fournir pour que chaque étape commence."],
    ],
    faq: [["Les 1 990 € correspondent-ils à une seule plateforme ?", "Le point de départ TTC concerne iOS et Android ensemble. Le périmètre fonctionnel et le prix final sont convenus avant la commande."], ["Peut-on chiffrer le projet en plusieurs lots ?", "Oui. Décrivez d’abord la fonction nécessaire à la première utilisation. Paiement, synchronisation, langues supplémentaires ou espace d’administration peuvent être identifiés comme lots ultérieurs dans le devis."]],
  },
  compare: {
    title: "Application web, application mobile ou logiciel installé : que choisir ?",
    description: "Comparez l’accès par navigateur, l’application iOS et Android et le logiciel de bureau selon vos utilisateurs, la connexion et les équipements nécessaires.",
    intro: "Commencez par l’endroit où le travail se fait. Un client qui suit ponctuellement un dossier, un technicien sans réseau et un comptable devant deux écrans peuvent avoir besoin de trois interfaces différentes.",
    sections: [
      ["Quand choisir une application web ?", "Un portail accessible par lien convient à un usage ponctuel ou partagé entre plusieurs types d’ordinateurs. Identifiez les navigateurs, les tailles d’écran, l’authentification et les conditions de connexion à tester."],
      ["Quand choisir une application mobile ?", "Une application installée sur téléphone répond notamment à un usage répété sur le terrain, à une saisie rapide ou à l’utilisation d’une caméra. Le hors ligne, les permissions et les notifications sont à spécifier selon le scénario réel."],
      ["Quand prévoir un logiciel de bureau ?", "Un poste installé peut être utile pour travailler avec des fichiers locaux, des périphériques ou une procédure interne sur Windows ou macOS. Vérifiez les droits d’installation, le déploiement des mises à jour et la sauvegarde avec l’équipe informatique."],
    ],
    faq: [["Peut-on combiner une interface web et une application mobile ?", "Oui, par exemple une équipe terrain sur téléphone et un responsable sur navigateur. Il faut préciser les rôles, les données partagées et les écrans distincts dans le devis."], ["Le tarif de départ inclut-il un logiciel Windows ?", "Le point de départ de 1 990 € TTC concerne l’offre mobile iOS et Android. Une interface web supplémentaire ou un logiciel de bureau possède son propre périmètre."]],
  },
  suisse: {
    title: "Développement d’applications mobiles pour la Suisse romande",
    description: "Faites cadrer votre application iOS et Android en Suisse romande avec un interlocuteur en français. Offre dès 1 990 € TTC, devis en euros et ateliers à distance.",
    intro: "Depuis Voglans en Savoie, Flex-Web accompagne à distance les entreprises et les particuliers de Suisse romande. Le développement mobile démarre à 1 990 € TTC pour iOS et Android. Les repères publics sont en euros.",
    sections: [
      ["Comment préparer une demande d’offre depuis la Suisse ?", "Indiquez votre canton, l’adresse de facturation, le public cible et la devise utilisée par vos outils. L’offre écrite détaille le prix en euros et les conditions de facturation applicables à votre situation. Un paiement en francs suisses dans votre future application constitue un besoin fonctionnel à préciser."],
      ["Que prévoir pour un lancement en plusieurs langues ?", "Précisez si la première version vise la Suisse romande uniquement ou si elle doit aussi servir des utilisateurs germanophones ou italophones. Listez les écrans, notifications, textes de boutique et contenus à traduire. L’accompagnement du projet se déroule en français ou en anglais."],
      ["Comment organiser les essais à distance ?", "Choisissez quelques appareils et un groupe pilote représentatif de votre clientèle ou de vos équipes. Nous convenons des ateliers, des démonstrations et des validations. Une distribution sur les boutiques suisses est précisée au devis si elle fait partie du projet."],
    ],
    faq: [["Puis-je demander une offre à titre privé en Suisse ?", "Oui. Choisissez le profil Particulier et décrivez le besoin principal. Les conditions du projet et de distribution sont précisées avant la commande."], ["Avez-vous une application visible sur la boutique suisse ?", "La fiche Apple suisse de FootNation est accessible depuis l’étude de cas. Vous pouvez y vérifier l’éditeur et les fonctions présentées."]],
  },
  belgique: {
    title: "Création d’applications mobiles pour la Belgique francophone",
    description: "Une application iOS et Android pour votre activité en Wallonie ou à Bruxelles. Flex-Web accompagne entreprises et particuliers à distance, dès 1 990 € TTC.",
    intro: "Flex-Web accompagne depuis la France les porteurs de projets en Wallonie et à Bruxelles. Décrivez votre public et sa langue d’usage pour obtenir un devis en euros. Le prix de départ de 1 990 € TTC comprend iOS et Android.",
    sections: [
      ["L’application doit-elle aussi être disponible en néerlandais ?", "Une première version destinée à un public francophone peut privilégier le français. Si vous servez aussi des utilisateurs néerlandophones, précisez les formulaires, messages et contenus qui doivent changer de langue. Le devis répartit la rédaction, la traduction et la validation entre les parties."],
      ["Quel périmètre pour une entreprise ou un particulier ?", "Une PME peut commencer par une demande d’intervention que son équipe traite sur téléphone. Un particulier peut proposer un premier parcours destiné au public. Donnez pour chacun un exemple d’utilisateur, l’action principale et le résultat attendu afin d’établir un premier chiffrage."],
      ["Comment valider un projet entre la Belgique et la France ?", "L’accompagnement se fait à distance en français ou en anglais. Le devis en euros mentionne les conditions de facturation, les étapes d’essai et les frais externes envisagés. Précisez si l’application sera distribuée uniquement en Belgique ou dans d’autres boutiques."],
    ],
    faq: [["L’offre est-elle accessible depuis Bruxelles ?", "Oui. Les échanges et essais peuvent être organisés à distance pour les entreprises et les particuliers de Bruxelles comme de Wallonie."], ["Qui décide si l’application paraît sur les boutiques belges ?", "Le devis répartit la préparation des comptes, des fiches et des essais. Apple et Google examinent chacun la soumission selon leurs conditions."]],
  },
};

const en = {
  hub: {
    title: "Custom iOS and Android app development for businesses and individuals",
    description: "Work with Flex-Web in French or English on a mobile app for iOS and Android. Projects start at €1,990 including tax. See FootNation and request a quote.",
    intro: "Flex-Web builds mobile applications from Voglans, France, for businesses and individual founders. Both iOS and Android are included from €1,990 including tax. We run discovery, demos and acceptance sessions remotely in English or French.",
    sections: [
      ["What should the first release let someone do?", "Describe one user and one complete task. A field worker might record an inspection and send a report. A customer might open an app, find a service and request an appointment. These are scoping examples. The quote identifies the features needed for your own first release."],
      ["What happens between discovery and delivery?", "We map the screens, roles, data and integrations together. The written quote defines the agreed features, device tests, handover, responsibilities and schedule. You can use an acceptance scenario to decide when the first release does the job."],
      ["Can we work together across borders?", "We work remotely with people in France, Switzerland, Belgium and other French-speaking markets, including Quebec. Tell us the target countries, user languages, time zone and intended stores. The quote sets out the billing and distribution arrangements for your project."],
    ],
    faq: [["Does the starting price cover both platforms?", "Yes. The €1,990 tax-inclusive starting price covers a simple first release for iOS and Android together. The quote specifies features, store accounts, external fees and distribution."], ["When will I be able to test a build?", "After scoping, the quote sets out the schedule for test builds, the devices covered and the content or access you need to provide. Store review has its own timeline."]],
  },
  ios: {
    title: "Custom iOS application development for iPhone and iPad",
    description: "Scope and test your iPhone app with Flex-Web. Define device support, camera permissions, test builds and App Store responsibilities before ordering.",
    intro: "Start an iOS project by identifying the people who will use it and the iPhone or iPad they carry. Camera access, alerts and tablet layouts each need a specific use case and acceptance test.",
    sections: [
      ["Which devices and permissions matter?", "List the devices in use and what the person needs to do on each one. When someone attaches a photo, decide how they can replace it, complete the task without camera access or continue after losing their connection."],
      ["Who should try the first build?", "Choose people who perform the real task and give them a start point and an observable result. Test on the agreed phones or tablets, record failures and repeat the relevant scenarios before preparing a store submission."],
      ["What goes into App Store submission?", "The quote names the account holder and assigns preparation of screenshots, descriptions, declarations and submission. Account fees and work following an Apple review are discussed explicitly. Apple makes the publication decision."],
    ],
    faq: [["Can I see a published iOS example?", "FootNation is listed for iPhone and iPad under FLEX IMMO. Our case study walks through profiles, club discovery and messaging and links to the Apple listing."], ["Are tablet layouts included by default?", "Tell us which tablets and orientations you need. The quote records the supported displays and the tests you will use to accept the result."]],
  },
  android: {
    title: "Android app development for phones, tablets and field teams",
    description: "Plan your Android application around the devices, network conditions and distribution channels your users rely on. Get a scoped Flex-Web quote.",
    intro: "An Android project starts with the devices people already use. A personal phone, a workshop tablet and a managed field terminal have different screen, input and connectivity requirements.",
    sections: [
      ["What needs to work offline?", "A technician in a basement may need to open a job, enter readings and submit them later. Specify what is stored locally, what happens if two people edit the record and how the app confirms delivery. This determines the scope of offline support."],
      ["Which Android devices should we test?", "Share representative models, Android versions and required peripherals. The test plan can then cover layouts, permissions, interrupted tasks and differences between devices."],
      ["Should the app be distributed internally or on Google Play?", "Identify whether access is restricted to staff or open to the public. The quote specifies account ownership, distribution, listing materials and any fees. Google reviews applications submitted to Google Play."],
    ],
    faq: [["Can staff use their own phones?", "Device policies, supported versions and the type of data involved determine the deployment approach. Discuss these requirements with your IT team during scoping."], ["How do we budget an iPhone version alongside Android?", "The starting offer of €1,990 including tax covers both platforms. The quote sets out the functions, supported devices, tests and any third-party services."]],
  },
  businesses: {
    title: "Custom mobile applications for businesses and field teams",
    description: "Scope a field app, internal workflow or customer portal. Flex-Web works through roles, CRM integration and acceptance tests before quoting.",
    intro: "Choose one workflow where staff retype information, wait for an approval or lose track of attachments. A first mobile release can address that task with clear roles and an observable outcome.",
    sections: [
      ["How do you choose a useful first workflow?", "Follow a job from assignment through completion. Identify who assigns it, what the technician records and who checks the final report. An anonymised copy of the existing form is a practical input to discovery."],
      ["How will the app connect to an existing CRM?", "Identify the system of record for each field and who may change it. Provide available integration documentation and access to a test environment. Determine how the team should handle a missing record or an unavailable service."],
      ["How will the business accept delivery?", "Provide representative test accounts and a full workflow. For example, check that a technician sees only assigned jobs, completes a report and makes the result visible to a supervisor. Agree on these checks in the quote."],
    ],
    faq: [["Can we keep our current software?", "A first mobile interface can connect to existing tools when suitable data access and interfaces are available. We check these dependencies during discovery."], ["Can we start with a pilot team?", "Yes. Identify the group, the decisions its members can make and what a successful pilot looks like. Additional teams or workflows can be quoted separately after testing."]],
  },
  individuals: {
    title: "Bring your app idea to life as an individual founder",
    description: "Prepare a first mobile release even if you have never commissioned software. Flex-Web accepts personal projects, starting at €1,990 for iOS and Android.",
    intro: "You can request a quote in your own name. A useful first brief describes who opens the app, why they need it and what they should have achieved before they close it.",
    sections: [
      ["How do you reduce a long wish list?", "Write one short story with a beginning and an end. An example user browses an activity, checks its details and saves it for later. Put optional extras such as chat or rankings aside until you understand their role in that first experience."],
      ["What can you prepare without technical skills?", "A paper sketch, a few examples of content and a list of decisions the user makes are enough to start a conversation. Flag any moment where a login, payment or notification becomes essential, as each can affect the estimate."],
      ["Who will manage the app after launch?", "Ask the quote to identify account ownership, technical access, items handed over and maintenance arrangements. Decide who will answer users and who can update content once the first version is live."],
    ],
    faq: [["Do I need a company to request a quote?", "You can choose the individual option in the French quote form and describe your project. We discuss account and distribution requirements if you want to publish your app."], ["Does the starting offer cover a full social network?", "The starting offer covers a simple agreed scope. FootNation includes distinct features such as profiles, media, search and messaging. A project with that breadth needs its own estimate."]],
  },
  budget: {
    title: "How much does it cost to build an iOS and Android app?",
    description: "Flex-Web mobile development starts at €1,990 including tax for both platforms. Understand build costs, store accounts, hosting and optional maintenance.",
    intro: "A simple iOS and Android app starts at €1,990 including tax. A quote should connect the price to the functions you can test and the handover you will receive. Use the three published budget bands below to prepare your brief.",
    sections: [
      ["What changes the initial build cost?", "A directory with a detail view has different requirements from a secure account with payments and offline changes. Describe the roles, screens, external tools and exceptions. These details determine which features fit the first release."],
      ["What costs can recur after delivery?", "Ask for account fees, messaging providers, hosting and data storage to be listed separately where relevant. Monthly support packages are optional. The quote sets out which updates and ongoing tasks each party handles."],
      ["How do you compare two proposals?", "Use one realistic scenario across both quotes. Compare supported devices, tests, correction rounds, distribution and handover. Check which material you are expected to supply and how it affects milestones."],
    ],
    faq: [["Do I pay the starting price twice for two platforms?", "The starting price covers iOS and Android together. Your approved quote sets the final total and deliverables for the agreed scope."], ["Can a project be costed in stages?", "Yes. Define a first useful workflow and identify additions such as payments, translations or an administration interface as separate items."],],
  },
  compare: {
    title: "Web app, mobile app or desktop software: which fits your project?",
    description: "Compare web, mobile and desktop applications by user workflow, device access, connectivity and updates. Decide what belongs in your first release.",
    intro: "Start with where the task happens. Someone checking an occasional request, a technician working without a signal and an office team managing local files have different needs.",
    sections: [
      ["When is a web app a good fit?", "Opening a link works well for occasional use or access from different computers. Identify the browsers, screen sizes and authentication needs before designing your customer or employee portal."],
      ["When should you choose an installed mobile app?", "Repeated field tasks, quick data entry and phone hardware such as the camera can favour a mobile experience. Define how the app handles permissions, poor connectivity and interrupted work."],
      ["When does desktop software make sense?", "Local files, peripherals or managed Windows and macOS workstations can justify an installed desktop tool. Discuss installation rights, distribution, updates and backups with the people maintaining those machines."],
    ],
    faq: [["Can the same service use mobile and web interfaces?", "Yes. For example, technicians can work on a phone while managers review submissions in a browser. Specify the roles and shared data in the quote."], ["Does the mobile starting price include desktop software?", "The €1,990 starting offer covers iOS and Android. A custom web interface or installed desktop tool has its own scope and estimate."]],
  },
};

export const updated = '2026-11-23';
export const mobilePages = Object.entries(routes).flatMap(([id, alternates]) =>
  Object.entries(alternates).map(([lang, path]) => ({
    id, lang, path, alternates, kind: ['budget', 'compare'].includes(id) ? 'Article' : 'Service',
    ...(lang === 'fr' ? fr[id] : en[id]),
  }))
);

export const topicLabels = {
  fr: {hub:'Applications mobiles', ios:'Applications iOS', android:'Applications Android', businesses:'Pour les entreprises', individuals:'Pour les particuliers',budget:'Prix d’une application',compare:'Web, mobile ou logiciel installé',suisse:'Suisse romande',belgique:'Belgique francophone'},
  en: {hub:'Mobile app development',ios:'iOS apps',android:'Android apps',businesses:'Business apps',individuals:'Individual founders',budget:'App development costs',compare:'Web, mobile or desktop'},
};

export const relatedPages = (page) => {
  const related = {
    hub: ['businesses','individuals','ios','android','budget','compare','suisse','belgique'],
    ios:['android','budget','compare'], android:['ios','businesses','budget'],
    businesses:['android','compare','budget'], individuals:['ios','budget','compare'],
    budget:['businesses','individuals','compare'], compare:['ios','android','budget'],
    suisse:['budget','businesses','individuals','belgique'],belgique:['budget','businesses','individuals','suisse']
  };
  return related[page.id].map(id=>mobilePages.find(p=>p.id===id && p.lang===page.lang)).filter(Boolean);
};
