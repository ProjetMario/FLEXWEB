# Visibilité IA et recherche — sites web et applications

Préparation du 28 octobre 2026 sur la branche `codex/geo-fr-en-20261028`. Le travail reprend l’aperçu CRM et automatisation précédent et le complète pour les projets de site internet et d’application web ou mobile.

## État

La construction, les tests et la vérification de l’aperçu ont réussi dans [GitHub Actions](https://github.com/ProjetMario/FLEXWEB/actions/runs/40711839477), sur le commit `16debc1dc6d718a1b9e72103aa3f8faf30eaf07b`. Aperçu Netlify prêt : [création de sites](https://6ae20f6697ba0bb7d21e65f8--flex-webb.netlify.app/creation-site-internet/) · [applications](https://6ae20f6697ba0bb7d21e65f8--flex-webb.netlify.app/creation-application-mobile/) · [guide site](https://6ae20f6697ba0bb7d21e65f8--flex-webb.netlify.app/guides/preparer-projet-site-internet/) · [guide application](https://6ae20f6697ba0bb7d21e65f8--flex-webb.netlify.app/guides/preparer-projet-application-mobile/). L’aperçu renvoie l’en-tête `X-Robots-Tag: noindex` et ses canoniques pointent vers les URL de production prévues.

La production `flex-web.fr` reste sur le déploiement antérieur. Aucun prix n’a été modifié, aucune soumission à un moteur de recherche n’a été effectuée pour les pages non publiées.

## Pages et parcours

Pages françaises enrichies :

- `https://flex-web.fr/creation-site-internet/` : besoins des entreprises, préparation du devis, refonte et conservation des adresses, propriété du domaine, contenu, contacts et preuves disponibles.
- `https://flex-web.fr/creation-application-mobile/` : premier lot métier, rôles et accès, choix web ou mobile, coûts, délais, tests, comptes et publication éventuelle dans les stores.

Nouveaux guides français :

- `https://flex-web.fr/guides/preparer-projet-site-internet/` : objectifs, contenus, refonte, formulaire, budget et lancement.
- `https://flex-web.fr/guides/preparer-projet-application-mobile/` : utilisateurs, choix web/mobile, premier lot, devis, sécurité et recette.

Nouvelles pages anglaises :

- `https://flex-web.fr/en/websites/` : offres, prix, contenu à préparer, méthode et exemples de sites vérifiables.
- `https://flex-web.fr/en/applications/` : applications web ou mobiles, choix des plateformes, rôle des utilisateurs, sécurité et devis sur mesure.
- `https://flex-web.fr/en/guides/website-project-brief/` : préparer les contenus, adresses, formulaire et vérifications avant lancement.
- `https://flex-web.fr/en/guides/application-project-brief/` : préparer les utilisateurs, le premier périmètre, les intégrations et les tests d’acceptation.

Les guides sont reliés aux offres et au contact. Les pages françaises et anglaises des deux services et des deux guides déclarent des liens `hreflang` réciproques. La navigation anglaise et le pied de page permettent de trouver ces offres.

Les fiches de réalisations existantes sont citées pour leurs fonctionnalités publiques, avec leur date de vérification. Elles ne sont pas présentées comme des preuves de classement, de revenu, de publication sur un store ou d’autres résultats non établis. Les cas pratiques de cadrage sont des exemples, pas des projets clients revendiqués.

## Référencement et mesure

- Pages statiques Astro avec titre, description, H1, réponses en HTML, FAQ visible et appels à l’action.
- `ProfessionalService`, `WebSite`, `WebPage`, `BreadcrumbList`, `Service`, `Article` et FAQ selon les contenus affichés.
- Nouvelles pages incluses dans le sitemap et les synthèses `llms.txt` / `llms-full.txt` générées depuis les données publiques.
- Les événements de clic vers un devis indiquent `site` ou `application` sur les pages et guides concernés. Le contact générique reste `unknown` tant que le service n’est pas identifiable. L’attribution d’origine IA suit le consentement déjà mis en place.
- Les prix des sites proviennent du catalogue existant : 299 € TTC et 590 € TTC selon le périmètre convenu ; les applications restent sur devis. Frais tiers et conditions internationales à confirmer au devis.

La découvrabilité et la qualité des réponses facilitent l’exploration ; elles ne garantissent ni position dans un moteur, ni citation par une IA, ni nombre de demandes.

## Vérifications

La compilation Astro a généré 21 178 documents. Le sitemap contient 20 610 URL : les 20 594 URL de production ont été conservées, et 16 URL ont été ajoutées au total depuis la base de production, dont les améliorations CRM précédentes et les six nouvelles pages de ce travail. Seize sous-sitemaps sont valides en XML.

Les contrôles ont analysé 26 pages en paires de langues, les métadonnées, les liens internes, les FAQ et les données structurées. Les 30 pages stratégiques testées sur l’aperçu répondent en HTTP 200. Les huit pages concernées par les sites et applications répondent en HTTP 200 et portent l’en-tête `noindex` de l’aperçu.

Les 103 tests automatisés ont réussi : 85 tests SEO/GEO et consentement, puis 18 tests de devis, d’analytics et de proxy. Le rendu de 19 pages a été contrôlé aux largeurs 375, 768 et 1 440 pixels. Les demandes de devis ont été simulées avec des API interceptées ; aucun devis réel n’a été envoyé. Les sondes d’agents IA vérifient l’accessibilité HTTP, sans prouver une visite réelle ou une citation.

Commandes principales exécutées dans GitHub Actions :

```sh
npm run build
node scripts/check-seo.mjs
node scripts/seo/quality.mjs --enforce-release
node scripts/seo/audit-territorial-publication.mjs
GEO_BASELINE_FILE=.cms/geo-baseline.json node scripts/geo/validate.mjs
python3 scripts/geo/check-xml.py
node --import tsx --test tests/geo/*.test.* tests/seo/*.test.*
node --test tests/quote-flow.test.mjs tests/analytics.test.mjs tests/automation-proxy.test.mjs
node scripts/geo/verify-preview.mjs
```

Le contrôle global `astro check` n’a pas été repris pour cette livraison ; dans l’environnement local, il inclut d’autres applications et tests du dépôt et présentait notamment des déclarations Node manquantes lors du travail précédent. Il ne constitue pas une validation de ce changement. Les résultats ci-dessus correspondent aux contrôles effectivement exécutés.

## Après validation et publication

Dans Google Search Console et Bing Webmaster Tools, vérifier ou soumettre le sitemap principal `https://flex-web.fr/sitemap.xml`. Les deux pages françaises, les deux guides français et les quatre nouvelles pages anglaises ci-dessus sont les URL prioritaires à inspecter une fois publiées. Ne pas soumettre les URL de prévisualisation.

Pour compléter les preuves, il faudra les liens des profils professionnels officiels, les autorisations de publier des cas clients supplémentaires et, si souhaité, des mesures documentées avant/après. Les conditions réelles des projets internationaux et l’accompagnement en anglais restent à confirmer avec le propriétaire.

## Fichiers modifiés ou créés

- `scripts/geo/validate.mjs`
- `scripts/geo/verify-preview.mjs`
- `src/components/geo/GeoPage.astro`
- `src/components/global/Footer.jsx`
- `src/data/geo/pages.ts`
- `src/data/geo/site.ts`
- `src/data/geo/web-app-pages.ts`
- `src/data/search-summary.ts`
- `src/lib/acquisition.ts`
- `src/lib/seo/core-pages.ts`
- `src/pages/creation-application-mobile.astro`
- `src/pages/creation-site-internet.astro`
- `src/pages/guides/[slug].astro`
- `tests/geo/acquisition.test.ts`
- `tests/geo/browser.test.mjs`
- `GEO-SITES-APPLICATIONS-2026-10-28.md`

Ce rapport, ajouté après la validation, ne modifie pas les fichiers de l’aperçu testé.
