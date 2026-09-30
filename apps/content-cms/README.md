# Flex-Web — EmDash CMS

Application privée Astro 7.3.5 / EmDash 1.0.1, avec l’adaptateur officiel Cloudflare. Le site public reste compilé et servi par Netlify. Ce dossier ne contient pas le CRM.

## État livré

- Les six collections sont définies dans `seed/seed.json` : pages générales, pages commerciales, réalisations, guides, communes et fiches territoriales.
- Passkeys et récupération d’accès utilisent l’authentification native EmDash. Aucune connexion de contournement ni compte administrateur fictif.
- Le transport de récupération par e-mail utilise Brevo côté serveur. Un succès API n’est pas une preuve de livraison du message.
- L’inscription publique, le mode de connexion de développement et l’accès public aux archives sont bloqués.
- Les brouillons restent dans le CMS. Le pipeline utilise les versions **publiées dans EmDash**, puis effectue ses contrôles, son aperçu et sa publication Netlify. Seul l’état « Déployé sur le site » confirme la mise en ligne.
- Le gateway gère des archives immuables, des fragments vérifiés, des statuts avec concurrence optimiste et des jetons de lecture/écriture séparés.

Le 30 septembre 2026, le CMS est déployé dans deux environnements Cloudflare distincts : [aperçu](https://flexweb-content-cms-preview.flexweb-content-cms.workers.dev/) et [production](https://flexweb-content-cms.flexweb-content-cms.workers.dev/). Workers Paid, R2 et l’autorisation Wrangler ont été activés avec l’accord explicite du propriétaire. La production comporte six secrets serveur et l’aperçu sept ; leurs valeurs ne sont pas dans le dépôt.

Le propriétaire a créé son compte natif et sa passkey. Le rôle administrateur `50` et `setup_complete=true` sont confirmés. Le bootstrap de production a été fermé le 30 septembre par suppression de `FLEXWEB_SETUP_TOKEN`. L’autorisation OAuth native de la CLI a été approuvée. L’import des 30 582 enregistrements est en cours avec reprise contrôlée ; cette autorisation sera révoquée après l’import et ses vérifications. La restauration D1 avant import est vérifiée dans une base isolée ; les contenus et médias après import restent à vérifier. La publication automatique reste désactivée. Le déploiement du CMS ne vaut pas activation du pipeline public.

Le Worker de production nécessite `vite.environments.ssr.build.rolldownOptions.output.strictExecutionOrder`. Sans ce réglage, le découpage de Kysely crée un cycle de modules avec une classe parente non initialisée : la compilation réussit mais les requêtes HTTP échouent. Le réglage conserve l’ordre d’initialisation et ne change pas les ressources du navigateur. Un contrôle HTTP sur le Worker réellement déployé reste nécessaire en plus de la compilation.

La production utilise le placement Cloudflare `aws:eu-south-1`, à proximité de Milan, où le primaire D1 a été observé (`MXP`). Ce réglage choisit le lieu d’exécution du Worker ; il ne crée aucune ressource AWS. L’aperçu conserve son placement par défaut, son primaire D1 ayant été observé à Marseille. Recontrôler ce choix après une migration de base. Sur cinq lectures d’une même fiche avant/après, la médiane HTTP est passée de 252 à 172 ms ; cet échantillon ne constitue pas une mesure de charge ni une garantie de débit d’import. Les 28 contrôles anonymes passent après déploiement.

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

La configuration Astro déclare aussi le français comme langue de contenu (`i18n.defaultLocale: 'fr'`, `locales: ['fr']`). Le `defaultLocale` du seed seul ne règle pas la langue des futures créations natives. `routing: 'manual'` désactive le routage linguistique automatique Astro ; le middleware applicatif requis délègue sans modifier les URL ni les réponses. L'authentification reste assurée par les middlewares EmDash. Avec une seule langue, EmDash ne filtre pas ses listes par langue ; les fiches existantes gardent leur propre locale. Le manifeste `.emdash/migrations.json` reprend la même configuration sans ajouter de migration. Après déploiement en aperçu, contrôler les routes natives sans préfixe et vérifier `GET /_emdash/api/manifest` : `contentLocale.defaultLocale` doit être `fr`, `implicit` doit être `false`, et l'absence de `i18n` multilingue reste normale. Cette configuration ne migre aucune fiche existante.

## Mise en service Cloudflare

1. Se connecter avec `npx wrangler login`, puis contrôler le compte avec `npx wrangler whoami`.
2. Vérifier les quotas et la capacité du compte **avant** tout import : taille réelle du NDJSON, données D1, copies de révisions, index et historiques. Les seules colonnes de contenu et de données représentent 782 162 177 octets avant historique/index ; le plan Workers Paid a été autorisé pour cette capacité D1. Le protocole accepte jusqu’à 2 Gio par archive fragmentée, mais la durée CPU, le stockage et les limites de requêtes du compte doivent aussi être mesurés. Aucun autre changement de facturation n’est implicitement autorisé.
3. `wrangler.jsonc` sépare les ressources `preview` et `production`. D1 est lié en `DB`, R2 en `MEDIA` et KV en `SESSION`. Les identifiants enregistrés sont ceux des ressources réellement créées. Garder les bindings locaux sans identifiants distants. Après une provision automatique Wrangler, vérifier que les identifiants n’ont pas été écrits dans le bloc local au lieu du bon environnement.
4. Configurer les secrets du bon environnement avec `npx wrangler secret put NOM --env preview` ou `--env production`. Ne jamais les mettre dans Git ni dans les variables publiques Astro.
5. Déployer l’aperçu avec `npm run deploy:preview`, vérifier les parcours, puis utiliser `npm run deploy:production`. Ces commandes créent/modifient des ressources réelles ; elles ne font pas partie des vérifications locales.
6. Sur une **nouvelle instance seulement**, ouvrir `/bootstrap`, saisir le code initial `FLEXWEB_SETUP_TOKEN`, puis créer le premier compte administrateur et sa passkey dans le vrai assistant EmDash. Le code ouvre uniquement l’assistant pendant 30 minutes et n’authentifie pas le compte. Supprimer ensuite ce secret ; sans lui l’assistant public est fermé. Cette étape est terminée en production : ne pas rouvrir le bootstrap pour un import.
7. Les plugins natifs « flexweb-publication » et « flexweb-brevo » sont actifs par défaut sur une base neuve. Après la connexion, vérifier leur état, les six collections et le transport d’e-mail. Si l’initialisation à froid a été interrompue, le POST natif `/_emdash/api/setup` reprend le seed avec `onConflict: skip` et un budget limité ; ne pas remplacer les données existantes. Faire ensuite un test de récupération vers l’adresse du propriétaire. Ne pas conclure à sa livraison avant vérification de la réception.
8. Autoriser la CLI avec `npx --no-install emdash login --url ORIGINE_CMS` : le propriétaire approuve le code sur `/_emdash/admin/device` depuis sa session. Un PAT natif temporaire est une alternative, pas une obligation. L’importateur racine crée les éléments manquants, contrôle les identifiants et ne remplace pas les éditions existantes. Publier la baseline uniquement avec son option explicite, puis révoquer l’autorisation d’import : `emdash logout --url ORIGINE_CMS` pour OAuth, ou révocation du PAT utilisé.
9. Configurer le pipeline avec les jetons backend du gateway, puis vérifier une modification, un brouillon non publié, une publication, une erreur de contrôle et un retour à la dernière version valide.

### Secrets

| Nom | Usage |
| --- | --- |
| `EMDASH_SITE_URL` | URL HTTPS exacte de cet environnement CMS ; locale en développement seulement. |
| `EMDASH_ENCRYPTION_KEY` | Clé de chiffrement native EmDash ; conserver une copie sécurisée pour la restauration. |
| `FLEXWEB_SETUP_TOKEN` | Code initial d’au moins 32 caractères, supprimé en production après création du propriétaire ; ne pas utiliser comme mot de passe CMS. |
| `EMDASH_READ_TOKEN` | Jeton aléatoire backend d’au moins 32 caractères ; lecture des snapshots et des deltas. |
| `EMDASH_WRITE_TOKEN` | Autre jeton aléatoire backend d’au moins 32 caractères ; archivage et statuts. |
| `BREVO_API_KEY` | Clé transactionnelle Brevo, exclusivement côté serveur. |
| `FLEXWEB_MAIL_FROM` | Adresse d’expédition vérifiée, prévue : `contact@flex-web.fr`. |

Les valeurs d’aperçu et de production doivent être distinctes. `.dev.vars.example` est un modèle sans secret.

## Contrat d’import natif

Utiliser un jeton **natif EmDash** dans `Authorization: Bearer …` : access token OAuth issu du Device Flow (`ec_oat_`) ou PAT (`ec_pat_`). L’import actuel exige le scope `admin` et vérifie le rôle via `GET /_emdash/api/auth/me` (`data.role >= 50`). Ne pas utiliser les jetons du gateway pour créer des contenus.

Le code de consentement OAuth expire après 15 minutes, l’access token après une heure et le refresh token après 90 jours. La CLI stocke les credentials dans `~/.config/emdash/auth.json` (ou sous `XDG_CONFIG_HOME`), en accès propriétaire uniquement. L’importateur générique ne rafraîchit pas seul son jeton : pour un import prolongé, le lanceur doit renouveler l’accès via l’endpoint natif, attendre les requêtes en vol et s’arrêter si le résultat du renouvellement est incertain. Ne jamais afficher les credentials ni les transmettre dans la conversation.

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

Avant migration ou modification du schéma, préparer une sauvegarde du bon environnement et des objets R2 concernés avec les outils Cloudflare/EmDash. Le 30 septembre, l’export SQL D1 de cette base a échoué en raison des tables FTS5 : aucun export complet réussi ne doit être déduit de cette tentative. Un bookmark D1 Time Travel a été créé avant import ; il fournit un point de retour, sans constituer un export portable ni une restauration vérifiée. Conserver aussi les secrets de chiffrement, le lock npm, le manifeste initial et les archives publiées. Ne pas inclure les secrets dans le site statique.

Une sauvegarde sélective des 74 tables ordinaires, complétée par le schéma des six FTS, 271 index et 50 triggers, a ensuite été restaurée dans une base D1 isolée sans Worker public. Les empreintes des 206 lignes et du compte/passkey concordent, `quick_check` et les clés étrangères sont valides. Le test précède l’import et ne couvre pas R2, KV, les secrets ni une reconnexion WebAuthn. Les index FTS alors vides doivent être reconstruits explicitement pour une future sauvegarde contenant des contenus. Après import, vérifier aussi contenu, médias, révisions et lecture d’un snapshot connu. Les archives R2 sous `flexweb/` et les sauvegardes sous `backups/` sont volontairement inaccessibles via le proxy média public.

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
