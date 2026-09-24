# Catalogue national : sites internet et automatisation IA

## Livraison et limite actuelle

Cette branche prépare l’expansion, mais **n’implémente pas encore 20 000 contenus**. Elle contient 12 articles originaux (6 sites / 6 automatisation), 3 hubs et 259 URL existantes conservées, soit 274 URL dans le sitemap. Le plan accepté impose une préparation complète avant publication. La branche reste en aperçu tant que les contenus manquants ne sont pas rédigés et vérifiés. Ne pas fusionner en production pour contourner le contrôle.

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
