# Applications mobiles Flex-Web

Le lot Astro porte sur les projets iOS et Android des entreprises et particuliers. La source de départ est le déploiement de flex-web.fr du 23 novembre 2026, `6b0452114b315390275a0f53`. GitHub contient aussi des catalogues d’autres versions. Ce lot reprend les pages mobiles ciblées et toutes les URL du sitemap de cette production.

## Parcours à examiner

- [Offre en français](https://6b0485a09cae4d4dbe96caf4--flex-webb.netlify.app/creation-application-mobile/) et [offre en anglais](https://6b0485a09cae4d4dbe96caf4--flex-webb.netlify.app/en/applications/)
- [Entreprises](https://6b0485a09cae4d4dbe96caf4--flex-webb.netlify.app/applications/entreprises/) et [particuliers](https://6b0485a09cae4d4dbe96caf4--flex-webb.netlify.app/applications/particuliers/)
- [Suisse romande](https://6b0485a09cae4d4dbe96caf4--flex-webb.netlify.app/applications/suisse-romande/) et [Belgique francophone](https://6b0485a09cae4d4dbe96caf4--flex-webb.netlify.app/applications/belgique-francophone/)
- [Étude de cas FootNation](https://6b0485a09cae4d4dbe96caf4--flex-webb.netlify.app/realisations/footnation/) et [formulaire mobile](https://6b0485a09cae4d4dbe96caf4--flex-webb.netlify.app/demarrer/application/)

## Reproduction

Les commandes se lancent depuis la racine du dépôt avec les dépendances du fichier de verrouillage. Le premier contrôle interroge le déploiement de référence. L’environnement CI utilise le secret Netlify du projet. Le développement local peut utiliser la session Netlify CLI sur macOS.

```sh
npx --no-install astro build --root acquisition-mobile
node acquisition-mobile/scripts/assemble.mjs
node acquisition-mobile/scripts/verify.mjs
node acquisition-mobile/scripts/preview.mjs
```

L’assemblage compare par empreinte les entrées récupérées de la production. La préparation de l’aperçu reprend chaque fichier, les routes, les instructions de sécurité, les fonctions serveur et leur planification. Le contrôle du pipeline CMS protège le catalogue mobile lorsque l’offre est en production.

## Validation du 23 novembre 2026

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
| Autres contrôles | 183 tests CMS, 14 tests du mécanisme IndexNow et 4 tests du suivi commercial réussis |

Pour reproduire les contrôles distants, passer le même domaine d’aperçu à `verify.mjs`, `verify-pages.mjs`, `verify-quote.mjs` et `verify-home.mjs`. Les deux tests Playwright des parcours bloquent les envois de test et les requêtes de mesure externes.

## Exploitation

Les contenus métier et traductions figurent dans `src/data/mobile.mjs`. Les pages et données structurées proviennent de `src/pages/` et de `src/components/`. Les images FootNation reprises dans l’étude de cas proviennent de la fiche Apple de l’éditeur FLEX IMMO. Les ressources textuelles destinées aux moteurs sont produites par `scripts/assemble.mjs` à partir de ces pages et du site publié.

Après approbation de l’aperçu, contrôler la production avant de soumettre le sitemap canonique à Google Search Console et Bing Webmaster Tools. Garder les accusés de réception et les dates des dernières lectures. Le [guide de mesure](measurement/SUIVI.md) détaille le bilan des devis qualifiés et le protocole de suivi des citations des assistants à J+30, J+60 et J+90.
