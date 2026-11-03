import { websiteOffers, pricingOptions } from '../pricing';
import { business } from '../business';
import type { GeoPage } from './site';

type AcquisitionPage = GeoPage & { updatedOn: string; breadcrumbLabel: string };
const essential = websiteOffers.find(offer => offer.id === 'essentielle')!;
const visibility = websiteOffers.find(offer => offer.id === 'visibilite')!;
const maintenance = pricingOptions.find(option => option.id === 'maintenance')!;
const price = (cents: number, lang: 'fr' | 'en') => new Intl.NumberFormat(lang === 'fr' ? 'fr-FR' : 'en-GB', {
  style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
}).format(cents / 100);
const basicFr = `${price(essential.setupCents, 'fr')} TTC`;
const visibilityFr = `${price(visibility.setupCents, 'fr')} TTC`;
const supportFr = `${price(maintenance.monthlyCents, 'fr')} TTC/mois`;
const basicEn = `${price(essential.setupCents, 'en')} including French taxes`;
const visibilityEn = `${price(visibility.setupCents, 'en')} including French taxes`;
const supportEn = `${price(maintenance.monthlyCents, 'en')}/month including French taxes`;
const email = (subject: string) => `mailto:${business.email}?subject=${encodeURIComponent(subject)}`;
const updatedOn = '2026-11-03';

export const frenchAcquisitionPages: AcquisitionPage[] = [
  {
    path: '/creation-site-internet-pas-cher/', lang: 'fr', kind: 'service', service: 'site', updatedOn,
    breadcrumbLabel: 'Site internet à petit budget',
    title: `Site internet pas cher : un site vitrine à ${basicFr}`,
    description: `Un site vitrine jusqu’à 5 pages à ${basicFr} avec Flex-Web. Découvrez les fonctions incluses, les frais à prévoir et les limites avant de demander un devis.`,
    answer: `Flex-Web propose un site vitrine jusqu’à 5 pages à ${basicFr}, en paiement unique après validation du devis. L’offre comprend un affichage adapté aux mobiles, un formulaire de contact et les réglages SEO de base au lancement. Le domaine, l’hébergement et les besoins supplémentaires sont précisés séparément au devis. Basé à Voglans en Savoie, le studio accompagne entreprises et particuliers en France et en Suisse.`,
    sections: [
      {
        title: 'Quel projet peut tenir dans un petit budget ?',
        paragraphs: [
          'Un site vitrine présente une activité ou un projet et permet de prendre contact. Le budget reste maîtrisable lorsque les pages, les contenus et les fonctions attendues sont clairement définis. Une application avec comptes clients, paiements ou règles métier demande un autre périmètre.',
          'Exemple illustratif : un artisan peut prévoir une page d’accueil, ses prestations, sa zone d’intervention, ses réalisations et un contact. Cette liste n’est pas obligatoire : nous retenons avec vous les pages utiles. Pour un particulier, décrivez ce que vous souhaitez présenter et l’action attendue du visiteur.',
        ],
      },
      {
        title: `Que comprend le site à ${basicFr} ?`,
        items: [...essential.features],
        paragraphs: ['Le devis fixe la liste des pages et des fonctions, les contenus à fournir et les validations prévues. Il précise aussi le calendrier et les corrections comprises. Une fonction supplémentaire doit être chiffrée avant votre accord.'],
      },
      {
        title: 'Quels frais faut-il comparer avant de choisir ?',
        table: {
          caption: 'Le prix de création et les coûts de fonctionnement doivent être distingués dans le devis.',
          columns: ['Poste', 'Ce qui est annoncé', 'À vérifier pour votre projet'],
          rows: [
            ['Création du site vitrine', `${basicFr}, paiement unique`, 'Jusqu’à 5 pages et fonctions prévues au devis.'],
            ['Nom de domaine et hébergement', 'Précisés séparément au devis', 'Coût initial, renouvellement, titulaire du domaine et accès.'],
            ['Textes, photos et fonctions supplémentaires', 'Périmètre et éventuel coût à confirmer', 'Ce que vous fournissez et ce que Flex-Web doit produire.'],
            ['Maintenance et modifications', `${supportFr}, option facultative`, 'Interventions, limites et conditions du suivi choisi.'],
            ['Licences ou services tiers', 'Selon les outils retenus', 'Abonnements ou consommations à prévoir avant accord.'],
          ],
        },
        paragraphs: ['Le domaine est enregistré à votre nom. Un petit prix de création ne signifie pas que tous les renouvellements ou tous les développements futurs sont inclus. Les options mensuelles de Flex-Web ne sont pas ajoutées automatiquement.'],
      },
      {
        title: `Quelle différence avec l’offre à ${visibilityFr} ?`,
        paragraphs: [
          `Le site à ${basicFr} répond à un besoin de présentation avec les réglages SEO de base. L’offre à ${visibilityFr} prévoit un site de 5 pages et plus, selon le périmètre du devis, avec un travail sur la structure, les contenus et les données structurées pour le référencement naturel et la recherche par IA.`,
          'Le choix dépend des informations à présenter et du travail de visibilité attendu. Aucune formule ne garantit une position sur Google ou une citation dans ChatGPT, Gemini, Claude ou un autre assistant. Le contenu doit expliquer votre activité avec des informations vérifiables.',
        ],
        links: [{ label: 'Comparer les prestations de création de site', href: '/creation-site-internet/' }, { label: 'Consulter les tarifs et les options', href: '/pricing/' }],
      },
      {
        title: 'Comment préparer une demande de devis utile ?',
        items: [
          'Indiquez si le projet concerne une entreprise ou un particulier, ainsi que votre pays.',
          'Décrivez ce que le visiteur doit comprendre ou faire : appeler, envoyer une demande ou consulter votre travail.',
          'Listez les pages envisagées, les textes et les images disponibles.',
          'Signalez un domaine, un ancien site et les URL à conserver, le cas échéant.',
          'Précisez votre budget et votre échéance souhaitée ; le calendrier réalisable sera confirmé au devis.',
        ],
        paragraphs: ['La demande de devis est gratuite et n’est pas une commande. Flex-Web, marque de Fleximmo, définit le périmètre avec vous. Vous validez les contenus, les accès et le résultat avant la publication convenue. Les échanges peuvent se faire en français ou en anglais.'],
        links: [{ label: 'Préparer les contenus de votre site', href: '/guides/preparer-projet-site-internet/' }],
      },
      {
        title: 'Quel exemple de site peut-on consulter ?',
        paragraphs: ['La fiche Serrurier 73 décrit des prestations, une zone d’intervention et un parcours de contact visibles sur le site public. Elle permet d’examiner un exemple de présentation artisanale. Elle ne prouve pas que ce projet a été réalisé au prix de cette offre, ni qu’il a obtenu un résultat commercial chiffré.'],
        links: [{ label: 'Examiner la réalisation Serrurier 73', href: '/realisations/serrurier73/' }],
      },
      {
        title: 'Et si le projet a besoin d’un CRM, d’une application ou d’IA ?',
        paragraphs: ['Un site de présentation peut être la première étape. Le suivi des demandes dans un CRM, une connexion à un logiciel ou une application avec comptes utilisateurs sont étudiés séparément. Une automatisation IA peut produire une réponse inexacte ; les accès, contrôles humains et reprises manuelles doivent être définis avant sa mise en service.'],
        links: [{ label: 'CRM et automatisation pour entreprise', href: '/crm-automatisation-entreprise/' }, { label: 'Applications web et mobiles sur mesure', href: '/creation-application-mobile/' }],
      },
    ],
    faq: [
      { question: 'Un site internet pas cher peut-il être adapté aux téléphones ?', answer: `Oui. L’offre de site vitrine à ${basicFr} comprend l’affichage adapté aux téléphones et aux ordinateurs. Les pages et le parcours de contact sont vérifiés avant la publication prévue au devis.` },
      { question: `Le nom de domaine et l’hébergement sont-ils compris dans les ${price(essential.setupCents, 'fr')} ?`, answer: 'Ils sont précisés séparément au devis, avec leurs éventuels coûts récurrents. Le devis doit permettre de distinguer le prix de création, les renouvellements et les options retenues.' },
      { question: 'Faut-il payer un abonnement tous les mois ?', answer: `Les options Flex-Web sont facultatives. La maintenance, les modifications et le suivi du référencement à ${supportFr} sont distincts du prix de création. Le domaine, l’hébergement ou des outils tiers peuvent néanmoins avoir des frais récurrents indiqués au devis.` },
      { question: 'Puis-je commander comme particulier ?', answer: 'Oui. Décrivez votre projet par e-mail ou téléphone. Le besoin, le pays, les fonctions et les conditions sont étudiés avant de proposer un devis. Le formulaire professionnel reste une autre possibilité pour les entreprises.' },
      { question: 'Quel délai prévoir pour créer le site ?', answer: 'Le délai dépend du périmètre validé et de la disponibilité des textes, images et accès. Il est confirmé au devis. Une échéance souhaitée peut être indiquée dès le premier échange, sans constituer une date de livraison acceptée.' },
      { question: 'Le site apparaîtra-t-il dans les réponses des moteurs IA ?', answer: 'La structure et les informations publiques peuvent aider les moteurs à comprendre le site. Chaque moteur décide de son exploration, de son indexation et des sources qu’il cite. Aucune présence ou position n’est garantie.' },
    ],
    related: [{ label: 'Création de sites internet', href: '/creation-site-internet/' }, { label: 'Tarifs publics', href: '/pricing/' }, { label: 'Projets en francophonie', href: '/francophonie/' }, { label: 'Automatisation IA', href: '/automatisation-ia/' }],
    cta: { label: 'Décrire mon projet de site à petit budget', href: email('Projet de site internet à petit budget') },
  },
  {
    path: '/francophonie/', lang: 'fr', kind: 'page', updatedOn,
    breadcrumbLabel: 'Projets en francophonie',
    title: 'Sites, applications et automatisation pour vos projets francophones',
    description: 'Flex-Web accompagne entreprises et particuliers en France et en Suisse. Projets francophones étudiés à distance, échanges en français ou anglais, devis précis.',
    answer: 'Flex-Web crée des sites internet, des applications web, iOS, Android, Windows et macOS, et propose du CRM et de l’automatisation IA. Le studio est basé à Voglans, en Savoie, et accompagne les entreprises et les particuliers en France et en Suisse. Les demandes d’autres pays francophones sont étudiées à distance. Les échanges se font en français ou en anglais ; les conditions sont confirmées avant commande.',
    sections: [
      {
        title: 'Où se trouve Flex-Web et quels projets sont étudiés ?',
        paragraphs: [
          'Flex-Web est une marque de Fleximmo, située au 93 chemin de la Combe, 73420 Voglans, France. Le travail à distance permet de cadrer les besoins, partager un aperçu et valider les livrables avec un interlocuteur désigné.',
          'Pour une demande depuis la Belgique, le Luxembourg, le Québec ou un autre territoire francophone, indiquez votre pays, le public visé et les contraintes du projet. La disponibilité des services, les horaires d’échange, les conditions commerciales et les taxes sont vérifiés avant acceptation. Cette page ne revendique aucun bureau dans ces territoires.',
        ],
        links: [{ label: 'Identité de Flex-Web et méthode de travail', href: '/about/' }, { label: 'Zones d’intervention', href: '/zones-intervention/' }],
      },
      {
        title: 'Quelle prestation correspond à votre besoin ?',
        table: {
          caption: 'Choisir selon l’usage attendu, puis confirmer les fonctions dans le devis.',
          columns: ['Votre besoin', 'Point de départ', 'Ce qu’il faut préciser'],
          rows: [
            ['Présenter une activité ou un projet', 'Site vitrine ou site avec travail SEO / IA', 'Public, pages, contenus, langues du site et action de contact.'],
            ['Créer un service ou un outil spécifique', 'Application web, mobile ou logiciel installé sur devis', 'Utilisateurs, appareils, droits, données et première version utile.'],
            ['Retrouver les demandes et suivre les devis', 'CRM et automatisation pour entreprise', 'Outils actuels, étapes commerciales, accès et validations.'],
            ['Simplifier une tâche avec de l’IA', 'Scénario d’automatisation étudié sur devis', 'Sources autorisées, cas d’erreur, coûts des outils et responsable humain.'],
          ],
        },
        links: [{ label: 'Création de sites internet', href: '/creation-site-internet/' }, { label: 'Applications pour entreprises', href: '/applications/entreprises/' }, { label: 'Applications pour particuliers', href: '/applications/particuliers/' }, { label: 'CRM et automatisation', href: '/crm-automatisation-entreprise/' }],
      },
      {
        title: 'Comment cadrer le prix pour un projet à distance ?',
        paragraphs: [
          `Les références publiques de création de sites sont ${basicFr} pour le site vitrine jusqu’à 5 pages et ${visibilityFr} pour le site avec travail SEO / IA, selon le périmètre validé. Les applications et automatisations avancées sont chiffrées sur devis.`,
          'Les montants publics sont exprimés en euros avec la présentation fiscale française. Pour un projet international, le devis confirme les taxes applicables, le montant final, les modalités de paiement et les services retenus. Aucun prix en francs suisses ou en dollars canadiens n’est calculé automatiquement.',
          'Le domaine, l’hébergement, les licences et les consommations éventuelles de services tiers sont identifiés avant accord. Les options de suivi restent facultatives et leur périmètre est précisé.',
        ],
        links: [{ label: 'Comprendre les tarifs et options', href: '/pricing/' }, { label: 'Préparer un site à petit budget', href: '/creation-site-internet-pas-cher/' }],
      },
      {
        title: 'Comment se déroule une collaboration à distance ?',
        items: [
          'Premier échange : objectif, public, pays, langue de travail, budget et échéance souhaitée.',
          'Cadrage : livrables, contenus, accès, responsabilités, calendrier et coût à valider.',
          'Aperçu et tests : examiner les parcours attendus et les cas d’erreur sur les appareils retenus.',
          'Validation : corriger les écarts au périmètre avant la mise en service convenue.',
          'Suivi : prévoir les accès, la maintenance et les évolutions choisies dans le devis.',
        ],
        paragraphs: ['Flex-Web réalise les prestations convenues. Vous désignez la personne qui fournit ou valide les contenus, les règles métier et les autorisations d’accès. Le calendrier dépend de ces éléments et des tests nécessaires ; aucune durée universelle n’est annoncée.'],
      },
      {
        title: 'Quelles langues et quelles limites prévoir ?',
        paragraphs: [
          'L’accompagnement commercial et les échanges de projet sont proposés en français et en anglais. La présence de pages de présentation en allemand ou en italien ne signifie pas qu’un accompagnement dans ces langues est inclus. Les langues du futur site ou de l’application, ainsi que la relecture des traductions, sont définies au devis.',
          'Une intégration dépend des fonctions, autorisations et conditions du fournisseur. Une IA peut se tromper ou manquer d’information. Les décisions engageantes, les accès sensibles et les réponses incertaines nécessitent des règles de validation et une reprise humaine. La disponibilité d’un outil dans le pays concerné est vérifiée avant engagement.',
        ],
        links: [{ label: 'Comprendre la méthode et les limites de l’automatisation IA', href: '/automatisation-ia/' }],
      },
      {
        title: 'Quelles réalisations peut-on consulter avant de discuter ?',
        paragraphs: ['Les fiches Foot Nation, 2 Savoie Immo et Serrurier 73 décrivent des fonctions visibles et donnent accès aux sites publics. Elles apportent des exemples de plateforme web, de parcours immobilier et de présentation artisanale. Elles ne démontrent pas une implantation à l’étranger, une publication sur un store mobile ou un résultat commercial non mesuré.'],
        links: [{ label: 'Foot Nation : plateforme web', href: '/realisations/foot-nation/' }, { label: '2 Savoie Immo : parcours immobilier', href: '/realisations/2savoie-immo/' }, { label: 'Serrurier 73 : présentation artisanale', href: '/realisations/serrurier73/' }],
      },
    ],
    faq: [
      { question: 'Puis-je contacter Flex-Web depuis la Suisse ou la Belgique ?', answer: 'Oui. Indiquez votre pays, le projet et la langue souhaitée. Flex-Web accompagne les projets en Suisse et étudie les demandes des autres pays francophones à distance. Le devis confirme les conditions, les disponibilités et les taxes avant accord.' },
      { question: 'Faut-il être une entreprise pour demander un devis ?', answer: 'Non. Les particuliers peuvent demander un site ou une application et décrire leur idée par e-mail ou téléphone. Les prestations de CRM et d’automatisation métier s’adressent aux besoins des entreprises.' },
      { question: 'Peut-on travailler entièrement à distance ?', answer: 'Le cadrage, les échanges sur un aperçu et les validations peuvent se faire à distance. Si le projet exige du matériel, un accès sur place ou des contraintes particulières, ces conditions sont étudiées avant de confirmer sa faisabilité.' },
      { question: 'Dans quelles langues puis-je échanger avec Flex-Web ?', answer: 'En français ou en anglais. Les traductions du site de présentation ne constituent pas une promesse d’accompagnement dans d’autres langues. Les langues des livrables sont précisées au devis.' },
      { question: 'Comment démarrer sans transmettre de données sensibles ?', answer: 'Décrivez votre objectif, votre pays, votre public, les outils concernés et une première version souhaitée. Utilisez des exemples anonymisés. Les données et accès nécessaires sont définis au cadrage, avec leurs responsabilités.' },
    ],
    related: [{ label: 'Sites internet', href: '/creation-site-internet/' }, { label: 'Applications sur mesure', href: '/creation-application-mobile/' }, { label: 'Automatisation IA', href: '/automatisation-ia/' }, { label: 'Prendre contact', href: '/contact/' }],
    cta: { label: 'Décrire mon projet francophone', href: email('Projet francophone — site, application ou automatisation') },
  },
];

export const englishAcquisitionPages: AcquisitionPage[] = [
  {
    path: '/en/affordable-websites/', lang: 'en', kind: 'service', service: 'site', updatedOn,
    breadcrumbLabel: 'Affordable websites',
    title: `Affordable website creation: a brochure site for ${price(essential.setupCents, 'en')}`,
    description: `A brochure website of up to 5 pages for ${basicEn}. Compare included features, separate running costs and scope before requesting a quote.`,
    answer: `Flex-Web offers a brochure website of up to 5 pages for ${basicEn}, as a one-time payment after quote approval. It includes a mobile-friendly layout, a contact form and basic SEO setup at launch. Domain names, hosting and additional requirements are specified separately in the quote. Based in Voglans, Savoie, the studio works with businesses and individuals in France and Switzerland.`,
    sections: [
      {
        title: 'What kind of project fits a small budget?',
        paragraphs: [
          'A brochure website presents an activity or a project and lets visitors get in touch. A defined list of pages, content and functions helps keep the scope manageable. An application with customer accounts, payments or business rules needs a different scope.',
          'Illustrative example: a tradesperson might plan a homepage, services, service area, completed work and contact. This is not a required page list: we agree which pages are useful. For a personal project, explain what you want to present and what a visitor should be able to do.',
        ],
      },
      {
        title: `What does the ${price(essential.setupCents, 'en')} website include?`,
        items: ['A brochure website of up to 5 pages.', 'A layout adapted to phones and computers.', 'A contact form.', 'Basic SEO setup at launch.'],
        paragraphs: ['The quote lists the pages and functions, the content you need to supply and the agreed approvals. It also records the schedule and included revisions. Additional functions must be priced before you accept them.'],
      },
      {
        title: 'Which costs should you compare before choosing?',
        table: {
          caption: 'Separate the creation price from the cost of operating the website.',
          columns: ['Item', 'Published terms', 'What to confirm for your project'],
          rows: [
            ['Brochure website creation', `${basicEn}, one-time payment`, 'Up to 5 pages and the functions agreed in the quote.'],
            ['Domain name and hosting', 'Specified separately in the quote', 'Initial cost, renewal, domain ownership and account access.'],
            ['Text, images and additional functions', 'Scope and any extra cost to confirm', 'What you supply and what Flex-Web will produce.'],
            ['Maintenance and changes', `${supportEn}, optional`, 'Included work, limits and support terms.'],
            ['Licences and third-party services', 'Depends on the tools selected', 'Subscriptions or usage charges to identify before agreement.'],
          ],
        },
        paragraphs: ['The domain is registered in your name. A low creation price does not mean every renewal or future development is included. Flex-Web monthly options are not added automatically.'],
      },
      {
        title: `How is this different from the ${price(visibility.setupCents, 'en')} offer?`,
        paragraphs: [
          `The ${basicEn} website covers a presentation need and basic SEO setup. The ${visibilityEn} offer provides a site of 5 pages or more, with scope agreed by quote, and work on structure, content and structured data for organic and AI search.`,
          'Choose according to the information you need to present and the search visibility work required. Neither package guarantees a Google position or a citation in ChatGPT, Gemini, Claude or another assistant. The content must explain your activity using verifiable information.',
        ],
        links: [{ label: 'Compare website creation services', href: '/en/websites/' }, { label: 'View pricing and optional support', href: '/en/pricing/' }],
      },
      {
        title: 'How do you prepare a useful quote request?',
        items: [
          'Tell us whether this is a business or personal project and which country you are in.',
          'Explain what visitors should understand or do: call, send an enquiry or explore your work.',
          'List the intended pages and the text and images already available.',
          'Mention an existing domain, website and URLs that need to be preserved, if applicable.',
          'Share your budget and preferred deadline; the achievable schedule is confirmed in the quote.',
        ],
        paragraphs: ['Requesting a quote is free and is not an order. Flex-Web, a commercial brand of Fleximmo, agrees the scope with you. You approve the content, access and result before the agreed publication. Project discussions are available in French or English.'],
        links: [{ label: 'Prepare your website content and scope', href: '/en/guides/website-project-brief/' }],
      },
      {
        title: 'Which website example can you inspect?',
        paragraphs: ['The Serrurier 73 project page describes services, a service area and a contact journey that are visible on its public website. It provides an example of a tradesperson’s presentation. It does not establish that the project was delivered at this package price or achieved a measured commercial result.'],
        links: [{ label: 'Inspect the Serrurier 73 project (in French)', href: '/realisations/serrurier73/' }],
      },
      {
        title: 'What if you also need CRM, an application or AI?',
        paragraphs: ['A presentation website can be a first step. CRM enquiry tracking, a software connection or an application with user accounts are scoped separately. AI automation can produce incorrect answers; permissions, human checks and manual recovery must be agreed before use.'],
        links: [{ label: 'CRM and workflow automation', href: '/en/crm/' }, { label: 'Custom web and mobile applications', href: '/en/applications/' }],
      },
    ],
    faq: [
      { question: 'Can an affordable website work well on phones?', answer: `Yes. The ${basicEn} brochure website includes a layout adapted to phones and computers. The agreed pages and contact journey are checked before publication.` },
      { question: `Are a domain name and hosting included in the ${price(essential.setupCents, 'en')} price?`, answer: 'They are specified separately in the quote, including any recurring costs. The quote should distinguish creation, renewals and the options you choose.' },
      { question: 'Do I have to pay a monthly subscription?', answer: `Flex-Web options are optional. Maintenance, content changes and search visibility follow-up at ${supportEn} are separate from creation. A domain, hosting or third-party tools may still have recurring fees listed in the quote.` },
      { question: 'Can I request a website as an individual?', answer: 'Yes. Describe your project by email or telephone. The need, country, functions and terms are reviewed before a quote is proposed. The professional enquiry form remains an alternative for businesses.' },
      { question: 'How long does website creation take?', answer: 'Timing depends on the agreed scope and the availability of content, images and access. It is confirmed in the quote. A preferred deadline can be shared in the first conversation, but is not an accepted delivery date.' },
      { question: 'Will AI search engines recommend my website?', answer: 'The structure and public information can help search systems understand the site. Each system decides what it crawls, indexes and cites. No appearance or position is guaranteed.' },
    ],
    related: [{ label: 'Website creation', href: '/en/websites/' }, { label: 'Public pricing', href: '/en/pricing/' }, { label: 'Projects for French-speaking clients', href: '/en/french-speaking-clients/' }, { label: 'AI automation', href: '/en/ai-automation/' }],
    cta: { label: 'Describe my small-budget website project', href: email('Small-budget website project') },
  },
  {
    path: '/en/french-speaking-clients/', lang: 'en', kind: 'page', updatedOn,
    breadcrumbLabel: 'French-speaking clients',
    title: 'Websites, applications and automation for French-speaking clients',
    description: 'Flex-Web: websites, apps and automation for businesses and individuals in France, Switzerland and French-speaking markets. Project discussions in French or English.',
    answer: 'Flex-Web builds websites and web, iOS, Android, Windows and macOS applications, and provides CRM and AI automation. The studio is based in Voglans, Savoie, France, and works with businesses and individuals in France and Switzerland. Requests from other French-speaking countries are reviewed for remote delivery. Project discussions are in French or English, with terms confirmed before an order.',
    sections: [
      {
        title: 'Where is Flex-Web based and which projects are considered?',
        paragraphs: [
          'Flex-Web is a commercial brand of Fleximmo, based at 93 chemin de la Combe, 73420 Voglans, France. Remote work allows the team to define requirements, share a preview and agree deliverables with a designated contact.',
          'For a request from Belgium, Luxembourg, Quebec or another French-speaking territory, specify your country, audience and project constraints. Service availability, meeting times, commercial terms and taxes are checked before acceptance. This page does not claim a local office in those territories.',
        ],
        links: [{ label: 'Flex-Web identity and working method', href: '/en/about/' }, { label: 'Service areas (in French)', href: '/zones-intervention/' }],
      },
      {
        title: 'Which service matches your need?',
        table: {
          caption: 'Choose according to the intended use, then agree functions in the quote.',
          columns: ['Your need', 'Starting point', 'What to specify'],
          rows: [
            ['Present an activity or project', 'Brochure website or website with SEO / AI search work', 'Audience, pages, content, site languages and contact action.'],
            ['Create a specific service or tool', 'Custom web, mobile or desktop application', 'Users, devices, permissions, data and a useful first version.'],
            ['Find enquiries and follow up quotes', 'CRM and business workflow automation', 'Current software, commercial stages, access and approvals.'],
            ['Simplify a task with AI', 'An automation scenario scoped by quote', 'Authorised sources, failure cases, tool costs and human responsibility.'],
          ],
        },
        links: [{ label: 'Website creation', href: '/en/websites/' }, { label: 'Applications for businesses', href: '/en/applications/businesses/' }, { label: 'Applications for individuals', href: '/en/applications/individuals/' }, { label: 'CRM and automation', href: '/en/crm/' }],
      },
      {
        title: 'How is a remote project priced?',
        paragraphs: [
          `Published website reference prices are ${basicEn} for a brochure website of up to 5 pages and ${visibilityEn} for a website with SEO / AI search work, within the agreed scope. Applications and advanced automation are priced by custom quote.`,
          'Public prices are expressed in euros using French tax presentation. For an international project, the quote confirms applicable taxes, the final amount, payment terms and services. Swiss franc or Canadian dollar prices are not calculated automatically.',
          'Domain names, hosting, licences and any third-party usage charges are identified before agreement. Support options remain optional, with their scope stated in the quote.',
        ],
        links: [{ label: 'Understand prices and optional support', href: '/en/pricing/' }, { label: 'Plan an affordable website', href: '/en/affordable-websites/' }],
      },
      {
        title: 'How does remote collaboration work?',
        items: [
          'First conversation: goal, audience, country, working language, budget and preferred deadline.',
          'Scope: agree deliverables, content, access, responsibilities, schedule and cost.',
          'Preview and tests: examine expected journeys and failure cases on the selected devices.',
          'Approval: address differences from the agreed scope before launch.',
          'Follow-up: define access, maintenance and future changes in the quote.',
        ],
        paragraphs: ['Flex-Web delivers the agreed work. You designate the person who supplies or approves content, business rules and access permissions. Timing depends on those inputs and the required tests; there is no universal delivery duration.'],
      },
      {
        title: 'Which languages and limitations should you plan for?',
        paragraphs: [
          'Commercial support and project discussions are available in French and English. German or Italian presentation pages do not mean support in those languages is included. The languages of the future website or application, and translation review, are defined in the quote.',
          'An integration depends on the provider’s functions, permissions and terms. AI may be wrong or lack information. Binding decisions, sensitive access and uncertain answers need approval rules and human recovery. Tool availability in the relevant country is checked before commitment.',
        ],
        links: [{ label: 'AI automation: method and limits', href: '/en/ai-automation/' }],
      },
      {
        title: 'Which projects can you inspect before a conversation?',
        paragraphs: ['The Foot Nation, 2 Savoie Immo and Serrurier 73 project pages describe visible functions and link to public websites. They provide examples of a web platform, a property journey and a tradesperson’s presentation. They do not establish a foreign office, a mobile store publication or an unmeasured commercial result.'],
        links: [{ label: 'Foot Nation: web platform (in French)', href: '/realisations/foot-nation/' }, { label: '2 Savoie Immo: property journey (in French)', href: '/realisations/2savoie-immo/' }, { label: 'Serrurier 73: local services website (in French)', href: '/realisations/serrurier73/' }],
      },
    ],
    faq: [
      { question: 'Can I contact Flex-Web from Switzerland or Belgium?', answer: 'Yes. Specify your country, project and preferred working language. Flex-Web works on projects in Switzerland and reviews requests from other French-speaking countries for remote delivery. The quote confirms terms, availability and taxes before agreement.' },
      { question: 'Do I need to be a business to request a quote?', answer: 'No. Individuals can request a website or application and describe their idea by email or telephone. CRM and business workflow automation services address business needs.' },
      { question: 'Can the project be delivered entirely remotely?', answer: 'Scoping, preview discussions and approvals can take place remotely. If the project needs hardware, on-site access or other specific conditions, they are reviewed before feasibility is confirmed.' },
      { question: 'Which languages can I use with Flex-Web?', answer: 'French or English. Translations of the presentation website are not a promise of support in other languages. Deliverable languages are defined in the quote.' },
      { question: 'How can I start without sharing sensitive data?', answer: 'Describe your goal, country, audience, tools and intended first version. Use anonymised examples. Required data and access, along with responsibilities, are agreed during scoping.' },
    ],
    related: [{ label: 'Websites', href: '/en/websites/' }, { label: 'Custom applications', href: '/en/applications/' }, { label: 'AI automation', href: '/en/ai-automation/' }, { label: 'Contact', href: '/en/contact/' }],
    cta: { label: 'Describe my project for French-speaking clients', href: email('Project for French-speaking clients — website, application or automation') },
  },
];

export const acquisitionPages: AcquisitionPage[] = [...frenchAcquisitionPages, ...englishAcquisitionPages];
