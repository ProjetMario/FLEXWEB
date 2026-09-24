# Catalogue national : sites internet et automatisation IA

## Livraison et limite actuelle

Le catalogue contient désormais **20 000 articles : 10 000 sites et 10 000 automatisation IA**. Il comprend 12 articles relus et **19 988 brouillons territoriaux générés**, fondés sur 9 994 communes de l’API officielle de découpage administratif. Ces brouillons partagent des modèles : ils ne sont pas 19 988 contenus SEO distinctifs validés. Ils sont disponibles uniquement dans les aperçus sous `/preparation/`, avec `noindex`, et sont exclus des sitemaps. La production reste protégée par le contrôle éditorial.

La compilation réelle du 24 septembre a produit 20 467 pages HTML en 53,18 secondes, navigation et pages historiques comprises. Le sitemap public reste à 274 URL. Le générateur `scripts/seo/generate-territorial-drafts.mjs` conserve la provenance et l’empreinte de la source dans `territorial-drafts.json`. Les communes sont sélectionnées par population disponible, sans prétendre mesurer la demande commerciale. Le rendu des brouillons exige simultanément `CONTEXT=deploy-preview` et `FLEXWEB_DRAFT_PREVIEW=1`.

La cible de 100 000 visites organiques mensuelles à 12 mois est un objectif commercial et non une prévision. Les clics Search Console ne sont pas des sessions Analytics. L’absence de données confirmées de visites, ventes ou demandes qualifiées doit rester explicite.

## Fonctionnement

Le catalogue éditorial est `src/data/national/articles.json`. Chaque entrée comporte axe, intention unique, sources vérifiées, date et auteur de relecture, texte spécifique, limites et liens vers des besoins complémentaires. Les exemples sont illustratifs. Les seules capacités et conditions commerciales affirmées sont celles du catalogue partagé. Les idées non développées ne doivent pas être marquées `reviewed`.

Les articles validés émettent `/ressources/sites/{slug}/` ou `/ressources/automatisation/{slug}/`. Les hubs sont paginés par 12 articles. Les anciennes URL sont conservées. Les pages et le sitemap partagent le même filtre `reviewed`. Les textes ne sont pas embarqués comme un import JSON Vite : ils sont lus une fois pendant la compilation. Cette décision évite un énorme module JavaScript à grande échelle.

Un sitemap index `/sitemap.xml` référence des segments de 2 000 URL, par famille. Le lecteur de sitemap utilisé par les audits suit cet index, vérifie l’origine et rejette les cycles. Les dates de modification proviennent des contenus, sans actualisation artificielle à chaque build.

Les CTA utilisent les formulaires existants : site 299/590, CRM 990, IA avancée sur devis. Aucune API ni modification du CRM. L’attribution autorise les nouveaux chemins publics sans conserver query strings, jetons ou adresses privées. Elle reste conditionnée au consentement.

## Contrôle et intégration

```sh
npm run build
node scripts/check-seo.mjs
node scripts/seo/quality.mjs
node --import tsx --test tests/seo/national.test.mjs tests/seo/acquisition.test.ts tests/seo/pricing.test.ts
```

Le contrôle national recherche intentions et textes identiques, forte similarité, références manquantes, liens de complément cassés et absence de relecture. Un seuil de mots sert seulement au tri ; il ne prouve pas la qualité. Une relecture reste nécessaire pour l’utilité, la précision et la concurrence avec les pages existantes.

Le build Netlify exécute les audits. En contexte `production`, le contrôle refuse une publication incomplète (moins de 20 000 URL), des défauts détectés ou une répartition inégale des nouveaux articles entre les deux axes. Les aperçus passent les contrôles techniques mais le rapport conserve `ready:false` tant que la cible n’est pas remplie. Ne jamais déployer manuellement les fichiers pour contourner cette condition.

## Capacité et exploitation

`node scripts/seo/benchmark.mjs 20000` crée un projet temporaire avec des textes **synthétiques dupliqués**, uniquement pour tester Astro. Il ne mesure pas une qualité éditoriale, ne valide pas 20 000 sujets et ne publie rien. Le répertoire temporaire est supprimé après le test. Utiliser Node 24 comme sur Netlify. Le rapport local distingue compilation, mémoire, taille et limites de l’essai.

Les exports GSC, simulations de formulaire et rapports de compilation sont conservés dans le dossier local ignoré `outputs/seo-national-20260924/`. Ne pas les copier dans `public/` ni les ajouter au dépôt sans examen.

Avant la publication coordonnée : comparer avec la production réelle, rebaser sans écraser les changements, revoir les limites actuelles du compte Netlify, vérifier l’aperçu sur téléphone/tablette/ordinateur et simuler les demandes sans fournisseur réel. Contrôler ensuite le déploiement actif ; soumettre les sitemaps seulement après publication. Le CRM et les campagnes restent inchangés.

## Suite éditoriale et suivi

Étudier les besoins métier au cas par cas ; ne pas générer un produit cartésien de villes et métiers. Les recherches GSC servent de signaux observés, jamais de volumes de marché extrapolés. Compléter avec des sources primaires, des méthodes concrètes et des références autorisées. Conserver les sujets sans preuves comme hypothèses privées.

Chaque semaine : enrichir des contenus distincts dans cette branche ou sa continuation, auditer, consigner le nombre réellement prêt. Chaque mois : 28 jours complets disponibles, marque/hors marque, local/national, sites/automatisation/applications, clics et impressions d’une part, sessions et conversions confirmées d’autre part. Les requêtes anonymisées ne figurent pas toutes dans les exports et leurs sommes ne remplacent pas les totaux du site.

Après publication, examiner séparément soumission, exploration et indexation, puis les demandes reçues. Réunir ou améliorer les pages redondantes. Ne pas promettre un classement ou une citation IA et ne pas soumettre sans cesse des URL inchangées.

## Enrichissement du 24 septembre

Les 19 988 fiches territoriales disposent d’un second instantané officiel (`territorial-enrichment.json`) : codes postaux partagés, homonymes, intercommunalité, superficie et trois centres de communes proches. `enrich-territories.mjs` utilise toutes les 34 969 communes de l’extraction, conserve les 9 994 identifiants du catalogue et vérifie les voisins par une comparaison exhaustive indépendante sur 18 cas. Les distances sont sphériques, jamais des trajets, et une intercommunalité n’est pas une zone de service.

Chaque fiche expose trois diagnostics (fait, action proposée, cas de recette), une comparaison territoriale sourcée, trois questions/réponses et un simulateur de qualification sans réseau ni enregistrement. Les six guides par axe sont des méthodes partagées chargées dans un composant commun ; ils ne sont pas comptés comme 20 000 textes originaux. Les 12 articles relus reçoivent également un cas de recette spécifique et le composant de guides. Les sources techniques sont ajoutées là où elles étayent le sujet (W3C, Google, OWASP).

Les contrôles `audit-enrichment.mjs` et `enrichment.test.mjs` vérifient couverture, stabilité des codes, provenance, partage postal et décisions prudentes du simulateur. Le rapport compte séparément les données uniques et les familles de méthodes communes. Il reste `readyForProduction:false` : une différenciation factuelle ne prouve pas une intention SEO indépendante. Les pages restent en relecture ; aucune promesse d’indexation ou de 100 000 visites.

Deux défauts du contrôle antérieur sont corrigés : la saturation des fragments fréquents n’autorise plus les copies suivantes ; la cible de publication exige désormais 20 000 articles relus, pas seulement 20 000 URL en incluant navigation et anciennes pages. Un contrôle de 125 quasi-copies assure la régression. L’audit SEO conserve les routes et ancres des pages noindex sans garder tout leur HTML en mémoire.

Références éditoriales consultées :
- https://developers.google.com/search/docs/fundamentals/creating-helpful-content
- https://developers.google.com/search/docs/essentials/spam-policies
- https://developers.google.com/search/docs/fundamentals/using-gen-ai-content
- https://developers.google.com/search/docs/appearance/ai-features
- https://geo.api.gouv.fr/decoupage-administratif/communes
