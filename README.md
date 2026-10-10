# Nova Habitat — refonte depuis GitHub

Source dédiée dans la branche `nova-habitat` de `ProjetMario/FLEXWEB`. La branche `main` du site d’agence reste inchangée.

Adresse publique conservée : https://nova-habitat-demo-flexweb.netlify.app/

## Modifier et publier

Modifier `site/index.html` pour les textes et rubriques, `site/nova-v2.css` pour la présentation, et `site/nova-v2.js` pour le menu et le formulaire. Un push sur cette branche déclenche `.github/workflows/nova-habitat.yml` : publication du service de formulaire, contrôles navigateur ordinateur et mobile, puis publication de la présentation.

Le curage est la spécialité principale ; toiture et jardins sont séparés. Le drone reste désactivé. Les avant/après sont identifiés comme des illustrations IA, pas comme des réalisations réelles. Le logo d’origine est conservé sans modification et contrôlé par son empreinte SHA-256.

## Architecture — à conserver

La nouvelle interface est appliquée à l’accueil par le mécanisme officiel de **snippet injection Netlify**. Ce n’est pas le remplacement du déploiement historique. `scripts/publish-presentation.mjs` assemble les textes, styles, JavaScript et illustrations, et n’agit que sur `/` et `/index.html` du domaine prévu. L’administration, les liens d’authentification et les autres routes sont exclus.

Cette méthode garde intact le déploiement existant et ses six fonctions (`chat`, `crm`, `file`, `speech`, `transcribe`, `upload`). Leurs sources privées ne figurent pas dans ce dépôt et cinq bundles historiques ne sont pas réutilisables via leur seul digest.

La nouvelle présentation nécessite JavaScript. Sans JavaScript, l’ancienne présentation reste accessible. Le site conserve son statut de maquette non indexée. Une migration HTML complète et les mentions légales réelles restent à finaliser avant un lancement commercial indexable.

Les images sont embarquées dans la publication, sans dépendance à un lien temporaire d’aperçu ou de génération. La provenance figure dans `assets.json` et une copie de repli est conservée dans le snippet publié.

**Ne pas déposer uniquement `site/` sur le projet historique. Ne pas connecter cette branche à un build statique Netlify classique tant que les fonctions ne sont pas récupérées. Ne pas supprimer le snippet `Nova Habitat — présentation v2 (GitHub)` avant validation d’une migration complète.**

## Formulaire permanent

Le projet Netlify `nova-habitat-demandes-5215a04e`, ID `7f29049b-1c35-44a6-9d01-1881e7f2a42b`, appartient au même compte et assure la réception des formulaires. Il est publié par `scripts/publish-forms.mjs`, sans modification du projet historique. Il contient une copie statique de la présentation et de la page de confirmation, sans fonctions privées.

Depuis l’accueil principal, le formulaire effectue un **POST HTML classique** vers `https://nova-habitat-demandes-5215a04e.netlify.app/merci-nova`. Le navigateur affiche la confirmation Nova Habitat puis propose un retour à l’adresse principale. Ce fonctionnement ne repose pas sur une requête CORS opaque ni sur un faux message de succès.

Formulaire : `nova-habitat-devis-v2`. Les notifications du projet de réception sont configurées vers `73novahabitat@gmail.com`. L’ancienne définition de formulaire sur le projet historique n’est pas utilisée pour les nouvelles demandes.

Le test portant le nom `NOVA-HABITAT-DEPLOYMENT-CHECK-V2` est un contrôle technique, pas un prospect. Le script vérifie l’enregistrement réel dans Netlify avant de publier le raccordement. La présence d’une notification configurée ne prouve pas sa livraison dans la boîte e-mail : ce dernier point est indiqué séparément dans le rapport.

## Vérifications et exécution

Le workflow utilise exclusivement l’accès Netlify déjà présent dans l’environnement GitHub `emdash-publication`. Aucun jeton n’est écrit dans le dépôt.

Pour une exécution manuelle autorisée : installer `@netlify/api`, `playwright` et Chromium, fournir `NETLIFY_AUTH_TOKEN` par variable d’environnement, exécuter `node scripts/publish-forms.mjs` puis `node scripts/publish-presentation.mjs`.

Le script historique `scripts/deploy.mjs` est conservé pour référence ; il refuse un déploiement complet lorsqu’un bundle de fonction manque. Les anciennes commandes `npm run deploy` et `npm run preview` ne sont pas la procédure actuelle : utiliser le workflow ci-dessus.

Les artifacts GitHub Actions contiennent les rapports et captures pendant 14 jours. `published: true` confirme la vérification du nouvel accueil sur l’adresse publique. `legacyDeploymentReplaced: false` confirme la conservation du serveur historique. `formSubmissionVerified: true` confirme la réception du test par Netlify.

Documentation : https://docs.netlify.com/build/post-processing/snippet-injection/
