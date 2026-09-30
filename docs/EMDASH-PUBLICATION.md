# Publication EmDash vers Flex-Web

Le CMS Cloudflare fournit le contenu. Le site public reste une compilation Astro statique sur **flex-webb** (`5f0ec4e5-fe16-4ef3-8380-9b8aff26edbb`). Le CRM n'est jamais une cible de ce pipeline. La publication automatique reste **désactivée par défaut** : le workflow nécessite la variable GitHub `ENABLE_EMDASH_PUBLICATION=true`, les connexions serveur et une bascule explicite de la publication Git Netlify.

Dans EmDash, **enregistrer un brouillon ne lance pas sa publication publique**. Le bouton de publication natif rend la révision éligible au prochain lot ; le site public ne change qu'après les contrôles. Le cron utilise exclusivement `mode=published`. `pull --mode candidate` sert à préparer un aperçu explicite de brouillons, jamais à alimenter le pipeline de production, qui récupère systématiquement son propre snapshot `published`.

## Contrat de contenu

Le pipeline utilise uniquement l'adaptateur local `scripts/cms/snapshot.mjs`. Il ne suppose aucun endpoint natif EmDash.

| Commande | Responsabilité |
|---|---|
| `pull --mode published --output <fichier>` | Obtenir une révision explicitement publiée dans le CMS, immuable et archivée, avec octets stables tant que le contenu et le code restent identiques. |
| `validate --input <fichier>` | Vérifier le manifeste de référence, les chemins autorisés, les identifiants, les prix, les surcharges et les preuves de relecture requises. |
| `apply --input <fichier>` | Installer uniquement `.cms/snapshot.json`, sans modifier arbitrairement le code du dépôt. |
| `report --input <fichier> --status <état> [--deploy-id <id>]` | Rapprocher l'état réel de publication avec la révision CMS. |

Le snapshot contient `schemaVersion`, `id`, `createdAt`, `sourceCommit`, `baseManifestHash`, `pricingFingerprint` et `entries`. Les entrées sont les **surcharges** par rapport à l'import initial, pas une copie inutile de toutes les fiches à chaque exécution. Le pipeline fixe `CMS_SOURCE_COMMIT` à la révision Git utilisée et exige son égalité avec `sourceCommit`. Le manifeste de référence est versionné et compressé dans `cms/baseline.json.gz` ; un cache `.cms/manifest.json` peut être fourni pour les tests. Le rapport détaillé est disponible à `CMS_PUBLICATION_REPORT_PATH` (`.cms/publication-report.json`). L'adaptateur relit l'archive serveur après écriture et refuse une réponse non conforme. L'archive locale est également figée sous `.cms/releases/<sha256>.json` et conservée en artefact GitHub 90 jours.

Au-delà de 4 Mio, l'archive est envoyée à R2 par fragments immuables de 3 Mio maximum via `POST /api/flexweb/snapshots/chunks/<sha256>`, puis par un manifeste contenant leurs empreintes, nombres d'entrées et tailles. Le serveur vérifie l'empreinte globale avant d'enregistrer le lot. Une interruption ne transforme donc pas des fragments incomplets en révision publiable. `GET /api/flexweb/snapshots/<id>` conserve le format JSON standard, transmis en flux. Les fichiers, réponses HTTP et empreintes sont traités sans assembler une chaîne JSON globale ; le plafond total est de 2 Gio. Une entrée individuelle dépassant 3 Mio bloque le lot et doit être réduite, sans troncature silencieuse. Le processus de validation garde les objets des entrées en mémoire ; le workflow réserve jusqu'à 6 Gio de mémoire Node. La capacité réelle de Cloudflare et les temps de transfert restent à contrôler lors de la bascule, avant de considérer un très gros lot comme validé en production.

L'export parcourt normalement 100 lignes par page. Si une page dépasse 16 Mio, le CMS renvoie HTTP 413 ; le client recommence au même curseur avec une limite divisée par deux. Le curseur est indépendant de la taille de page, les entrées ne sont pas perdues. Une entrée qui reste trop volumineuse à elle seule bloque explicitement le lot.

La validation ne renouvelle jamais une empreinte de relecture pour faire passer les contrôles. Les 27 guides relus gardent leurs preuves ; une modification qui les invalide bloque la publication jusqu'à relecture réelle. Les montants proviennent du catalogue partagé avec le CRM ; le CMS ne possède aucune autorité sur leur calcul. La publication des fiches territoriales ne constitue pas une attestation de relecture individuelle.

## Déroulement et protections

1. Le workflow regroupe les changements toutes les quinze minutes. Il se déclenche aussi sur `main` pour intégrer les changements de code et les fonctions du site public. Une seule exécution est active ; la demande en attente la plus récente absorbe les changements intermédiaires.
2. Avant l'export CMS, le pipeline lit la politique Netlify : `build_settings.stop_builds=true` et `prevent_non_git_prod_deploys=false` au niveau racine du site sont obligatoires. Une valeur absente ou invalide bloque également. Il récupère ensuite le snapshot, vérifie son origine et le compare à la révision déployée. Si contenu et code sont identiques, aucun nouveau build n'est lancé ; la reprise reste soumise à la politique courante.
3. Il conserve l'identifiant du déploiement public précédent, archive le snapshot, valide puis applique les surcharges. Un changement des octets du snapshot pendant l'opération bloque la publication.
4. Une seule compilation est exécutée. Les contrôles SEO, les relectures, l'audit des fiches et les tests SEO existants sont obligatoires. Les demandes de devis sont testées uniquement en local avec API simulée ; aucun message client n'est envoyé.
5. Une signature des fichiers compilés et un marqueur de version sont produits. `netlify-cli@23.15.1 deploy --no-build` charge les fichiers et fonctions en **aperçu**, avec les règles Netlify existantes. Le site et le domaine d'aperçu sont contrôlés.
6. L'aperçu passe les contrôles HTTP, SEO et mobile/clavier sur neuf pages à 375, 768 et 1440 pixels. Les appels externes et `/api/` sont bloqués pendant les tests de navigation.
7. La politique Netlify et le déploiement public précédent sont relus avant compilation, chargement de l'aperçu et promotion. Avant promotion, le hash de tous les fichiers, la révision du snapshot et `main` doivent aussi rester identiques. La promotion appelle `restoreSiteDeploy` sur **le même identifiant d'aperçu**. Elle ne reconstruit rien.
8. Le site public et son marqueur sont contrôlés. L'état « déployé » est enregistré seulement après ces vérifications. Une réponse réseau perdue lors de la promotion est rapprochée de l'état Netlify ; la mutation n'est jamais répétée aveuglément.

Un contrôle HTTP séparé effectue uniquement `GET /api/automation/intake` sur l'aperçu avant promotion, puis sur le domaine public. L'aperçu doit renvoyer le statut 503 et le JSON exact `{"error":"Les demandes sont désactivées dans cet aperçu. Utilisez flex-web.fr pour envoyer votre projet."}` ; la production doit renvoyer le statut 405 et `{"error":"Méthode non acceptée."}`. Les deux réponses doivent porter `Cache-Control: no-store`. Une erreur 503 générique, une fonction absente ou une page HTML ne satisfait jamais le contrôle.

La fonction autorise la suite du traitement uniquement lorsque `new URL(request.url).origin` vaut exactement `https://flex-web.fr`, indépendamment des métadonnées historiques du déploiement. Cela permet la promotion du même identifiant tout en gardant ses URL d'aperçu bloquées, même si le client forge l'en-tête `Origin`. Les contrôles CSRF, d'action, de format, de taille et de secret restent appliqués ensuite. Le GET précède la lecture des credentials et tout appel au CRM ; il ne confirme ni leur configuration ni la disponibilité du service de devis. Aucun formulaire réel n'est envoyé par ce contrôle.

États internes : `draft` (non activé), `checking` (contrôles en cours), `blocked` (erreur), `deployed` (publication confirmée). Le CMS les affiche en français. Un échec après promotion déclenche un retour au précédent déploiement uniquement si personne n'a publié entre-temps et si la politique autorise encore cette opération. Le rapport conserve `rollback=confirmed|uncertain|skipped-production-changed|skipped-deployment-policy`. Une restauration n'est jamais présentée comme réussie sans lecture de contrôle. Les erreurs fournisseurs brutes et les secrets ne sont pas recopiés dans les rapports.

## Bascule opérateur — à effectuer seulement quand les accès sont prêts

1. Déployer et vérifier le CMS Cloudflare, l'import complet, les sauvegardes de D1/R2, les clés nécessaires à la restauration et l'accès par passkey. Tester une restauration. Créer un jeton serveur limité aux opérations d'export et de statut ; aucune clé n'est exposée au navigateur.
2. Configurer l'environnement GitHub `emdash-publication` : secrets indépendants `EMDASH_READ_TOKEN`, `EMDASH_WRITE_TOKEN` et `NETLIFY_AUTH_TOKEN`, variable `EMDASH_URL`. Les deux jetons CMS correspondent aux credentials serveur limités à l'export et aux archives/statuts, pas à des PAT administrateurs EmDash. Utiliser un compte technique Netlify ayant accès uniquement au site public si le périmètre du compte le permet. Le jeton Netlify est un credential sensible même si le script impose un site fixe.
3. Vérifier que `main` contient le chargeur CMS, les règles de validation, le snapshot de référence et ce workflow. Vérifier l'aperçu d'intégration. Conserver le dernier identifiant de production comme point de retour.
4. Arrêter les builds Git natifs **du site flex-webb uniquement** via le réglage Netlify prévu (`build_settings.stop_builds=true`) et autoriser explicitement la publication par CLI/API (`prevent_non_git_prod_deploys=false`, réglage **Enforce deployment methods**). Le pipeline ne change jamais ces réglages. La restriction Git seule autorise encore les aperçus, mais leur présence ne vaut pas autorisation de promotion. Le dépôt reste lié : Git continue d'être la source du code, mais GitHub Actions devient l'unique orchestrateur. Sans cette bascule, une publication Git ordinaire pourrait réinstaller du contenu antérieur au CMS.
5. Activer `ENABLE_EMDASH_PUBLICATION=true` puis lancer le workflow manuellement. Contrôler la production, le statut CMS et un second passage inchangé qui doit éviter le build. Rien dans les scripts fournis n'arrête les builds Git ou ne configure des secrets automatiquement.

Un nouveau commit `main` pendant les contrôles bloque le lot ancien. L'exécution suivante reprend le code courant avec la dernière révision CMS. Ne pas remettre les builds Git natifs en route sans réintégrer le snapshot public et son mécanisme de récupération, sous peine de perdre les surcharges CMS.

## Incident et restauration

- **CMS indisponible / validation en échec / aperçu erroné** : la production existante reste servie. Corriger puis relancer ; le snapshot d'un lot déjà lancé reste immuable.
- **Déploiement public changé par ailleurs** : bloquer ; inspecter ce qui a été publié. Ne pas forcer l'ancien lot.
- **`NON_GIT_PRODUCTION_DEPLOYS_FORBIDDEN`** : la politique interdit la publication hors Git ou n'est pas vérifiable. Le pipeline s'arrête, y compris sur reprise ; contrôler la bascule opérateur avant de relancer. Il ne désactive pas cette protection automatiquement.
- **Rollback nécessaire** : désactiver la variable d'activation, contrôler l'identifiant actuel puis republier depuis Netlify le précédent déploiement vérifié. Réconcilier le rapport CMS. Les médias et contenus doivent rester disponibles dans l'archive CMS.
- **Exécution interrompue** : le verrou de concurrence GitHub est libéré par GitHub. Le prochain passage consulte le marqueur public avant de construire, ce qui rapproche une promotion effectuée juste avant l'interruption. Un verrou local abandonné doit être supprimé uniquement après vérification que son processus n'existe plus.
- **Rapport CMS indisponible après promotion** : le rapport local indique `statusSyncPending=true`. La production confirmée n'est pas annulée seulement pour une panne de retour de statut ; le prochain passage inchangé peut la réconcilier.

## Vérifications exécutables

```sh
npm run cms:test
# Sans activation, aucune requête CMS ni aucun déploiement :
node scripts/cms/release.mjs
```

Les tests injectent des fournisseurs simulés : concurrence, modification du snapshot ou de l'artefact, changement de production, échec de contrôle, perte de réponse de promotion, rollback et masquage des erreurs sensibles. Un test de 40 Mio traverse le client, le contrat de fragments du serveur, la confirmation HTTP et les fichiers en flux. Il vérifie les empreintes, le décodage UTF-8 fragmenté et les erreurs de taille ou d'interruption. Il ne constitue pas une mesure de charge de 2 Gio en production. Les intégrations réelles restent à valider lors de la bascule, avec les accès Cloudflare/Netlify configurés.

Le workflow de vérification couvre tous les tests `scripts/cms/*.test.mjs`. Un job séparé installe les dépendances verrouillées du CMS sous Node 24, puis exécute son contrôle TypeScript, ses tests et sa compilation. Aucun secret Cloudflare ni déploiement du CMS n'est nécessaire pour ce contrôle ; les modifications du code, du schéma d'import, de l'interface et du lockfile le déclenchent.

Références vérifiées : [API Netlify](https://open-api.netlify.com/) (`restoreSiteDeploy`), [déploiements avec l'API](https://docs.netlify.com/api-and-cli-guides/api-guides/get-started-with-api/), [politique des déploiements Git](https://docs.netlify.com/build/git-workflows/overview/#enforce-git-based-deployments), [concurrence GitHub Actions](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency). Le CLI installé a été vérifié : `--no-build` est disponible ; il ne doit pas être combiné avec `--context`.
