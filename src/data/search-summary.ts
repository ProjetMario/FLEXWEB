import { frenchWebAppGuides } from "./geo/web-app-pages";
import { crmPage, englishPages } from "./geo/pages";
import { geoUpdatedOn, offers, money as formattedMoney } from "./geo/site";
import { business } from "./business";

const money = (cents: number) => formattedMoney(cents).replace(/\u00a0/g, " ");

// One factual source for both legacy machine-readable summary URLs.
// These summaries are optional; they are not a Google ranking mechanism.
export const searchSummary = `# Flex-Web

> ${business.description}

Informations de service mises à jour le ${geoUpdatedOn}. Les dates de vérification des réalisations restent indiquées sur leurs fiches.

## Identité et contact
- Marque : Flex-Web, exploitée par Fleximmo.
- Adresse : 93 chemin de la Combe, 73420 Voglans, France.
- Téléphone : 07 57 83 02 62.
- E-mail : contact@flex-web.fr.
- Zone d’intervention : Savoie, Haute-Savoie ; accompagnement à distance partout en France.

## Services
- Automatisation de tâches avec l’IA : qualification des besoins, connexion des outils et du CRM, préparation de réponses et traitement de documents. Les contrôles, les accès et les coûts tiers sont définis au devis.
- Création de sites internet professionnels adaptés au mobile et aux demandes de contact.
- Développement d’applications web et mobiles sur mesure : espace client, réservation, outil interne ou SaaS.
- Référencement naturel, maintenance et accompagnement selon la prestation choisie.

## Tarifs publics
- Site vitrine jusqu’à 5 pages : ${money(offers.websites[0].setupCents)} TTC en paiement unique.
- Site de 5 pages et plus avec référencement SEO et IA (GEO) pour Google, Bing et les principaux moteurs : ${money(offers.websites[1].setupCents)} TTC en paiement unique. Le périmètre de pages est confirmé au devis ; le classement et les citations IA ne sont pas garantis.
- Installation d’un CRM, automatisation des tâches répétitives et mise en place d’un assistant IA interne à l’entreprise : ${money(offers.crm.setupCents)} TTC en paiement unique, pour les contacts, devis, factures et le suivi client définis au devis.
- Option maintenance, modifications et suivi du référencement : ${money(offers.websiteSupport.monthlyCents)} TTC par mois.
- Option de suivi du CRM, des automatisations, de l’assistant IA interne, du référencement et des dernières technologies (veille et recommandations) : ${money(offers.crmSupport.monthlyCents)} TTC par mois, distincte de l’installation.
- Automatisation IA sur mesure et applications : devis personnalisé.
- Le devis précise le périmètre, les limites, les taxes et les éventuels coûts de services tiers. Les options mensuelles ne sont pas obligatoires.
- Le calendrier dépend du projet et est fixé au devis après étude du besoin.

## Nature des exemples
Les scénarios présentés sont des démonstrations illustratives. Ils ne constituent pas des réalisations ou des résultats clients certifiés. Aucun classement Google, citation dans les réponses IA ou revenu n’est garanti.

## Réalisations documentées
- [Foot Nation : plateforme football](https://flex-web.fr/realisations/foot-nation/)
- [2 Savoie Immo : immobilier et estimation](https://flex-web.fr/realisations/2savoie-immo/)
- [Serrurier 73 : prestations artisanales](https://flex-web.fr/realisations/serrurier73/)
Les fonctionnalités publiques sont décrites sans attribuer de résultats commerciaux non mesurés.

## Spécialités métier
- [Sites, devis et automatisation pour artisans](https://flex-web.fr/specialites/artisans/)
- [Sites, CRM et automatisations pour l’immobilier](https://flex-web.fr/specialites/immobilier/)
- [Automatisation IA, CRM et applications pour entreprises de services](https://flex-web.fr/specialites/entreprises-services/)

## Ressources interactives
- [Calculateur de temps économisé](https://flex-web.fr/outils/calculateur-temps-economise/)
- [Démonstration CRM : demandes, relances et devis](https://flex-web.fr/outils/demo-crm/)

## Pages principales
- [CRM et automatisation pour entreprise](https://flex-web.fr/crm-automatisation-entreprise/)
- [Automatisation IA en France](https://flex-web.fr/automatisation-ia/)
- [Automatisation IA en Savoie](https://flex-web.fr/automatisation-ia-savoie/)
- [Automatisation IA en Haute-Savoie](https://flex-web.fr/automatisation-ia-haute-savoie/)
- [Création de sites internet](https://flex-web.fr/creation-site-internet/)
- [Applications web et mobiles](https://flex-web.fr/creation-application-mobile/)
- [Tarifs et devis](https://flex-web.fr/pricing/)
- [À propos](https://flex-web.fr/about/)
- [Contact](https://flex-web.fr/contact/)
- [Guides](https://flex-web.fr/journal/)
- [Mentions légales](https://flex-web.fr/mentions-legales/)

## English
${englishPages.map(page => `- [${page.title}](https://flex-web.fr${page.path})`).join("\n")}

## Guides pratiques
- [Préparer un projet de site internet](https://flex-web.fr/guides/preparer-projet-site-internet/)
- [Préparer un projet d’application web ou mobile](https://flex-web.fr/guides/preparer-projet-application-mobile/)
- [Assistant IA interne : usages, documents et tests dans une PME](https://flex-web.fr/journal/assistant-ia-interne-entreprise/)
- [Combien coûte un site internet en Savoie ?](https://flex-web.fr/journal/combien-coute-site-internet-savoie/)
- [Quelles tâches automatiser dans une PME ?](https://flex-web.fr/journal/taches-automatiser-pme/)
- [Relancer les devis avec des règles d’arrêt](https://flex-web.fr/ressources/automatisation/relance-devis/)
- [Connecter ses demandes à un CRM](https://flex-web.fr/journal/connecter-demandes-crm/)
- [Automatisation ou application sur mesure ?](https://flex-web.fr/journal/automatisation-ou-application-sur-mesure/)
`;

// The detailed optional summary is generated from the same content as the
// public HTML. No private records, claims of endorsement or hidden prompts.
export const fullSearchSummary = searchSummary + `
## Responsabilité, délais et international
Flex-Web est la marque commerciale de Fleximmo. Le devis précise qui valide les accès, les règles métier et les livrables. Le calendrier dépend du périmètre, des données et des tests ; il est confirmé avant commande. Pour une demande hors de France, la langue de travail, les horaires, les taxes et les services disponibles sont étudiés avant accord. Aucun établissement étranger n’est revendiqué.

## Technologies et limites
Les connexions passent par les API, formulaires ou webhooks disponibles dans les outils retenus. Le site public utilise Astro. Le choix d’un CRM, d’un modèle IA et des services tiers dépend des besoins, des droits d’accès et des coûts confirmés au devis. Un assistant doit pouvoir citer une source autorisée, signaler une information absente et transmettre les décisions engageantes à une personne. Ces textes ne déclarent aucun partenariat ou certification fournisseur.

## Documentation détaillée des offres et parcours
` + [crmPage, ...frenchWebAppGuides, ...englishPages].map(page => [
  `# ${page.title}`,
  `Source: https://flex-web.fr${page.path}`,
  `Language: ${page.lang} · Updated: ${geoUpdatedOn}`,
  page.answer,
  ...page.sections.flatMap(section => [
    `## ${section.title}`,
    ...(section.paragraphs || []),
    ...(section.items || []).map(item => `- ${item}`),
    ...(section.table ? [section.table.caption, section.table.columns.join(' | '), ...section.table.rows.map(row => row.join(' | '))] : []),
    ...(section.links || []).map(link => `- [${link.label}](${link.href.startsWith('/') ? 'https://flex-web.fr' + link.href : link.href})`),
  ]),
  ...page.faq.flatMap(item => [`## ${item.question}`, item.answer]),
].join('\n\n')).join('\n\n') + '\n';
