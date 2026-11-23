# Accueils Flex-Web

Les deux pages Astro utilisent `src/Landing.astro`, le composant des écrans dans `src/Device.astro` et la feuille de style dans `public/studio-redesign/`. Les boutons, les titres accessibles et les variantes françaises et anglaises se modifient dans ces sources.

Les fichiers `baseline/fr.html` et `baseline/en.html` proviennent des deux accueils publics du déploiement Netlify `6b04922cb721fd1ae1c8d810`. Ils contiennent le formulaire effectivement déployé et les versions correspondantes du consentement et de la mesure. Le composant `src/baseline.mjs` en extrait les métadonnées, les scripts, la navigation, le formulaire, la FAQ et le pied de page. Toute évolution de ces éléments doit être vérifiée dans les deux langues.

Les visuels de 2 Savoie Immo sont des captures des pages publiques d’accueil et de catalogue. Les images de FootNation proviennent des captures iPhone du projet dans `acquisition-mobile/public/images/footnation/`. L’image de Serrurier 73 provient de `public/images/showcase/serrurier73.jpg`.

## Construction et aperçu

Depuis la racine du dépôt, `npm ci` installe les versions du fichier de verrouillage. La commande `node acquisition-mobile/redesign/home/build.mjs` génère deux documents HTML et leurs ressources dans `acquisition-mobile/.release/redesign/home/`. Cette commande travaille hors ligne une fois les dépendances installées.

Le workflow `.github/workflows/design-preview.yml` construit les deux accueils et le reste de la refonte, puis assemble ces fichiers avec le catalogue intégral avant de créer un aperçu. Le workflow de publication vérifie le manifeste, les sitemaps et les parcours avant de promouvoir l’aperçu approuvé.
