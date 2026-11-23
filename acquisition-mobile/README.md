# Applications mobiles Flex-Web

Le lot Astro porte sur les projets iOS et Android des entreprises et particuliers. La source de départ est le déploiement de flex-web.fr du 23 novembre 2026, `6b0452114b315390275a0f53`. GitHub contient aussi des catalogues d’autres versions. Ce lot reprend les pages mobiles ciblées et toutes les URL du sitemap de cette production.

## Refonte des pages publiques

Le nouveau design réunit les accueils français et anglais, les offres, les tarifs et les gabarits du catalogue. [Aperçu et résultats de validation](redesign/VALIDATION.md)

## Catalogue servant de base à la refonte

La version qui sert de référence au nouveau design réunit **151 507 URL canoniques dans 85 sous-sitemaps**. Elle conserve les 275 URL de l’étape mobile et restaure 151 232 autres pages de la version publiée le 13 novembre. Les pages de navigation et les variantes linguistiques historiques marquées noindex sont comptées à part. [Sitemap de l’aperçu combiné](https://6b04922cb721fd1ae1c8d810--flex-webb.netlify.app/sitemap.xml) · [Rapport des vérifications](catalogue/VALIDATION.md)

## Parcours à examiner

- [Offre en français](https://6b04922cb721fd1ae1c8d810--flex-webb.netlify.app/creation-application-mobile/) et [offre en anglais](https://6b04922cb721fd1ae1c8d810--flex-webb.netlify.app/en/applications/)
- [Entreprises](https://6b04922cb721fd1ae1c8d810--flex-webb.netlify.app/applications/entreprises/) et [particuliers](https://6b04922cb721fd1ae1c8d810--flex-webb.netlify.app/applications/particuliers/)
- [Suisse romande](https://6b04922cb721fd1ae1c8d810--flex-webb.netlify.app/applications/suisse-romande/) et [Belgique francophone](https://6b04922cb721fd1ae1c8d810--flex-webb.netlify.app/applications/belgique-francophone/)
- [Étude de cas FootNation](https://6b04922cb721fd1ae1c8d810--flex-webb.netlify.app/realisations/footnation/) et [formulaire mobile](https://6b04922cb721fd1ae1c8d810--flex-webb.netlify.app/demarrer/application/)

## Adresses des 18 pages

| Sujet | Français | Anglais |
|---|---|---|
| Applications mobiles | [/creation-application-mobile/](https://6b04922cb721fd1ae1c8d810--flex-webb.netlify.app/creation-application-mobile/) | [/en/applications/](https://6b04922cb721fd1ae1c8d810--flex-webb.netlify.app/en/applications/) |
| Applications iOS | [/applications/ios/](https://6b04922cb721fd1ae1c8d810--flex-webb.netlify.app/applications/ios/) | [/en/applications/ios/](https://6b04922cb721fd1ae1c8d810--flex-webb.netlify.app/en/applications/ios/) |
| Applications Android | [/applications/android/](https://6b04922cb721fd1ae1c8d810--flex-webb.netlify.app/applications/android/) | [/en/applications/android/](https://6b04922cb721fd1ae1c8d810--flex-webb.netlify.app/en/applications/android/) |
| Pour les entreprises | [/applications/entreprises/](https://6b04922cb721fd1ae1c8d810--flex-webb.netlify.app/applications/entreprises/) | [/en/applications/businesses/](https://6b04922cb721fd1ae1c8d810--flex-webb.netlify.app/en/applications/businesses/) |
| Pour les particuliers | [/applications/particuliers/](https://6b04922cb721fd1ae1c8d810--flex-webb.netlify.app/applications/particuliers/) | [/en/applications/individuals/](https://6b04922cb721fd1ae1c8d810--flex-webb.netlify.app/en/applications/individuals/) |
| Prix d’une application | [/applications/prix/](https://6b04922cb721fd1ae1c8d810--flex-webb.netlify.app/applications/prix/) | [/en/applications/cost/](https://6b04922cb721fd1ae1c8d810--flex-webb.netlify.app/en/applications/cost/) |
| Web, mobile ou logiciel installé | [/applications/web-mobile-ou-logiciel/](https://6b04922cb721fd1ae1c8d810--flex-webb.netlify.app/applications/web-mobile-ou-logiciel/) | [/en/applications/web-mobile-or-desktop/](https://6b04922cb721fd1ae1c8d810--flex-webb.netlify.app/en/applications/web-mobile-or-desktop/) |
| Suisse romande | [/applications/suisse-romande/](https://6b04922cb721fd1ae1c8d810--flex-webb.netlify.app/applications/suisse-romande/) | — |
| Belgique francophone | [/applications/belgique-francophone/](https://6b04922cb721fd1ae1c8d810--flex-webb.netlify.app/applications/belgique-francophone/) | — |
| Étude de cas FootNation | [/realisations/footnation/](https://6b04922cb721fd1ae1c8d810--flex-webb.netlify.app/realisations/footnation/) | [/en/case-studies/footnation/](https://6b04922cb721fd1ae1c8d810--flex-webb.netlify.app/en/case-studies/footnation/) |

## Construction de l’étape mobile de référence

Les commandes se lancent depuis la racine du dépôt avec les dépendances du fichier de verrouillage. Le premier contrôle interroge le déploiement de référence. L’environnement CI utilise le secret Netlify du projet. Le développement local peut utiliser la session Netlify CLI sur macOS.

```sh
npx --no-install astro build --root acquisition-mobile
node acquisition-mobile/scripts/assemble.mjs
node acquisition-mobile/scripts/verify.mjs
node acquisition-mobile/scripts/preview.mjs
```

L’assemblage compare par empreinte les entrées récupérées de la production. La préparation de l’aperçu reprend chaque fichier, les routes, les instructions de sécurité, les fonctions serveur et leur planification. Le contrôle du pipeline CMS protège le catalogue mobile lorsque l’offre est en production.

## Résultats de l’étape mobile avant réintégration du catalogue

| Périmètre | Résultat sur l’aperçu |
|---|---|
| Sitemap | 258 URL de référence conservées, 17 URL ajoutées, 275 URL distinctes dans le sitemap principal |
| Contenu | 16 pages de services, guides et zones géographiques, 2 études de cas FR/EN et 10 pages existantes enrichies de liens vers les ressources mobiles |
| Navigation | 286 destinations du site testées en HTTP 200, dont toutes les URL du sitemap. Les quatre fiches Apple France, Suisse, Belgique et Canada répondent également en HTTP 200 |
| Rendu | HTML statique, titre et description uniques, H1, canonique, langue, traductions disponibles, données structurées et FAQ visibles vérifiés sur les 18 pages |
| Exploration | Règle générale autorisant les pages publiques, avec exclusions API, administration et espaces privés. Les robots de recherche de Google, Bing, OpenAI et Anthropic relèvent de cette règle. Le devis est en noindex |
| Accueil | HTML et ressources FR/EN identiques aux empreintes de production. Comparaison aux largeurs de 390 et 1 440 pixels. Seul écart sur les quatre captures, 20 pixels de lissage à faible contraste sur l’illustration mobile anglaise |
| Devis | Sept scénarios de navigation avec API simulée, incluant consentement, refus, succès et échec. Un clic de contact et une demande reçue disposent de mesures distinctes |
| Hébergement | 380 fichiers contrôlés, dont les 351 fichiers d’origine toujours présents. 452 règles de routage dont les 444 existantes, un jeu d’en-têtes, deux fonctions et leur planification |
| Autres contrôles | 183 tests CMS, 14 tests du mécanisme IndexNow et 5 tests du suivi commercial réussis |

Pour reproduire les contrôles distants, passer le même domaine d’aperçu à `verify.mjs`, `verify-pages.mjs`, `verify-quote.mjs` et `verify-home.mjs`. Les deux tests Playwright des parcours bloquent les envois de test et les requêtes de mesure externes.

## Exploitation

Les contenus métier et traductions figurent dans `src/data/mobile.mjs`. Les pages et données structurées proviennent de `src/pages/` et de `src/components/`. Les images FootNation reprises dans l’étude de cas proviennent de la fiche Apple de l’éditeur FLEX IMMO. Les ressources textuelles destinées aux moteurs sont produites par `scripts/assemble.mjs` à partir de ces pages et du site publié.

Le reçu de l’étape mobile se trouve dans `release-candidate.json`. Le reçu du catalogue complet est dans `catalogue/release-candidate.json`. Le reçu de la refonte se trouve dans `redesign/release-candidate.json`. Après validation visuelle et fusion sur main, le workflow de publication accepte l’identifiant exact de cet aperçu. Il vérifie les empreintes de tous les fichiers et le contenu des 85 sous-sitemaps, publie les mêmes octets et revérifie le domaine public.

Après ce contrôle, soumettre `https://flex-web.fr/sitemap.xml` à la propriété de domaine flex-web.fr dans Google Search Console et au site enregistré auprès de Bing Webmaster Tools. Conserver le dernier jour de données disponible et les reçus de soumission. À J+7 et J+28, relever les erreurs HTTP, les URL découvertes et indexées, les impressions et les clics par moteur. Compter les demandes effectivement reçues depuis le CRM et distinguer les clics e-mail et téléphone. Le [guide de mesure](measurement/SUIVI.md) complète ce suivi par les devis mobiles qualifiés et les citations des assistants.
