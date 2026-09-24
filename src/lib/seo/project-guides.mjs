/**
 * Scénarios de cadrage éditorial : recommandations, jamais résultats clients.
 * Ils servent à expliquer des besoins distincts ; leur simple réemploi ne rend
 * pas une page territoriale originale ni automatiquement publiable pour le SEO.
 */
export const projectGuides = {
  sites: [
    {
      id: 'devis-prestation',
      title: 'Transformer une demande de prestation en dossier exploitable',
      need: "Une entreprise de services reçoit des demandes trop vagues pour répondre sans plusieurs échanges. Son site doit présenter ce qu’elle réalise, préciser ses critères d’intervention et recueillir les informations utiles au premier diagnostic. Le formulaire prépare la discussion ; il ne remplace pas une évaluation technique lorsque celle-ci est nécessaire.",
      inputs: [
        "Prestations, exclusions et questions habituelles avant un devis.",
        "Zones d’intervention confirmées, photos autorisées et exemples de livrables dont l’entreprise peut expliquer la réalisation.",
        "Personne responsable des demandes et fonctionnement prévu lorsque celle-ci est absente."
      ],
      steps: [
        "Organiser les pages autour de besoins clients distincts et expliquer le déroulement d’une intervention.",
        "Construire un formulaire progressif : prestation, description, lieu du besoin et moyen de rappel. Ne demander une pièce jointe que si elle aide réellement à qualifier le projet.",
        "Afficher une confirmation claire puis transmettre les réponses dans une fiche avec une prochaine action identifiable."
      ],
      checks: [
        "Une personne extérieure comprend ce qui est proposé et ce qui reste à confirmer.",
        "Tester une demande complète, un champ incorrect et une indisponibilité de l’envoi, notamment sur téléphone."
      ],
      metric: "Suivre les demandes reçues, leur qualification réelle et les dossiers nécessitant un complément ; distinguer les formulaires envoyés des devis acceptés.",
      example: "Exemple illustratif : une demande de remplacement d’équipement indique le type d’installation et propose une photo facultative ; le professionnel confirme ensuite la faisabilité.",
      limits: [
        "Un formulaire ne doit pas promettre un prix ou un délai non confirmé.",
        "Ajouter des champs sans usage identifié peut compliquer inutilement la prise de contact."
      ]
    },
    {
      id: 'catalogue-professionnel',
      title: 'Présenter un catalogue professionnel sans inventer une boutique',
      need: "Un fabricant, distributeur ou prestataire technique propose des références dont le choix dépend de dimensions, d’options ou d’un contexte d’utilisation. Un catalogue consultable permet au visiteur de comparer les caractéristiques utiles et d’envoyer une demande précise, même lorsque la vente ne peut pas être finalisée en ligne.",
      inputs: [
        "Références à jour, familles de produits et caractéristiques fournies ou validées par le responsable technique.",
        "Documents, visuels autorisés et règles de publication des prix ou disponibilités.",
        "Questions permettant de distinguer une demande de documentation, une recherche de compatibilité et un projet d’achat."
      ],
      steps: [
        "Définir des catégories compréhensibles pour les clients, puis choisir les filtres correspondant à de vraies différences entre références.",
        "Créer des fiches avec caractéristiques, usages prévus, limites connues et documents identifiables par leur version.",
        "Préremplir la référence choisie dans la demande et permettre au visiteur d’expliquer son application sans perdre sa sélection."
      ],
      checks: [
        "Comparer plusieurs fiches à leur documentation source et vérifier l’absence de caractéristiques supposées.",
        "Tester les filtres sans résultat, la navigation mobile et la mise à jour d’une référence retirée."
      ],
      metric: "Mesurer les consultations de fiches suivies d’une demande exploitable et les demandes portant sur des références obsolètes ; documenter les critères de qualification.",
      example: "Exemple illustratif : un acheteur sélectionne deux composants, joint ses contraintes et demande une confirmation de compatibilité avant d’obtenir une proposition.",
      limits: [
        "La disponibilité affichée exige une source entretenue ; une absence de donnée ne signifie pas un produit en stock.",
        "Une fiche descriptive ne remplace pas une validation technique spécifique."
      ]
    },
    {
      id: 'rendez-vous-service',
      title: 'Préparer une prise de rendez-vous compréhensible',
      need: "Une activité reposant sur un premier entretien veut rendre la prise de contact plus simple. Le site explique à qui s’adresse le rendez-vous, ce qui sera abordé et comment préparer l’échange. Selon l’organisation disponible, il peut afficher des créneaux réellement synchronisés ou recueillir des préférences à confirmer.",
      inputs: [
        "Types de rendez-vous, durée prévue, modalités à distance ou sur place et informations de préparation utiles.",
        "Calendrier de référence, plages d’ouverture et personne chargée de confirmer les demandes.",
        "Règles pratiques de modification, d’annulation et de traitement d’une demande hors créneau."
      ],
      steps: [
        "Présenter le résultat attendu du premier échange sans laisser croire qu’une prestation complète sera réalisée pendant celui-ci.",
        "Permettre le choix du motif et du format, puis demander seulement les informations nécessaires à l’accueil.",
        "Afficher clairement si le créneau est réservé ou simplement demandé ; envoyer une confirmation contenant les éléments utiles pour participer."
      ],
      checks: [
        "Tester deux visiteurs demandant le même créneau et vérifier la gestion d’un calendrier indisponible.",
        "Contrôler les heures affichées, l’accès au lien de participation et le parcours de modification sur mobile."
      ],
      metric: "Comparer demandes, rendez-vous confirmés et rendez-vous effectivement tenus ; analyser séparément les annulations et les absences documentées.",
      example: "Exemple illustratif : un dirigeant choisit un entretien de découverte à distance et reçoit les trois questions à préparer avant l’appel.",
      limits: [
        "Sans calendrier fiable, afficher une demande de créneau plutôt qu’une réservation garantie.",
        "Une confirmation automatique doit rester cohérente avec les disponibilités de la personne qui assure le rendez-vous."
      ]
    },
    {
      id: 'activites-distinctes',
      title: 'Rendre lisibles plusieurs prestations sur un même site',
      need: "Une entreprise exerce plusieurs activités et constate que ses visiteurs ne savent pas laquelle correspond à leur besoin. Le site doit guider ce choix sans multiplier des pages quasi identiques. Chaque prestation mérite une page lorsqu’elle comporte un périmètre, un déroulement ou des critères de décision réellement distincts.",
      inputs: [
        "Liste des activités, demandes fréquentes et différences concrètes entre les prestations.",
        "Conditions d’intervention, personnes compétentes et preuves propres à chaque activité.",
        "Vocabulaire utilisé par les clients et exemples de demandes mal orientées, rendus anonymes."
      ],
      steps: [
        "Regrouper les prestations proches, puis organiser l’entrée du site autour des situations rencontrées par les visiteurs.",
        "Rédiger pour chaque activité son objectif, ses livrables, ses prérequis et la manière dont elle se distingue des autres.",
        "Conserver le choix de prestation dans le formulaire et prévoir une option permettant d’être orienté lorsque le visiteur hésite."
      ],
      checks: [
        "Faire chercher plusieurs prestations à une personne qui ne connaît pas l’entreprise et observer ses hésitations.",
        "Vérifier que les intitulés du menu, des pages et du récapitulatif de demande restent cohérents."
      ],
      metric: "Suivre la prestation sélectionnée, les demandes réorientées et les incompréhensions signalées pendant les échanges commerciaux, sans déduire une intention d’achat d’un simple clic.",
      example: "Exemple illustratif : une société distingue maintenance, remplacement et étude préalable ; chaque page explique les informations nécessaires pour commencer.",
      limits: [
        "Une nouvelle page ne se justifie pas uniquement par un synonyme ou un nom de ville.",
        "Le site doit refléter les capacités réelles de l’équipe et rester facile à mettre à jour."
      ]
    },
    {
      id: 'realisations-documentees',
      title: 'Expliquer des réalisations avec des preuves vérifiables',
      need: "Un visiteur souhaite comprendre la manière de travailler d’une entreprise avant de la contacter. Une réalisation documentée décrit le besoin, les contraintes, les choix et le livrable. Elle gagne en utilité lorsqu’elle aide le lecteur à reconnaître un projet comparable, sans transformer une illustration en promesse de résultat.",
      inputs: [
        "Projets et visuels publiables, avec un interlocuteur capable de vérifier le récit.",
        "Périmètre réalisé, contraintes rencontrées et rôle de l’entreprise.",
        "Éventuels résultats documentés, avec leur période, leur méthode de mesure et les réserves nécessaires."
      ],
      steps: [
        "Choisir des réalisations qui répondent à des questions différentes, puis raconter chaque projet selon son problème initial.",
        "Présenter les décisions, les étapes et le livrable à l’aide d’images légendées ou de documents expurgés des informations confidentielles.",
        "Relier la réalisation à la prestation correspondante et proposer au visiteur de décrire les particularités de son propre besoin."
      ],
      checks: [
        "Faire valider les faits, les autorisations de publication et la distinction entre travail réalisé et intervention d’un partenaire.",
        "Contrôler la lisibilité des images et remplacer toute statistique dont la source ne peut pas être retrouvée."
      ],
      metric: "Observer les consultations de réalisations précédant une demande et demander aux prospects quels exemples les ont aidés ; conserver ces deux observations séparées.",
      example: "Exemple illustratif : une fiche montre comment une navigation complexe a été réorganisée, avec les contraintes initiales et les écrans livrés, sans annoncer un gain commercial non mesuré.",
      limits: [
        "Un exemple fictif doit être explicitement présenté comme illustratif.",
        "Le résultat d’un projet ne garantit pas celui d’un autre client."
      ]
    },
    {
      id: 'refonte-parcours',
      title: 'Refondre un site en préservant ses accès utiles',
      need: "Une entreprise souhaite moderniser son site en conservant les pages, documents et parcours utiles. La refonte commence par un inventaire. Elle distingue ce qui doit être conservé, amélioré, regroupé ou retiré avant de modifier la navigation et les adresses.",
      inputs: [
        "URL, fichiers, formulaires et services connectés accessibles.",
        "Données de visites, demandes et liens entrants, avec leurs limites.",
        "Contenus à conserver, responsable de leur validation et accès nécessaires à l’hébergement et aux mesures."
      ],
      steps: [
        "Associer chaque ancienne page à une destination pertinente ; conserver son adresse lorsque la modification n’apporte aucun avantage clair.",
        "Préparer la nouvelle navigation et une table de redirections pour les adresses qui changent, sans envoyer toutes les anciennes pages vers l’accueil.",
        "Tester le site sur un aperçu, puis contrôler les formulaires, les pages importantes et les redirections après publication."
      ],
      checks: [
        "Vérifier les réponses des URL, les liens internes, les adresses canoniques et le contenu réel du sitemap.",
        "Comparer avant et après les parcours qui apportaient des demandes ; documenter la date des changements et les erreurs observées."
      ],
      metric: "Suivre les erreurs d’accès, les demandes confirmées et les performances des pages conservées sur des périodes comparables, en tenant compte des changements de mesure.",
      example: "Exemple illustratif : une ancienne page de prestation garde son adresse, tandis que deux articles redondants sont réunis vers un contenu plus complet.",
      limits: [
        "Une migration technique réussie ne garantit pas le maintien d’un classement dans les moteurs.",
        "Une redirection doit conduire vers un contenu pertinent, pas seulement vers une page disponible."
      ]
    }
  ],
  automatisation: [
    {
      id: 'qualification-demandes',
      title: 'Qualifier les demandes entrantes avant leur traitement',
      need: "Une entreprise reçoit des demandes par formulaire et par e-mail, puis ressaisit les coordonnées dans plusieurs outils. Un premier automatisme peut centraliser les informations, repérer les dossiers incomplets et proposer une catégorie. L’IA peut aider à lire un texte libre, tandis que les règles déterministes contrôlent les champs obligatoires et les destinations.",
      inputs: [
        "Sources autorisées, champs utiles et catégories comprises par l’équipe.",
        "Exemples anonymisés de demandes complètes, ambiguës et hors périmètre.",
        "Règles de rapprochement des contacts et responsable des cas nécessitant une vérification."
      ],
      steps: [
        "Enregistrer chaque réception avec un identifiant, sa source et son état de traitement avant toute action ultérieure.",
        "Extraire les informations présentes, conserver le message original et signaler les données manquantes sans les inventer.",
        "Proposer une catégorie et une prochaine action ; envoyer les cas incertains dans une file à vérifier avant de déclencher une réponse."
      ],
      checks: [
        "Tester un message reçu deux fois, deux entreprises portant un nom proche et une pièce jointe illisible.",
        "Vérifier qu’une mauvaise catégorie peut être corrigée et que cette correction reste visible dans l’historique."
      ],
      metric: "Mesurer la part de dossiers correctement orientés après vérification et le temps de traitement observé ; compter séparément les erreurs et les reprises manuelles.",
      example: "Exemple illustratif : un e-mail décrivant une refonte crée un contact et un dossier à qualifier, avec un avertissement lorsque l’adresse du site existant manque.",
      limits: [
        "Une classification proposée par l’IA reste une hypothèse à contrôler.",
        "Le système ne doit pas fusionner des contacts sur la seule similitude de leur nom."
      ]
    },
    {
      id: 'suivi-devis',
      title: 'Organiser les relances de devis selon leur état réel',
      need: "Des devis envoyés restent sans prochaine action clairement définie. Une automatisation peut préparer des relances à partir de la date d’envoi et de l’état du dossier. Elle doit tenir compte des réponses, des acceptations et des demandes d’arrêt avant de proposer ou d’exécuter un nouvel envoi.",
      inputs: [
        "Source fiable des devis, dates, versions et états d’acceptation ou de refus.",
        "Cadence choisie, modèles de messages et interlocuteur de chaque dossier.",
        "Canaux utilisés pour recevoir les réponses et règles de suspension lorsqu’un échange reprend."
      ],
      steps: [
        "Créer une prochaine action à partir d’un devis effectivement envoyé, avec une référence et un destinataire vérifiés.",
        "Avant chaque relance, relire l’état du devis et de la conversation ; suspendre la séquence lorsqu’une réponse exige un traitement humain.",
        "Conserver l’historique des tentatives et distinguer un message préparé, transmis au fournisseur et confirmé par celui-ci."
      ],
      checks: [
        "Simuler une acceptation juste avant la relance, une panne du fournisseur et une confirmation d’envoi reçue tardivement.",
        "Vérifier qu’une reprise après incident ne produit pas un deuxième envoi du même message."
      ],
      metric: "Suivre les devis sans prochaine action, les réponses reçues et les relances suspendues ; ne pas attribuer automatiquement une vente à la dernière relance.",
      example: "Exemple illustratif : une relance préparée pour jeudi est annulée mercredi lorsque le client répond avec une question sur le périmètre.",
      limits: [
        "Une réponse reçue dans une boîte non synchronisée ne peut pas suspendre fiablement la séquence.",
        "Une relance ne doit pas modifier le montant ni les conditions d’un devis déjà envoyé."
      ]
    },
    {
      id: 'suivi-factures',
      title: 'Préparer le suivi des factures à partir des paiements confirmés',
      need: "Une équipe suit ses factures dans un tableau et vérifie manuellement les encaissements avant de relancer. Un automatisme peut rapprocher les informations disponibles et préparer les actions à effectuer. Il doit conserver une distinction nette entre paiement attendu, opération détectée et règlement effectivement confirmé par la source de référence.",
      inputs: [
        "Factures identifiées, échéances enregistrées et contacts chargés du règlement.",
        "Source autorisée des confirmations de paiement et règles de rapprochement vérifiables.",
        "Procédure pour les paiements partiels, avoirs, litiges et références manquantes."
      ],
      steps: [
        "Importer les états sans écraser les documents d’origine et enregistrer la date de la dernière synchronisation.",
        "Rapprocher les paiements lorsque les références le permettent ; placer les correspondances ambiguës dans une file de vérification.",
        "Préparer un rappel factuel uniquement pour les dossiers dont l’état a été contrôlé, puis relire cet état au moment de l’envoi."
      ],
      checks: [
        "Tester un paiement partiel, deux versements de même montant et une confirmation reçue après la préparation du rappel.",
        "Contrôler le comportement lorsqu’un accès bancaire ou un outil de facturation devient temporairement indisponible."
      ],
      metric: "Compter les rapprochements confirmés, les cas ambigus et les rappels évités après actualisation ; distinguer les sommes attendues des montants réellement encaissés.",
      example: "Exemple illustratif : un versement sans référence est signalé à l’équipe ; aucun rappel n’est envoyé automatiquement tant que le dossier reste ambigu.",
      limits: [
        "Un montant identique ne suffit pas à prouver qu’un paiement correspond à une facture.",
        "Les décisions comptables et les dossiers contestés restent soumis à la validation des personnes compétentes."
      ]
    },
    {
      id: 'coordination-rendez-vous',
      title: 'Synchroniser rendez-vous, rappels et dossiers clients',
      need: "Les rendez-vous sont saisis dans un agenda, tandis que leurs coordonnées et leur contexte restent dans les e-mails. L’automatisation peut relier une réservation au dossier concerné, préparer un rappel et transmettre les informations nécessaires à l’intervenant. Une modification doit se répercuter dans tous les éléments dépendants.",
      inputs: [
        "Agenda de référence, types de rendez-vous, durée et règles de disponibilité.",
        "Coordonnées confirmées, contexte utile à l’échange et canal choisi pour les rappels.",
        "Modalités de modification et d’annulation, avec une personne responsable en cas d’incident."
      ],
      steps: [
        "Créer le rendez-vous avec un identifiant partagé entre l’agenda et le dossier client, puis enregistrer son état confirmé.",
        "Préparer le rappel à partir de cet état et vérifier de nouveau l’heure, le lieu ou le lien de participation avant transmission.",
        "Lors d’un report, annuler les rappels devenus obsolètes, actualiser les informations et conserver une trace du changement."
      ],
      checks: [
        "Tester une annulation après programmation, un changement de fuseau et deux notifications de modification identiques.",
        "Vérifier qu’une panne de synchronisation apparaît dans une file d’erreurs avec une action de reprise compréhensible."
      ],
      metric: "Comparer rendez-vous confirmés, rappels effectivement transmis, annulations et rendez-vous tenus ; ne pas présenter une transmission comme une lecture.",
      example: "Exemple illustratif : un entretien déplacé de mardi à jeudi met à jour la fiche et remplace le rappel initial par un rappel lié au nouveau créneau.",
      limits: [
        "Un agenda non synchronisé ne peut pas garantir l’absence de conflit.",
        "Le rappel doit contenir uniquement les informations utiles au rendez-vous et vérifiées dans le dossier."
      ]
    },
    {
      id: 'lecture-documents',
      title: 'Extraire des données de documents avec contrôle des écarts',
      need: "Une entreprise ressaisit les informations de bons, formulaires ou documents reçus. Un traitement peut extraire les champs et préparer leur intégration. La qualité dépend du document, de sa lisibilité et des contrôles ; une valeur illisible doit rester inconnue plutôt qu’être complétée par supposition.",
      inputs: [
        "Documents acceptés, champs à extraire et destination des informations.",
        "Échantillons anonymisés comprenant des scans illisibles et des formats inhabituels.",
        "Règles de validation, droits d’accès et procédure de traitement des documents rejetés."
      ],
      steps: [
        "Identifier le document reçu, vérifier son format et conserver un lien vers la source accessible aux personnes autorisées.",
        "Extraire les champs en associant chaque valeur à son emplacement lorsque l’outil le permet ; signaler les absences et incohérences.",
        "Présenter une comparaison avec l’original pour les cas à vérifier, puis enregistrer les corrections avant tout transfert vers l’outil métier."
      ],
      checks: [
        "Tester des séparateurs décimaux différents, plusieurs dates, des pages manquantes et un document reçu deux fois.",
        "Contrôler les résultats sur un ensemble distinct des exemples ayant servi au paramétrage."
      ],
      metric: "Mesurer la justesse des champs, les corrections et les documents à reprendre ; éviter un score global masquant les erreurs critiques.",
      example: "Exemple illustratif : un bon de commande fournit une référence lisible mais une quantité incertaine ; le système prépare le dossier et demande une vérification avant intégration.",
      limits: [
        "L’IA peut confondre des caractères ou interpréter une mise en page inhabituelle.",
        "Le contenu d’un document reçu constitue une donnée à traiter, pas une instruction autorisant des actions dans les outils."
      ]
    },
    {
      id: 'assistance-reponses',
      title: 'Préparer des réponses à partir d’informations approuvées',
      need: "Une équipe répond souvent aux mêmes questions mais doit adapter chaque message. Un assistant prépare un brouillon à partir du message reçu, des éléments autorisés du dossier et d’une documentation validée. L’utilisateur conserve la main sur les engagements et les réponses nécessitant une décision.",
      inputs: [
        "Questions fréquentes, documentation actualisée et formulations approuvées.",
        "Données utiles à la réponse, accessibles aux seules personnes et traitements concernés.",
        "Sujets imposant une validation et règles pour signaler une information absente."
      ],
      steps: [
        "Identifier la demande et rechercher les éléments de réponse dans les sources approuvées, en conservant leur référence.",
        "Produire un brouillon distinguant les informations établies des questions à poser ; ne pas inventer de disponibilité, de prix ou de résultat.",
        "Présenter le brouillon avec son contexte à la personne responsable, puis enregistrer la version réellement validée et l’état de sa transmission."
      ],
      checks: [
        "Tester une question sans réponse documentée, des informations contradictoires et un message tentant de modifier les règles de l’assistant.",
        "Vérifier qu’aucun contenu provenant d’un autre client n’apparaît dans le brouillon ou ses pièces jointes."
      ],
      metric: "Suivre les brouillons acceptés, corrigés ou rejetés, les motifs de correction et le temps de relecture observé ; mesurer séparément l’envoi et la réponse du destinataire.",
      example: "Exemple illustratif : après une demande de démonstration, l’assistant propose une réponse et invite à choisir un créneau disponible dans l’agenda confirmé.",
      limits: [
        "Une réponse fluide peut contenir une erreur ; la documentation et la relecture restent nécessaires.",
        "Préparer une réponse ne constitue pas une autorisation générale d’envoyer des messages."
      ]
    }
  ]
};
