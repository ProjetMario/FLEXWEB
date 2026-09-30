# Flex-Web — EmDash CMS

Application privée Astro 7.3.5 / EmDash 1.0.1, avec l’adaptateur officiel Cloudflare. Le site public reste compilé et servi par Netlify. Ce dossier ne contient pas le CRM.

## État livré

- Les six collections sont définies dans `seed/seed.json` : pages générales, pages commerciales, réalisations, guides, communes et fiches territoriales.
- Passkeys et récupération d’accès utilisent l’authentification native EmDash. Aucune connexion de contournement ni compte administrateur fictif.
- Le transport de récupération par e-mail utilise Brevo côté serveur. Un succès API n’est pas une preuve de livraison du message.
- L’inscription publique, le mode de connexion de développement et l’accès public aux archives sont bloqués.
- Les brouillons restent dans le CMS. Le pipeline utilise les versions **publiées dans EmDash**, puis effectue ses contrôles, son aperçu et sa publication Netlify. Seul l’état « Déployé sur le site » confirme la mise en ligne.
- Le gateway gère des archives immuables, des fragments vérifiés, des statuts avec concurrence optimiste et des jetons de lecture/écriture séparés.

Le code compile localement. Aucun compte, base ou bucket Cloudflare n’a été créé, aucun import réel ni déploiement CMS n’a été exécuté. La connexion Cloudflare et la première passkey restent à réaliser par le propriétaire.

## Développement et vérifications

Utiliser Node 24.19 ou une version compatible avec `engines` :

```sh
npm ci
npm test
npm run check
npm run build
npm run dev
```

Le serveur de développement tourne sur `http://127.0.0.1:4321`. Avec Astro 7, `astro dev` démarre un processus géré ; `npx astro dev stop` l’arrête. L’état local Cloudflare est dans `.wrangler/`, exclu de Git.

Le seed ne contient aucune entreprise de démonstration. Il définit uniquement le schéma, appliqué par EmDash lors de son initialisation. Une modification future du seed ne remplace pas une migration de schéma déjà initialisé. Après déploiement initial, vérifier les six collections avant tout import ; modifier un schéma existant via les outils natifs, après sauvegarde.

## Mise en service Cloudflare

1. Se connecter avec `npx wrangler login`, puis contrôler le compte avec `npx wrangler whoami`.
2. Vérifier les quotas et la capacité du compte **avant** tout import : taille réelle du NDJSON, données D1, copies de révisions, index et historiques. Le plan gratuit D1 ne doit pas être supposé suffisant pour trente mille contenus. Le protocole accepte jusqu’à 2 Gio par archive fragmentée, mais la durée CPU et les limites de requêtes du plan Workers doivent aussi être mesurées. Ne pas activer de facturation automatiquement.
3. `wrangler.jsonc` sépare les ressources `preview` et `production`. D1 est lié en `DB`, R2 en `MEDIA`. L’adaptateur Astro ajoute également le namespace KV `SESSION` pour les sessions, propre au worker déployé. Les identifiants de ressources réelles ne sont pas inventés dans le dépôt. Examiner les ressources proposées par Wrangler et les autorisations du compte avant création.
4. Configurer les secrets du bon environnement avec `npx wrangler secret put NOM --env preview` ou `--env production`. Ne jamais les mettre dans Git ni dans les variables publiques Astro.
5. Déployer l’aperçu avec `npm run deploy:preview`, vérifier les parcours, puis utiliser `npm run deploy:production`. Ces commandes créent/modifient des ressources réelles ; elles ne font pas partie des vérifications locales.
6. Ouvrir `/bootstrap`, saisir le code initial `FLEXWEB_SETUP_TOKEN`, puis créer le premier compte administrateur et sa passkey dans le vrai assistant EmDash. Le code ouvre uniquement l’assistant pendant 30 minutes et n’authentifie pas le compte. Supprimer/renouveler ensuite ce secret ; sans lui l’assistant public est fermé.
7. Dans Extensions, activer les plugins natifs « flexweb-publication » et « flexweb-brevo » si l’installation ne les a pas déjà activés. Vérifier le transport d’e-mail et faire un test de récupération vers l’adresse du propriétaire. Ne pas conclure à sa livraison avant vérification de la réception.
8. Créer un PAT administrateur natif EmDash pour l’import ponctuel. L’importateur racine crée les éléments manquants, contrôle les identifiants et ne remplace pas les éditions existantes. Publier la baseline uniquement avec son option explicite, puis révoquer le PAT d’import s’il n’est plus nécessaire.
9. Configurer le pipeline avec les jetons backend du gateway, puis vérifier une modification, un brouillon non publié, une publication, une erreur de contrôle et un retour à la dernière version valide.

### Secrets

| Nom | Usage |
| --- | --- |
| `EMDASH_SITE_URL` | URL HTTPS exacte de cet environnement CMS ; locale en développement seulement. |
| `EMDASH_ENCRYPTION_KEY` | Clé de chiffrement native EmDash ; conserver une copie sécurisée pour la restauration. |
| `FLEXWEB_SETUP_TOKEN` | Code aléatoire initial d’au moins 32 caractères ; ne pas utiliser comme mot de passe CMS. |
| `EMDASH_READ_TOKEN` | Jeton aléatoire backend d’au moins 32 caractères ; lecture des snapshots et des deltas. |
| `EMDASH_WRITE_TOKEN` | Autre jeton aléatoire backend d’au moins 32 caractères ; archivage et statuts. |
| `BREVO_API_KEY` | Clé transactionnelle Brevo, exclusivement côté serveur. |
| `FLEXWEB_MAIL_FROM` | Adresse d’expédition vérifiée, prévue : `contact@flex-web.fr`. |

Les valeurs d’aperçu et de production doivent être distinctes. `.dev.vars.example` est un modèle sans secret.

## Contrat d’import natif

Utiliser un PAT EmDash dans `Authorization: Bearer …`, et vérifier le rôle administrateur via `GET /_emdash/api/auth/me` (`data.role >= 50`). Ne pas utiliser les jetons du gateway pour créer des contenus.

- `GET /_emdash/api/content/{collection}?limit=100&cursor=…&fieldFilters={"source_id":"…"}` : enveloppe `{success:true,data:{items,nextCursor,total}}`, avec `fieldFilters` encodé dans l’URL.
- `POST /_emdash/api/content/{collection}` : `{data:{…},status:"draft",locale:"fr"}`.
- `GET /_emdash/api/content/{collection}/{id}` : `{success:true,data:{item,_rev}}`.
- `PUT /_emdash/api/content/{collection}/{id}` : `{data:{…},_rev}`. L’API native conserve les protections de rôle, verrou d’édition et concurrence.
- `POST /_emdash/api/content/{collection}/{id}/publish` : `{_rev}`.

Les champs communs sont `title`, `source_id`, `path`, `seo_title`, `seo_description`, `content` (Portable Text), `data` (JSON), `baseline_hash`, `source_payload_hash`, `base_manifest_hash` et `source_updated_at`.

`source_id` est unique et indexé dans chaque collection. Il ne faut pas modifier les identifiants, chemins, empreintes ou clés `_key` des blocs migrés. Les enrichissements locaux sont dans `data.localOverrides`, sans deuxième copie dans un champ séparé. Les facettes de recherche (`commune_code`, `department_code`, `axis`, `service`) et `editorial_status` ne remplacent pas les données structurées ni les preuves de relecture.

`baseline_hash` est SHA-256 du JSON canonique `{title,seoTitle,seoDescription,content,data}`. Le JSON canonique trie récursivement les clés des objets et conserve l’ordre des tableaux. `base_manifest_hash` est l’empreinte du manifeste initial partagé avec le site public. Les communes ont `path: ""`.

## API de publication

Préfixe : `/api/flexweb`. Les lectures utilisent `EMDASH_READ_TOKEN`, les écritures `EMDASH_WRITE_TOKEN`. Une session native administrateur peut aussi accéder au suivi. Ses mutations exigent une origine identique et l’en-tête `X-EmDash-Request: 1`. Réponses privées `no-store` et non indexables.

| Méthode et chemin | Contrat |
| --- | --- |
| `GET /entries?collection=…&mode=published&cursor=…&limit=100` | `{entries,nextCursor,scanned}` ; limite 1–100, seules les différences avec la baseline sont renvoyées. Continuer même si `entries` est vide quand `nextCursor` existe. Au-delà de 16 Mio : 413 `PAGE_TOO_LARGE`, retenter le même curseur avec une limite inférieure. Le curseur natif suit le dernier identifiant, indépendamment de la limite. |
| `GET /entries?collection=…&mode=candidate&cursor=…` | Même forme ; inclut la révision brouillon pour contrôle explicite, jamais pour le cron de publication. |
| `GET /snapshots?cursor=…` | `{items,nextCursor}` ; états archivés, 100 au maximum. |
| `POST /snapshots` | Petit snapshot JSON standard, 20 Mio maximum : réponse 201 à la création, 200 au nouvel essai. |
| `POST /snapshots/chunks/{hash}` | Tableau d’entrées en JSON canonique, au plus 4 Mio. Hash SHA-256 du tableau canonique. Réponse `{hash,count,bytes,created}`. |
| `POST /snapshots` (fragmenté) | Métadonnées sans `entries`, avec `entryCount` et `entryShards:[{hash,count,bytes}]`. Le serveur vérifie les fragments, doublons, décompte et empreinte du snapshot complet. Réponse `{id,createdAt,entryCount,archived:true}`. |
| `GET /snapshots/{id}` | Snapshot JSON complet standard ; assemblé en flux si fragmenté. 404 s’il n’existe pas. |
| `GET /snapshots/{id}/status` | `{id,state,updatedAt,previewUrl?,deployId?,errors?}`. |
| `POST /snapshots/{id}/status` | `{expectedState,state,previewUrl?,deployId?,errors?}` ; comparaison atomique de l’ETag R2, 409 en cas de concurrence. |

Chaque entrée exportée contient `collection, sourceId, path, title, seoTitle, seoDescription, content, data, revision, updatedAt, baselineHash, baseManifestHash`.

Le snapshot standard est `{schemaVersion:1,id,createdAt,sourceCommit,pricingFingerprint,baseManifestHash,entries}`. `id` est SHA-256 canonique de la racine **sans** `id` ni `createdAt`. L’ordre des entrées fait partie de l’empreinte. L’archive conserve la première date de création. Un nouvel essai répare aussi un statut manquant après interruption, sans remettre à zéro un statut existant.

Limites fragmentées : 50 000 entrées, 1 000 fragments, 4 Mio par fragment et 2 Gio cumulés. Le client vise 3 Mio pour garder une marge. Le test automatisé couvre 21 Mio ; les capacités maximales n’ont pas été mesurées sur un compte Cloudflare. Les fragments orphelins après échec ne sont pas supprimés automatiquement : ne pas les purger tant qu’un manifeste pourrait les référencer.

États : `draft → checking → preview_ready → deployed`. Une erreur conduit à `review_failed`. Une reprise peut partir de `review_failed` ou `preview_ready` vers `checking`. Un rollback confirmé peut marquer un ancien lot `deployed` en `review_failed`. Les notifications strictement identiques sont idempotentes. Le pipeline doit sérialiser ses publications et revalider l’aperçu avant `preview_ready`.

## Relecture éditoriale

La page native du plugin est `/_emdash/admin/plugins/flexweb-publication/publication`. L’action « Attester la relecture » charge un guide par `source_id`, affiche sa version actuelle et demande une confirmation explicite. Elle utilise seulement les API natives, avec `_rev`, et n’active aucune publication.

L’attestation `data.editorialReview` contient `{hash,reviewer,reviewedAt}`. L’empreinte porte exactement sur `{content,seoTitle,seoDescription,additionalSections:data.additionalSections??[]}`. Elle n’est jamais créée par une sauvegarde, un import ou une compilation. Le champ `editorial_status` seul ne vaut pas preuve de relecture. L’attestation stockée est un garde-fou éditorial pour les administrateurs du CMS, pas une signature cryptographique d’un tiers de confiance.

## Sauvegarde et restauration

Avant migration ou modification du schéma, exporter la base D1 du bon environnement et sauvegarder les objets R2 concernés avec les outils Cloudflare/EmDash. Conserver aussi les secrets de chiffrement, le lock npm, le manifeste initial et les archives publiées. Ne pas inclure les secrets dans le site statique.

Tester la restauration dans l’environnement d’aperçu : schéma, comptes/passkeys, contenu, médias, révisions et lecture d’un snapshot connu. Aucun test de restauration distant n’a encore été effectué. Les archives R2 sous `flexweb/` et les sauvegardes sous `backups/` sont volontairement inaccessibles via le proxy média public.

## Références officielles vérifiées

- [Déploiement Cloudflare EmDash](https://docs.emdashcms.com/deployment/cloudflare/)
- [Seed EmDash](https://docs.emdashcms.com/themes/seed-files/)
- [API REST EmDash](https://docs.emdashcms.com/reference/rest-api/)
- [Cycle du contenu et des révisions](https://docs.emdashcms.com/reference/content-lifecycle/)
- [Authentification](https://docs.emdashcms.com/guides/authentication/)
- [E-mails](https://docs.emdashcms.com/guides/email/)
- [Plugins natifs](https://docs.emdashcms.com/plugins/creating-native-plugins/your-first-native-plugin/)
- [Administration React](https://docs.emdashcms.com/plugins/creating-native-plugins/react-admin/)
- [Envoi transactionnel Brevo](https://developers.brevo.com/reference/send-transac-email)

La forme précise des routes, champs, rôles et révisions a également été contrôlée dans le paquet officiel `emdash@1.0.1`, sous `src/astro/routes/api`, `src/seed` et `src/db`.
