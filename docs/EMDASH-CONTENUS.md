# Contenus Flex-Web dans EmDash

Le site public reste un site Astro statique sur le projet Netlify `flex-webb`. Le CMS est une application indépendante dans `apps/content-cms/`. Le CRM, les comptes clients et les données de prospection ne sont pas déplacés.

## Collections et migration

Six collections : pages, pages commerciales, réalisations, guides, communes et fiches territoriales. Les communes conservent leur code INSEE ; chaque fiche conserve son couple axe/code INSEE et son URL publique. L’import concerne les contenus publics émis par la compilation, pas une promesse de relecture individuelle des fiches territoriales.

Après une compilation du code source sans snapshot actif :

```sh
npm run build
npm run cms:export
node scripts/cms/import.mjs --input .cms/import.ndjson.gz
```

L’export produit un manifeste compressé versionné (`cms/baseline.json.gz`), un import compressé privé et un rapport des volumes. L’import sans `--execute` est une simulation. Le lancement réel exige l’origine HTTPS du CMS et un jeton administrateur natif dans l’environnement, jamais dans les arguments de commande. `--publish-baseline` initialise les nouvelles fiches dans le catalogue publié du CMS ; cela ne déploie pas le site Netlify. Un identifiant ou une URL existants ne sont jamais écrasés. Les réponses incertaines et les contenus modifiés pendant l’import sont signalés pour vérification.

Avant le premier import distant, vérifier le stockage D1 réel du compte, le poids décompressé de l’export, les révisions et les index. La documentation Cloudflare indique 500 Mo par base gratuite et 10 Go par base Workers Paid : <https://developers.cloudflare.com/d1/platform/limits/>. La création de ressources ne vaut pas autorisation d’acheter un abonnement. Les quotas et le compte de déploiement doivent être connus avant l’import complet.

## Modifier et publier

1. Ouvrir la fiche correspondant à l’URL et modifier le texte ou ses métadonnées.
2. Enregistrer pour conserver un brouillon. Cette action seule ne publie rien sur Flex-Web.
3. Pour un guide national soumis au registre de relecture, charger la version dans le panneau Publication, la relire et attester explicitement cette version. L’empreinte devient périmée dès qu’un champ contrôlé change.
4. Utiliser le bouton Publier d’EmDash. Le prochain contrôle automatique regroupe les versions publiées, vérifie le site et son aperçu, puis publie ce même déploiement Netlify si tous les contrôles passent.
5. Le statut « Déployé sur le site » confirme la mise en ligne. Un contenu simplement publié dans EmDash est une version candidate, pas encore une preuve de déploiement.

Les textes conservent leurs emplacements dans les composants. Les identifiants de blocs, la structure des titres, les formulaires et les composants interactifs sont protégés. Les sections supplémentaires passent par `data.additionalSections` (titre et texte). Les montants et conditions des blocs tarifaires restent gérés par le catalogue partagé du code, afin de garder les demandes et devis cohérents.

Les images de contenu sont décrites dans `data.images` : clé stable, source, texte alternatif et dimensions. Une image peut conserver son asset actuel ou utiliser une URL de la médiathèque de la même instance EmDash. Les changements de source retirent les anciens `srcset` pour éviter d’afficher l’ancienne image sur mobile. Les images dans les composants interactifs, la navigation et les formulaires restent gérées avec ces composants.

Les fiches communes contiennent le référentiel source et des notes éditoriales. Les notes sont affichées sur les deux fiches correspondantes (site et automatisation). Un changement des faits ou du code INSEE exige une mise à jour sourcée du référentiel ; il ne peut pas déplacer silencieusement une URL.

## Préserver le code et les relectures

Le snapshot ne modifie aucun fichier source. Il est appliqué après la compilation uniquement aux pages prévues par le manifeste. Si le code a changé les textes ou les images depuis la base importée, la publication s’arrête : comparer les versions avant de rebaser le CMS. Ne pas supprimer les contrôles ou réécrire une empreinte de relecture automatiquement pour passer une validation.

Une nouvelle route, une nouvelle structure de page ou un changement de prix est une évolution du site : préparer le code et sa nouvelle base, faire les tests, puis la publier. La création arbitraire d’une URL dans le CMS ne suffit pas à modifier le routage public.

Les grands snapshots sont archivés en fragments privés vérifiés, puis lus en flux. L’archivage R2 est confirmé avant le déploiement. Ces archives de publication ne remplacent pas une sauvegarde complète de la base D1, des médias et des secrets nécessaires à la restauration du CMS.

## Activation

Voir `apps/content-cms/README.md` pour Cloudflare, l’initialisation de l’administration et les secrets, puis `docs/EMDASH-PUBLICATION.md` pour le déploiement automatique. Tant que la connexion CMS et le premier import ne sont pas vérifiés, la publication automatique reste désactivée et le déploiement Netlify existant continue de fonctionner.
