# Durcissement local du verrou EmDash 1.0.1

Date : 30 septembre 2026. Ce correctif local concerne uniquement l’index dérivé
d’utilisation des médias. Il ne change ni l’API publique, ni les droits, ni les
révisions, ni les données ou prix des contenus.

## Pourquoi

Le registre natif conserve des chaînes de promesses dans deux `Map` globales,
pour sérialiser le travail par collection et par contenu. Dans un Worker,
attendre une promesse liée à une requête terminée peut laisser une requête sans
continuation. Les deux annulations observées en production portaient le message
Cloudflare « The Workers runtime canceled this request because it detected that
your Worker's code had hung and would never generate a response ».

Cette observation ne prouve pas à elle seule que ce verrou a causé ces deux
incidents, et ne permet pas d’expliquer toutes les pertes de réponses de
l’import. La charge locale simple avec D1, ainsi qu’un abandon HTTP bref, ne
reproduisent pas spontanément l’incident. Une promesse propriétaire rendue
irrésoluble dans workerd reproduit en revanche un propriétaire annulé puis un
successeur bloqué avec le verrou natif. Le correctif borne l’attente de ce
successeur, tout en refusant d’exécuter son travail hors du verrou.

## Garanties et limites

- L’état partagé contient seulement un identifiant `Symbol` par propriétaire.
  Aucun autre contexte de requête n’attend une promesse partagée.
- Chaque attente utilise son propre temporisateur. L’acquisition est synchrone
  et le délai est revérifié après le réveil : dix secondes maximum avant
  `MEDIA_USAGE_LOCK_WAIT_TIMEOUT`.
- Le propriétaire ancre sa tâche avec le helper **natif** `after`, qui utilise
  le contexte de requête EmDash. Son `finally` libère seulement son propre
  identifiant. L’exception de travail reste propagée ; la promesse transmise à
  l’ancrage est normalisée pour éviter une rejection non gérée.
- Aucun vol, expiration ou reprise forcée du propriétaire n’est permis. Une
  tâche réellement irrésoluble reste verrouillée dans cet isolate : les
  demandes suivantes échouent explicitement au lieu d’exécuter deux écritures
  concurrentes. Il faut alors diagnostiquer la tâche et recycler l’isolate par
  une remise en service contrôlée, pas effacer le verrou en cours.
- L’ordre FIFO n’est pas garanti ; il n’y a pas de ticket de waiter abandonné.
  Une requête dont le client ferme la connexion peut continuer son travail
  déjà autorisé. Le test vérifie l’exclusion, pas l’annulation métier.
- Un verrou local ne synchronise pas plusieurs isolates. Les protections
  natives de génération, les travaux durables et leurs contrôles restent
  inchangés.
- Dix secondes bornent **l’attente du verrou**, pas l’exécution de l’écriture ni
  les appels de réparation. Aucune promesse de délai HTTP global n’est faite.

## Application reproductible

`scripts/apply-emdash-lock-patch.mjs` n’accepte que `emdash@1.0.1` et le fichier
`dist/registry-CzPJNu3H.mjs` avec ces empreintes SHA-256 :

| État | SHA-256 |
| --- | --- |
| Paquet npm original | `e5861c77bbcb009856585ec3ad0fa31c6d47853d0ac23472c16f68d44c289058` |
| Correctif local | `5e2e36f850f229cc1666b262fa6a25e18c4b7c8de220618f8b34575c27656785` |

Il applique des substitutions exactes, vérifie le résultat, puis remplace le
fichier atomiquement. Il est idempotent. Toute version ou empreinte inconnue
bloque la commande ; aucune tentative de patch approximatif n’est faite.
Le dépôt conserve les substitutions et le module lisible
`src/runtime/request-owned-lock.mjs`, jamais le bundle complet d’EmDash. La
source map native devenue inexacte est retirée du bundle modifié.

Les hooks npm `predev`, `precheck`, `prebuild` et `predeploy:*` appliquent ce
contrôle après chaque `npm ci`. Utiliser ces scripts npm ; une invocation directe
d’`astro build` court-circuite les hooks. `npm ci` rétablit les octets natifs,
mais les hooks réappliquent le correctif au prochain build. Pour un retour au
comportement original, retirer explicitement ces hooks et réinstaller le paquet,
ou redéployer une version préalablement vérifiée. Ne jamais retirer un verrou
vivant pendant un import.

## Réparation et résultat primaire

La voie incrémentale active passe par `processMediaUsageWorkAfterWrite`. Son
`catch` natif appelle `retryClaimedWorkBatch` avec
`MEDIA_USAGE_PROCESSING_FAILED` (cinq tentatives, délai initial 30 secondes),
puis enregistre l’échec terminal. Ce chemin et les leases durables sont
inchangés. Une lease déjà accordée n’est pas récupérée artificiellement par le
correctif ; son délai natif est de 1 200 secondes.

Dans la voie legacy, le timeout peut survenir avant les `catch` internes. Deux
wrappers marquent donc la collection `stale` avec le helper natif sûr, **sur le
seul code** `MEDIA_USAGE_LOCK_WAIT_TIMEOUT`, puis relancent la même erreur :

- `refreshContentMediaUsageAfterWrite` : `CONTENT_USAGE_REFRESH_ERROR` ;
- `deleteContentMediaUsage` : `CONTENT_USAGE_DELETE_ERROR`.

Les autres erreurs et la réparation de collection restent natives. Le runtime
EmDash absorbe déjà certaines erreurs d’index dérivé après une écriture primaire
réussie : une réponse 200 ne prouve donc pas que l’index média est complet.
Ne pas déclarer `complete` sans contrôle natif. Le helper `mark...Safely` peut
lui-même échouer si D1 est indisponible ; les logs et la réconciliation restent
nécessaires.

La suppression d’une collection peut échouer après son DROP et laisser un
nettoyage média à terminer. Ce comportement partiel préexistant n’est pas
transformé en faux succès. Ne pas effacer arbitrairement l’état d’une collection
qui aurait été recréée sous le même slug.

Le relevé en lecture seule du 30 septembre à 15:10 UTC constatait la capture
incrémentale active, six collections déjà `stale`, 71 travaux sous lease et
deux travaux pending, sans média natif. Cette situation exige le suivi des
travaux natifs ; le correctif ne la prétend pas réparée par simple déploiement.

## Vérifications locales et avant reprise

Les tests couvrent exclusion à 16 requêtes, clés indépendantes, exception du
propriétaire, abandon HTTP du propriétaire après acquisition, deadline dépassé,
propriétaire irrésoluble, identité de libération,
empreintes/version refusées, idempotence et les deux transitions legacy `stale`.
`tests/runtime-lock.workerd.test.mjs` utilise Miniflare/workerd et un D1 local
avec `SELECT 1`, sans appel cloud, compte, secret ou contenu utilisateur.

Commandes depuis cette application avec Node supporté :

```sh
npm test
npm run check
CLOUDFLARE_ENV=preview npm run build
```

Résultat local du 30 septembre à 15:16 UTC : **37 tests réussis**, aucune erreur
Astro (un hint préexistant), compilation de l’aperçu réussie en 9,82 secondes.
Le bundle produit contient le nouveau verrou, l’ancrage natif et les deux
branches legacy `stale`. L’avertissement Vite sur les gros chunks reste présent.

Le déploiement reste une étape distincte : vérifier d’abord l’aperçu, puis un
petit lot natif contrôlé et ses identifiants/révisions. Mesurer séparément les
timeouts transport, codes HTTP, erreurs Worker et états persistés. Ce patch
n’autorise ni une hausse automatique de concurrence ni une reprise aveugle
des créations à résultat incertain.

## Sources primaires

- [Cloudflare : erreurs « The script will never generate a response »](https://developers.cloudflare.com/workers/observability/errors/#the-script-will-never-generate-a-response-errors)
- [EmDash : verrou et rafraîchissement d’utilisation des médias](https://github.com/emdash-cms/emdash/blob/main/packages/core/src/media/usage/content-refresh.ts)
- [EmDash : correctif distinct du mutex de connexion D1](https://github.com/emdash-cms/emdash/pull/2125)

Le code réellement vérifié est le paquet npm **1.0.1**, verrouillé par les
empreintes ci-dessus ; les liens vers la branche amont peuvent évoluer.
