# Notifications IndexNow de Flex-Web

Le processus `emdash-publication.yml` notifie les pages commerciales et articles utiles après leur publication effective sur `https://flex-web.fr`. Il ne soumet ni les fichiers de présentation IA (`llms.txt`, `ai-overview.txt`), ni le catalogue territorial complet.

## Sélection et contrôle

1. Le rapport de publication doit confirmer `deployed`, `productionVerified` et un nouveau déploiement. Une exécution planifiée sans changement ne fait aucun appel à IndexNow.
2. Le marqueur public doit correspondre au commit et à l'instantané publiés. Le diff Git part du **commit de la production précédente**, conservé dans le rapport, et non de `HEAD^`. Actions récupère l'historique complet. Un commit absent bloque la notification et produit un diagnostic ; il n'est pas assimilé à zéro changement.
3. Les sources Astro modifiées, les composants partagés explicitement associés et les routes effectivement modifiées par EmDash déterminent les candidats. Une liste bornée autorise l'accueil, about, pricing, les trois prestations et leurs deux régions, les réalisations et les guides `/journal/`. Un lot de plus de 50 URL est bloqué pour revue, jamais tronqué silencieusement.
4. Chaque URL doit être sur `https://flex-web.fr`, sans identifiants, paramètres ni fragment, répondre directement en HTTP 200 HTML, avoir une seule canonique vers elle-même et aucune directive `noindex`/`none` dans les en-têtes ou les balises robots, Googlebot ou Bingbot.
5. Le texte principal, les liens du contenu, le titre, la description et les données structurées forment une empreinte. Le script la compare au déploiement précédent immuable et au registre des notifications reçues. Un changement de fichier CSS/JS ou de navigation seul ne déclenche pas de notification. Le `noindex` d'en-tête ajouté aux aperçus Netlify est ignoré uniquement lors de la comparaison du déploiement précédent ; les contrôles sur la production courante restent stricts.
6. Le fichier public de vérification doit répondre directement en HTTP 200 avec la clé attendue. Le marqueur de production est revérifié juste avant la notification.

## Historique et erreurs

`.cms/indexnow-state.json` conserve les empreintes dont la réception a été confirmée, ainsi que les tentatives incertaines. Le workflow restaure et sauvegarde ce petit registre dans le cache Actions, puis l'archive avec `.cms/indexnow-report.json`. Le cache peut être évincé ; la comparaison avec la production précédente et l'arrêt des publications inchangées empêchent alors les soumissions systématiques du catalogue. Le registre ne constitue pas une base d'indexation.

Une intention est enregistrée **avant** le POST. Un timeout ou une interruption est classé `uncertain`, jamais `submitted`. Le même contenu ne sera pas renvoyé aveuglément. Un rejet HTTP connu est classé `rejected`. Seuls les HTTP 200 et 202 alimentent `submitted` et le registre des réceptions :

- **200** : notification reçue.
- **202** : notification reçue, validation de la clé en attente.
- Aucun des deux ne prouve l'exploration, l'indexation, le classement ou une citation IA.

Une erreur de notification fait échouer cette étape du workflow après la publication ; elle n'annule pas un déploiement déjà vérifié. Les rapports permettent de distinguer ces deux résultats. L'exécution suivante inchangée ne retente pas automatiquement un rejet ou une tentative incertaine. Pour une reprise, vérifier le rapport archivé et la production, puis sélectionner explicitement le lot dans une exécution de maintenance avec les preuves de publication appropriées ; ne jamais supprimer le registre pour forcer un renvoi massif.

`INDEXNOW_URLS` sélectionne un lot explicite à la place de la sélection automatique, mais ne contourne aucun contrôle (périmètre, publication réelle, comparaison, clé, empreinte, limite). `INDEXNOW_REPORT_PATH` et `INDEXNOW_STATE_PATH` permettent de conserver les rapports ailleurs en maintenance. La clé standard est publique dans le fichier `public/indexnow-flexweb-20261001.txt` ; `INDEXNOW_KEY` exige qu'un fichier correspondant soit déjà publié.

## Vérification reproductible

```sh
node --test scripts/seo/indexnow-submit.test.mjs scripts/cms/release-core.test.mjs
```

Les fournisseurs HTTP et publications sont simulés : ces tests n'envoient aucune notification externe. Ils couvrent notamment production inchangée, ancien commit réel, duplication, perte du cache, code 202, rejet, timeout, canonicales, noindex, clé et exclusion des 20 000 fiches.

Documentation primaire vérifiée le 1er octobre 2026 : [IndexNow, protocole et codes de réponse](https://www.indexnow.org/documentation).
