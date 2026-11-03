# GEO : petit budget et francophonie — 3 novembre 2026

## Livraison

- Branche : `codex/geo-francophonie-budget-20261103`.
- Code de départ : même arborescence que la production `838e62e`.
- Code de l’aperçu : `2505110` (implémentation et contrôle dédié des offres) ; PR en brouillon : https://github.com/ProjetMario/FLEXWEB/pull/44.
- Aperçu Netlify vérifié : https://6aea18f7086129a2e0ea2c31--flex-webb.netlify.app/creation-site-internet-pas-cher/
- Déploiement `6aea18f7086129a2e0ea2c31`, état Netlify `ready`, contexte `deploy-preview`, aucune date de publication en production.
- Validation complète : https://github.com/ProjetMario/FLEXWEB/actions/runs/41682703297 — réussie.
- Contrôles complémentaires du dépôt : https://github.com/ProjetMario/FLEXWEB/actions/runs/41682711039 — réussis.
- Production publiée après validation de l’utilisateur le 3 novembre 2026 : commit `eadac9fc8329b4436e89ca5049ba9db53d6622a7`, déploiement Netlify `6aea2732c7516e1b751ae971`, état `ready`, verrou de publication conservé.
- La PR 44 a été fusionnée dans `main` et a déclenché automatiquement le workflow GitHub de publication : https://github.com/ProjetMario/FLEXWEB/actions/runs/41691256388 (réussi).

## Pages créées

- `/creation-site-internet-pas-cher/` : offre existante 299 € TTC, périmètre, frais distincts, choix 299/590 €, particuliers et entreprises.
- `/en/affordable-websites/` : équivalent anglais.
- `/francophonie/` : services, travail à distance, France/Suisse et étude des demandes d’autres pays francophones ; échanges FR/EN.
- `/en/french-speaking-clients/` : équivalent anglais.

Les quatre pages sont statiques, avec FAQ visible, traductions réciproques, contacts e-mail/téléphone et liens internes.

Liens de consultation de l’aperçu :

- https://6aea18f7086129a2e0ea2c31--flex-webb.netlify.app/creation-site-internet-pas-cher/
- https://6aea18f7086129a2e0ea2c31--flex-webb.netlify.app/en/affordable-websites/
- https://6aea18f7086129a2e0ea2c31--flex-webb.netlify.app/francophonie/
- https://6aea18f7086129a2e0ea2c31--flex-webb.netlify.app/en/french-speaking-clients/

## Problèmes corrigés

- Les présentations de publics et de zones différaient entre services, pages de contact, balisage et résumés IA. Les pages intérieures concernées exposent désormais un périmètre cohérent. Le pied de page utilise une variante explicite sur ces pages uniquement.
- Les réalisations affichaient des emplacements éditoriaux à compléter. Elles présentent désormais des preuves accessibles, leurs limites, une FAQ et des dates de vérification individuelles. Aucun chiffre, avis ou résultat inventé.
- Le téléphone de la page contact n’était pas cliquable et le bouton présélectionnait toujours une automatisation. Les contacts sont maintenant accessibles et adaptés à chaque intention.
- Le début du formulaire n’était pas mesuré sur son parcours. Il est désormais enregistré après consentement, une fois par parcours, sans données personnelles.
- La provenance déclarée par un client n’était pas recueillie. Une réponse facultative est conservée dans le message commercial existant, séparément de la provenance technique, sans nouveau champ serveur. La limite de 3 000 caractères inclut le préambule et la réponse ; le besoin n’est jamais tronqué silencieusement.
- Les applications figuraient seulement comme liens dans le résumé IA détaillé. Leurs réponses FR/EN/DE/IT sont maintenant reprises depuis les mêmes données que les pages.
- Certaines dates du sitemap ne reflétaient pas les modifications publiées. Les pages touchées ont des dates explicites ; Savoie et Vevey reprennent le 1er novembre correspondant à leur modification précédente. Aucun rafraîchissement global artificiel.

## Accueils protégés

Les contenus de `/` et `/en/` restent inchangés, y compris les titres, textes, offres, FAQ, sections, images, menus et pieds de page. Les résumés de réalisations visibles sur l’accueil sont conservés. Le tableau des priorités éditoriales de l’accueil est également conservé.

Contrôles locaux : comparaison du HTML significatif, des métadonnées, des liens, images, contrôles et titres ; comparaison des textes affichés sur mobile 375 px et ordinateur 1440 px. Captures avant/après de même dimension. Les captures anglaises sont identiques pixel par pixel ; de faibles écarts de rendu des animations existent dans les captures françaises, sans changement de contenu ou de dimensions.

## Validation

Passages locaux réussis :

- Compilation des templates Astro modifiés et du JSX.
- `git diff --check`.
- `node --import tsx --test tests/geo/acquisition.test.ts tests/seo/acquisition.test.ts tests/analytics.test.mjs` : 20 tests.
- `node --import tsx --test tests/geo/declared-source.test.mjs` : 3 tests.
- Tests navigateur `tests/geo/quote-attribution.test.mjs` : 5 tests.
- Tests navigateur `tests/geo/budget-pages.test.mjs` : 2 tests, nouvelles pages/intérieurs et accueils protégés.
- Tests navigateur `tests/geo/browser.test.mjs` : 2 tests, pages FR/EN et attribution après consentement.

Les tests locaux de navigateur utilisent `FLEXWEB_TEST_URL=http://127.0.0.1:4322` et `PLAYWRIGHT_CHANNEL=chrome`. Toutes les demandes sont simulées. Aucune demande commerciale réelle n’a été envoyée.

Le premier build complet et les contrôles du HTML, des sitemaps, des applications et de conservation du contenu ont réussi. Un test existant classait la route « creation-site-internet-pas-cher » parmi les pages géographiques ; cette sélection a été corrigée et un test dédié vérifie maintenant les offres 299/590 €, leur TVA et les coûts séparés sur les deux pages budget. Les données structurées de ces pages détaillent les mêmes offres que le contenu visible. La validation complète du correctif et de l’aperçu a réussi : 182 tests CMS, 104 tests SEO/GEO et 18 tests de formulaire, mesure et proxy, sans échec. Les trois tests Python de sélection des communes ont également réussi.

Commandes de la chaîne distante (Node 24, `CONTEXT=production`, `FLEXWEB_FR_CH_EXPANSION=1`) :

```sh
npm ci
npm run cms:test
node scripts/geo/capture-baseline.mjs
node scripts/geo/capture-homepages.mjs
npm run build
node scripts/check-seo.mjs
node scripts/seo/quality.mjs --enforce-release
node scripts/seo/audit-territorial-publication.mjs
node scripts/geo/validate-homepages.mjs
node scripts/geo/validate.mjs
node scripts/geo/validate-budget.mjs
node scripts/geo/validate-applications.mjs
python3 scripts/geo/check-xml.py
python3 scripts/seo/test-fr-ch-candidates.py
node scripts/seo/verify-fr-ch-expansion.mjs
node --import tsx --test tests/geo/*.test.* tests/seo/*.test.*
node --test tests/quote-flow.test.mjs tests/analytics.test.mjs tests/automation-proxy.test.mjs
node scripts/geo/verify-preview.mjs
```

Toutes les commandes de cette chaîne ont terminé avec succès pour le code `2505110`.

Le contrôle de l’aperçu distant confirme 68 pages stratégiques en HTTP 200, les fichiers robots/llms, la validité et l’accessibilité des sitemaps, la conservation des 50 644 URL et des contenus des deux accueils. Les sondes HTTP sous les noms des robots documentés ont réussi. Le rendu de la nouvelle page budget a également été inspecté dans Chrome.

Preuves locales téléchargées depuis la chaîne distante :

- `.cms/geo-budget-evidence-final/geo-validation.json`
- `.cms/geo-budget-evidence-final/geo-budget-validation.json`
- `.cms/geo-budget-evidence-final/geo-homepages-baseline.json`
- `.cms/geo-budget-evidence-final/geo-production-marker.json`
- `.cms/geo-budget-evidence-final/geo-smoke/`

Pendant la préparation de l’aperçu initial, le marqueur de production est resté `838e62e18e3a300d48a5ba2affa986308cdd54d7`. Netlify a transféré 59 257 fichiers, dont de nombreux fichiers de pages existantes reconstruits : ce compteur de fichiers transférés n’est pas un compteur de nouvelles URL. Les seules nouvelles URL du sitemap sont les quatre pages ci-dessus.

## Sitemap et moteurs

Baseline vérifiée : 31 sous-sitemaps valides, 50 644 URL uniques. Le build final et l’aperçu distant confirment les mêmes 31 fichiers, 50 648 URL et aucune URL initiale retirée. Le contrôle ciblé couvre 22 pages nouvelles ou enrichies et 342 liens internes.

Les nouvelles pages maintenant publiées, à inspecter dans Google Search Console, sont :

- https://flex-web.fr/creation-site-internet-pas-cher/
- https://flex-web.fr/francophonie/
- https://flex-web.fr/en/affordable-websites/
- https://flex-web.fr/en/french-speaking-clients/

Sitemap principal : https://flex-web.fr/sitemap.xml. Ne pas soumettre les URL de l’aperçu. Les canoniques pointent vers le domaine public prévu ; l’aperçu ne prouve pas leur publication en production. L’automatisation Bing quotidienne n’est pas modifiée.

Le fichier robots.txt conserve l’accès public et l’exclusion `/api/`. Les pages privées restent exclues de l’indexation. Les requêtes de contrôle avec les noms des robots vérifient une réponse HTTP, pas une visite ou une citation réelle de ces moteurs.

## Informations réelles encore utiles

- Témoignages clients publiables avec leur accord et résultats accompagnés de mesures vérifiables.
- Références documentées de projets CRM/IA ou de publications sur les stores ; les trois réalisations web ne sont pas présentées comme de telles preuves.
- Conditions spécifiques et disponibilité pour chaque projet international, confirmées au devis.
- Suivi des demandes effectivement reçues par e-mail/téléphone et de leur origine déclarée. Les clics seuls ne sont pas des devis.

Comparer les périodes de 28 jours à périmètre constant. Les sources absentes restent inconnues ; les visites IA détectables et les déclarations des clients restent des mesures distinctes. Aucun classement ou volume de demandes n’est garanti.

## Fichiers modifiés ou ajoutés

- `.github/workflows/geo-preview.yml`
- `scripts/geo/capture-baseline.mjs`
- `scripts/geo/capture-homepages.mjs`
- `scripts/geo/homepage-content.mjs`
- `scripts/geo/validate-budget.mjs`
- `scripts/geo/validate-homepages.mjs`
- `scripts/geo/validate.mjs`
- `scripts/geo/verify-preview.mjs`
- `src/components/ContactSection.jsx`
- `src/components/automation/AutomationLanding.astro`
- `src/components/geo/GeoPage.astro`
- `src/components/geo/InteriorServiceContext.astro`
- `src/components/global/Footer.jsx`
- `src/components/onboarding/StartProject.jsx`
- `src/components/seo/ConversionEvents.astro`
- `src/data/contact.json`
- `src/data/geo/acquisition-pages.ts`
- `src/data/geo/editorial-dates.ts`
- `src/data/geo/pages.ts`
- `src/data/geo/service-context.ts`
- `src/data/geo/site.ts`
- `src/data/geo/web-app-pages.ts`
- `src/data/realizations.ts`
- `src/data/search-summary.ts`
- `src/layout/BaseLayout.astro`
- `src/lib/acquisition.ts`
- `src/lib/declared-source.mjs`
- `src/lib/seo/core-pages.ts`
- `src/pages/about.astro`
- `src/pages/contact.astro`
- `src/pages/creation-application-mobile.astro`
- `src/pages/creation-site-internet-pas-cher.astro`
- `src/pages/creation-site-internet.astro`
- `src/pages/en/[...slug].astro`
- `src/pages/francophonie.astro`
- `src/pages/llms-full.txt.ts`
- `src/pages/pricing.astro`
- `src/pages/realisations/[slug].astro`
- `src/pages/realisations/index.astro`
- `tests/geo/browser.test.mjs`
- `tests/geo/budget-pages.test.mjs`
- `tests/geo/declared-source.test.mjs`
- `tests/geo/quote-attribution.test.mjs`
- `tests/seo/pricing.test.ts`
- `docs/GEO-BUDGET-FRANCOPHONIE-2026-11-03.md`


## Publication confirmée depuis GitHub

L’aperçu a été validé par l’utilisateur. Avant fusion, le correctif `c9221f6` a intégré la capture et la comparaison des accueils au workflow de production, afin que le test dispose aussi de sa référence dans une exécution neuve. Les preuves de conservation sont archivées par GitHub. Aucun contenu de page n’a changé dans ce correctif.

- 45 tests ciblés de publication réussis localement. Les tests locaux d’archives ont rencontré un manque d’espace disque ; la suite complète a été validée sur GitHub.
- Contrôles avant fusion réussis : https://github.com/ProjetMario/FLEXWEB/actions/runs/41689910150.
- Contrôles sur `main` réussis : https://github.com/ProjetMario/FLEXWEB/actions/runs/41691256381.
- Publication contrôlée réussie : https://github.com/ProjetMario/FLEXWEB/actions/runs/41691256388.
- Le workflow a récupéré le contenu publié du CMS, construit et vérifié son aperçu, puis publié les mêmes fichiers sans seconde compilation. Il a confirmé le marqueur public et conservé le verrou Netlify.
- Vérification indépendante après publication : `node .cms/verify-geo-production.mjs eadac9fc8329b4436e89ca5049ba9db53d6622a7` — réussie le 3 novembre 2026 à 18:27 UTC.
- Les quatre nouvelles pages sont en HTTP 200, sans blocage d’indexation détecté, avec canoniques propres, traductions réciproques, FAQ visibles conformes au balisage, contacts et tarifs vérifiés.
- Le sitemap public contient 31 sous-sitemaps valides et 50 648 URL uniques : les 50 644 précédentes sont conservées, avec exactement quatre ajouts.
- Le contenu des accueils `/` et `/en/` correspond à la référence antérieure ; robots.txt, llms.txt et llms-full.txt sont accessibles.
- Le contrôle du formulaire reste un GET sans envoi de demande : réponse 405 attendue et absence de mise en cache. Les parcours de soumission ont été testés avec API simulée.
- Le mécanisme IndexNow existant a notifié 11 pages intérieures modifiées, avec réponse HTTP 200. Les quatre nouvelles routes ne figurent pas dans cette sélection automatique : elles sont présentes dans le sitemap. Ce reçu ne confirme pas leur indexation et aucune soumission Google Search Console n’a été effectuée dans cette étape.

Preuves locales : `.cms/geo-production-verified.json`, `.cms/geo-production-evidence/publication-report.json`, `.cms/geo-production-evidence/indexnow-report.json`. Les archives originales sont conservées dans le workflow GitHub.

Fichiers complémentaires de préparation de la publication : `.github/workflows/emdash-publication.yml`, `scripts/cms/release.mjs`, `docs/EMDASH-PUBLICATION.md`. La documentation décrit désormais le circuit effectivement utilisé, sans restauration d’un ancien déploiement.
