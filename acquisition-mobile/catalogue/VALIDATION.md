# Contrôle de l’aperçu catalogue du 23 novembre 2026

L’aperçu Netlify `6b04922cb721fd1ae1c8d810` contient 151 507 URL canoniques distinctes réparties dans les 85 sous-sitemaps historiques. Les 30 pages entrepreneurs y figurent. Les 275 adresses du candidat mobile et les 151 232 adresses reprises de l’archive ont été rapprochées avec les XML publics de l’aperçu. Les 86 fichiers XML téléchargés ont la même empreinte SHA-256 que les fichiers générés. [Sitemap de l’aperçu](https://6b04922cb721fd1ae1c8d810--flex-webb.netlify.app/sitemap.xml)

| Contrôle | Résultat sur l’aperçu |
|---|---|
| Parcours du catalogue | 22 pages représentatives, dont les 19 familles et des parcours entrepreneurs, testées à 390 et 1 440 px. Chacun des 44 parcours charge la page et suit un lien vers une seconde page en HTTP 200. Le contenu, les images visibles, le titre, la langue, la canonique et la largeur d’affichage ont été contrôlés. |
| Langues couvertes par ces parcours | Français, anglais, allemand et italien. |
| Offre et réalisation mobile | Les 18 pages ont été testées dans les deux formats. Les 29 destinations internes et les quatre fiches Apple testées répondent en HTTP 200. Les FAQ, la navigation, le consentement et l’événement de clic vers le devis ont passé les contrôles. |
| Accueils français et anglais | Comparaison avec la production du 23 novembre. Trois captures identiques sur quatre. Sur mobile anglais, 20 pixels sur 329 160 présentent un léger écart de lissage sur l’illustration. |
| Devis | Trois parcours existants et quatre scénarios de demande simulée, pour les professionnels et les particuliers, couvrent l’affichage avant JavaScript, le budget, le consentement, l’erreur et le succès. Les soumissions d’essai ont été interceptées. |

## Reproduire les contrôles

Depuis la racine du dépôt, avec les dépendances du fichier de verrouillage, exécuter les commandes suivantes. Le contrôle du catalogue nécessite les fichiers d’inventaire générés à la première commande.

```sh
node acquisition-mobile/catalogue/inventory.mjs
apercu='https://6b04922cb721fd1ae1c8d810--flex-webb.netlify.app'
node acquisition-mobile/catalogue/browser.mjs "$apercu"
node acquisition-mobile/scripts/verify-pages.mjs "$apercu"
node acquisition-mobile/scripts/verify-home.mjs "$apercu"
node acquisition-mobile/scripts/verify-quote.mjs "$apercu"
```

Les contrôles navigateur portent sur l’échantillon indiqué. La vérification des URL des 85 sous-sitemaps porte sur l’intégralité de l’inventaire. La découverte et l’indexation par les moteurs seront mesurées après publication du candidat approuvé.

Les 160 322 empreintes du manifeste Netlify distant correspondent à l'artefact attendu. Les 151 232 fichiers HTML repris à l’identique bénéficient de l’audit exhaustif du déploiement d’origine. Les 275 fichiers différents ou nouveaux ont été relus directement par HTTP. En incluant les échantillons de l’archive, le contrôle de cet aperçu a lu 355 pages en HTTP 200. Aucun écart d’inventaire, de canonique, de H1 ou d’indexabilité n’a été détecté. Les 8 592 pages auxiliaires de navigation sont hors sitemap. Un exemple de chacune des neuf catégories auxiliaires a été vérifié pour la directive noindex. [Preuves du contrôle](audit/preview-evidence.json)

Le reçu immuable se trouve dans [release-candidate.json](release-candidate.json). Après validation de cet aperçu et fusion de la branche sur main, le workflow GitHub de publication prend l’identifiant Netlify de ce reçu. Les comparaisons d’inventaire couvrent également les futures publications du CMS et les builds Netlify de production.
