# Nova Habitat — refonte publiée depuis GitHub

Source de la nouvelle interface dans la branche dédiée `nova-habitat` de `ProjetMario/FLEXWEB`. La branche `main` du site d’agence est inchangée.

Adresse publique conservée : https://nova-habitat-demo-flexweb.netlify.app/

## Modifier la présentation

Modifier `site/index.html` pour les textes et rubriques, `site/nova-v2.css` pour la présentation, et `site/nova-v2.js` pour le menu et le formulaire. Un push sur cette branche déclenche `.github/workflows/nova-habitat.yml` : contrôles du navigateur sur ordinateur et mobile, puis mise à jour de la présentation Netlify.

Le curage est la spécialité principale. Toiture et jardins sont séparés. Le drone reste désactivé. Les avant/après sont explicitement identifiés comme des illustrations IA, et non comme des réalisations réelles. Le fichier original du logo reste sur le site sans aucune modification, avec contrôle de son empreinte SHA-256.

## Architecture de publication — important

**La nouvelle interface est appliquée à l’accueil par le mécanisme officiel de snippet injection de Netlify. Ce n’est pas le remplacement du déploiement historique.** Le script `scripts/publish-presentation.mjs` assemble les textes, styles, comportement et illustrations ; il n’agit que sur `/` et `/index.html` du domaine prévu. L’administration, les liens d’authentification et toutes les autres routes sont exclus.

Cette méthode conserve le déploiement existant et ses six fonctions serveur (`chat`, `crm`, `file`, `speech`, `transcribe`, `upload`). Les sources privées de ces fonctions ne sont pas dans ce dépôt et cinq de leurs bundles ne sont pas récupérables par une simple réutilisation de digest. Un déploiement statique classique risquerait donc de les supprimer.

La nouvelle présentation nécessite JavaScript. Sans JavaScript, la présentation historique reste accessible. Le site conserve son statut de maquette non indexée ; une migration HTML complète et les mentions légales réelles sont à finaliser avant le lancement commercial indexable.

Les illustrations sont embarquées dans la publication : le rendu en ligne ne dépend ni d’un lien temporaire d’aperçu Netlify, ni d’un serveur de génération d’images. `assets.json` conserve leur provenance et le fichier publié conserve une copie de repli pour les mises à jour ultérieures.

**Ne pas glisser uniquement `site/` dans Netlify. Ne pas brancher cette branche sur un build statique Netlify classique tant que les six fonctions n’ont pas été intégrées.** Ne pas supprimer le snippet `Nova Habitat — présentation v2 (GitHub)` tant qu’une vraie migration complète n’a pas été validée.

Le script ancien `scripts/deploy.mjs` est conservé pour référence : il refuse un remplacement complet lorsqu’il manque les bundles des fonctions. Les commandes historiques `npm run deploy` / `npm run preview` qui le ciblent ne constituent pas la procédure de publication actuelle. Utiliser le workflow GitHub ou exécuter `node scripts/publish-presentation.mjs` dans un environnement autorisé après installation de `@netlify/api`, `playwright` et Chromium. Aucun secret ne doit être ajouté au dépôt.

## Demandes de devis

Formulaire Netlify : `nova-habitat-devis-v2`, enregistré par une version HTML statique de validation. Sur l’accueil publié, les demandes sont envoyées en POST au chemin `/`. Les notifications sont configurées pour `73novahabitat@gmail.com`.

Le rapport de publication distingue l’enregistrement du test dans Netlify de la livraison réelle dans une boîte e-mail. Un test portant le nom `NOVA-HABITAT-DEPLOYMENT-CHECK-V2` est une vérification technique, pas un prospect ni une demande de devis.

Les rapports et captures d’écran sont conservés comme artifacts GitHub Actions pendant 14 jours. Le champ `published: true` du rapport signifie que la nouvelle présentation a été vérifiée sur l’adresse publique ; `legacyDeploymentReplaced: false` confirme que le serveur historique n’a pas été remplacé.

Documentation du mécanisme : https://docs.netlify.com/build/post-processing/snippet-injection/
