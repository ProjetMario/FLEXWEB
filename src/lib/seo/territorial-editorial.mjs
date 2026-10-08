// Hand-reviewed additions. A date here describes this dossier only; it must
// never refresh the publication dates of the whole generated catalogue.
const dossiers = {
  'sites:38247': {
    verifiedAt: '2026-10-08',
    title: 'Créer un site à Montalieu-Vercieu : du contact local à la demande de devis',
    seoTitle: 'Site internet à Montalieu-Vercieu : projet et devis',
    description: 'Préparez votre site à Montalieu-Vercieu : pages utiles, zone d’intervention, formulaire de devis et suivi client. Conseils concrets et sources locales.',
    introduction: 'Pour une entreprise à Montalieu-Vercieu, un site utile doit préciser ce que vous faites, où vous recevez ou intervenez et ce qu’un client doit transmettre pour obtenir une réponse. Voici un exemple de cadrage pour un artisan : coordonnées cohérentes, lieu réel du chantier et demande de devis exploitable.',
    heading: 'Montalieu-Vercieu : construire un parcours de devis qui distingue les lieux',
    answer: 'Affichez Montalieu-Vercieu et 38390 avec votre adresse professionnelle réelle. Dans une demande d’intervention, recueillez aussi le nom de la commune du chantier : le seul code postal 38390 ne suffit pas à identifier Montalieu-Vercieu. Le visiteur doit pouvoir demander un devis sans qu’une disponibilité ou une zone d’intervention soit confirmée automatiquement.',
    facts: [
      {
        text: 'La commune publie une liste de commerçants et artisans pour 2026. Si votre entreprise y figure, comparez son nom, son téléphone et son adresse avec les informations de votre propre site ; une incohérence peut rendre la prise de contact plus difficile.',
        source: 'https://www.montalieuvercieu.fr/fr/rb/873121/commercants-artisans',
        sourceLabel: 'Liste municipale des commerçants et artisans',
      },
      {
        text: 'L’Insee dénombre 103 établissements employeurs fin 2024 à Montalieu-Vercieu. Ce champ ne recense pas toutes les entreprises, notamment celles sans salarié ; il ne permet pas d’estimer combien souhaitent un site internet. Le dossier local sert à choisir les informations utiles au client, sans déduire une demande commerciale de ce chiffre.',
        source: 'https://www.insee.fr/fr/statistiques/1405599?geo=COM-38247',
        sourceLabel: 'Insee — Flores 2024, géographie au 1er janvier 2026',
      },
    ],
    pages: [
      ['Accueil', 'Expliquer le métier, montrer une réalisation autorisée et proposer une demande de devis. Nommer Montalieu-Vercieu seulement si votre entreprise y est implantée ou y intervient réellement.'],
      ['Prestations', 'Décrire les travaux réalisés et les informations nécessaires pour chiffrer : nature du besoin, dimensions connues et délai souhaité. Distinguer dépannage et projet planifié si ces services existent.'],
      ['Réalisations', 'Présenter vos propres photos et le périmètre livré, avec accord de publication. Ne pas attribuer à Montalieu-Vercieu un chantier effectué ailleurs.'],
      ['Intervention et accès', 'Séparer adresse de l’atelier, accueil sur rendez-vous et communes desservies. Préciser les restrictions réellement appliquées ; aucune carte ne doit laisser supposer une agence supplémentaire.'],
      ['Contact et devis', 'Demander les coordonnées de rappel, la commune du chantier et une description. Expliquer le prochain échange et afficher une confirmation uniquement lorsque la demande est enregistrée.'],
    ],
    cases: [
      ['Montalieu-Vercieu, 38390', 'Conserver la commune 38247 et le besoin saisi. Une personne vérifie la prestation et le créneau avant de promettre une intervention.'],
      ['Porcieu-Amblagnieu, 38390', 'Conserver Porcieu-Amblagnieu : le code postal partagé ne transforme pas ce chantier en demande située à Montalieu-Vercieu. Vérifier la desserte déclarée.'],
      ['Serrières-de-Briord, 01470', 'Conserver la commune de l’Ain. La proximité géographique ne suffit pas à confirmer que l’entreprise se déplace dans ce secteur.'],
      ['38390, commune non précisée', 'Enregistrer la demande à compléter et demander le nom du lieu. Ne pas choisir Montalieu-Vercieu par défaut.'],
    ],
    implementation: 'Le site peut transmettre ces champs à un dossier client : contact, lieu du projet, prestation, date souhaitée et prochaine action. Commencez par une tâche de qualification manuelle. Ajoutez ensuite une relance seulement lorsque son déclencheur, son arrêt après réponse et son responsable sont définis. Une adresse incomplète reste visible comme telle dans le CRM.',
    deliverables: 'Pour préparer un devis, fournissez votre identité professionnelle, cinq à dix photos publiables, la liste des prestations, les communes réellement desservies et la personne chargée des réponses. Ce scénario de cinq pages est une proposition de structure ; les mentions légales, le formulaire, les contenus et les éventuels outils sont précisés au devis.',
    checks: [
      'Sur téléphone, trouver la prestation puis envoyer une demande sans devoir appeler pour comprendre le formulaire.',
      'Saisir 38390 sans commune et vérifier qu’aucune desserte ni disponibilité n’est annoncée.',
      'Simuler un échec d’enregistrement : conserver les champs et proposer une nouvelle tentative sans annoncer que le devis a été reçu.',
      'Relire une demande venant de Porcieu-Amblagnieu et retrouver son lieu exact dans la fiche de suivi.',
    ],
    links: [
      {href: '/specialites/artisans/', label: 'Voir le parcours site et suivi client pour les artisans'},
      {href: '/outils/demo-crm/', label: 'Tester la démonstration de suivi d’une demande'},
      {href: '/realisations/serrurier73/', label: 'Consulter la réalisation Serrurier 73, distincte de cet exemple local'},
      {href: '/territoires/sites/porcieu-amblagnieu-38320/', label: 'Vérifier la fiche de Porcieu-Amblagnieu'},
      {href: '/territoires/sites/serrieres-de-briord-01403/', label: 'Vérifier la fiche de Serrières-de-Briord'},
    ],
  },
};

export const territorialDossier = (axis, code) => dossiers[`${axis}:${code}`];

export function territorialDossiersForDepartment(axis, communes) {
  return communes.flatMap(commune => {
    const dossier = territorialDossier(axis, commune.code);
    return dossier ? [{commune, dossier}] : [];
  });
}
