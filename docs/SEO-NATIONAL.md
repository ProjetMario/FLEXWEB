# Catalogue national : sites internet et automatisation IA

## Publication du catalogue territorial — 25 septembre 2026

À la demande explicite de l’utilisateur, les **19 988 fiches territoriales** deviennent publiques et indexables sous `/territoires/{sites|automatisation}/{commune-code}/`. Ce choix remplace la restriction précédente aux aperçus. Les **27 guides relus** sous `/ressources/` conservent leur contrôle individuel de relecture ; la publication du catalogue ne transforme pas les fiches en guides relus individuellement.

Les 9 994 communes possèdent deux fiches, avec données officielles, diagnostics, comparaison géographique, simulateur, dossier et brief téléchargeable. Les méthodes sont partagées ; aucune agence locale, référence client ni résultat commercial n’est déduit des données. La relecture éditoriale reste une tâche d’amélioration, distincte de l’autorisation de publier.

Le sitemap émet **20 587 URL** : 291 URL publiques antérieures + 19 988 fiches + 308 pages de navigation (accueil territorial, 107 départements et 200 pages de listes). Les segments contiennent au maximum 2 000 URL, avec une date de publication fixe. Les 228 anciennes pages locales conservent leurs URL. Les anciennes routes `/preparation/*` redirigent en 301 vers `/territoires/*` ; elles ne sont pas émises en double. Seul le JSON de recherche, qui n’est pas une page de contenu, reste `noindex`.

`node scripts/seo/audit-territorial-publication.mjs` contrôle toutes les fiches, leur sitemap, les canonicals, les sources, les outils, les offres TTC, les CTA et le maillage HTML. `check-seo.mjs` contrôle désormais tous les fichiers un par un et ne garde qu’un graphe léger en mémoire. Le registre éditorial conserve ses priorités d’approfondissement et ajoute une destination publique et une date de publication. La génération ne fabrique pas d’empreinte de relecture.

La cible de 100 000 visites organiques mensuelles à 12 mois est un objectif commercial et non une prévision. Les clics Search Console ne sont pas des sessions Analytics. L’absence de données confirmées de visites, ventes ou demandes qualifiées doit rester explicite.

## Fonctionnement

Le catalogue éditorial est `src/data/national/articles.json`. Chaque entrée comporte axe, intention unique, sources vérifiées, date et auteur de relecture, texte spécifique, limites et liens vers des besoins complémentaires. Les exemples sont illustratifs. Les seules capacités et conditions commerciales affirmées sont celles du catalogue partagé. Les idées non développées ne doivent pas être marquées `reviewed`.

Les articles validés émettent `/ressources/sites/{slug}/` ou `/ressources/automatisation/{slug}/`. Les hubs sont paginés par 12 articles. Les anciennes URL sont conservées. Les pages et le sitemap partagent le même filtre `isPublishable` (sélection explicite, statut relu et empreinte de relecture actuelle). Les textes ne sont pas embarqués comme un import JSON Vite : ils sont lus une fois pendant la compilation. Cette décision évite un énorme module JavaScript à grande échelle.

Un sitemap index `/sitemap.xml` référence des segments de 2 000 URL, par famille. Le lecteur de sitemap utilisé par les audits suit cet index, vérifie l’origine et rejette les cycles. Les dates de modification proviennent des contenus, sans actualisation artificielle à chaque build.

Les CTA utilisent les formulaires existants : site 299/590, CRM 990, IA avancée sur devis. Aucune API ni modification du CRM. L’attribution autorise les nouveaux chemins publics sans conserver query strings, jetons ou adresses privées. Elle reste conditionnée au consentement.

## Contrôle et intégration

```sh
npm run build
node scripts/check-seo.mjs
node scripts/seo/quality.mjs
node --import tsx --test tests/seo/national.test.mjs tests/seo/acquisition.test.ts tests/seo/pricing.test.ts
```

Le contrôle national recherche intentions et textes identiques, forte similarité, références manquantes, liens de complément cassés et absence de relecture. Un seuil de mots sert seulement au tri ; il ne prouve pas la qualité. Une relecture reste nécessaire pour l’utilité, la précision et la concurrence avec les pages existantes.

Le build Netlify refuse les défauts détectés, un lot vide, une relecture périmée ou une incohérence entre sélection et sitemap. Il ne bloque plus la publication jusqu’à 20 000 articles : cette cible reste informative. Le champ `reviewHash` fige les textes, sources, intention et périmètre relus ; toute modification exige une nouvelle relecture avant sélection. Ne jamais recalculer automatiquement ces empreintes pendant le build.

Le contrôle neutralise les lieux explicitement déclarés et les chiffres, repère les paragraphes répétés et les besoins identiques malgré un titre différent. Il complète la relecture sans prouver à lui seul l’originalité éditoriale.

## Capacité et exploitation

`node scripts/seo/benchmark.mjs 20000` crée un projet temporaire avec des textes **synthétiques dupliqués**, uniquement pour tester Astro. Il ne mesure pas une qualité éditoriale, ne valide pas 20 000 sujets et ne publie rien. Le répertoire temporaire est supprimé après le test. Utiliser Node 24 comme sur Netlify. Le rapport local distingue compilation, mémoire, taille et limites de l’essai.

Les exports GSC, simulations de formulaire et rapports de compilation sont conservés dans le dossier local ignoré `outputs/seo-national-20260924/`. Ne pas les copier dans `public/` ni les ajouter au dépôt sans examen.

Avant la publication coordonnée : comparer avec la production réelle, rebaser sans écraser les changements, revoir les limites actuelles du compte Netlify, vérifier l’aperçu sur téléphone/tablette/ordinateur et simuler les demandes sans fournisseur réel. Contrôler ensuite le déploiement actif ; soumettre les sitemaps seulement après publication. Le CRM et les campagnes restent inchangés.

## Suite éditoriale et suivi

Étudier les besoins métier au cas par cas ; ne pas générer un produit cartésien de villes et métiers. Les recherches GSC servent de signaux observés, jamais de volumes de marché extrapolés. Compléter avec des sources primaires, des méthodes concrètes et des références autorisées. Conserver les sujets sans preuves comme hypothèses privées.

Chaque semaine : enrichir des contenus distincts dans cette branche ou sa continuation, auditer, consigner le nombre réellement prêt. Chaque mois : 28 jours complets disponibles, marque/hors marque, local/national, sites/automatisation/applications, clics et impressions d’une part, sessions et conversions confirmées d’autre part. Les requêtes anonymisées ne figurent pas toutes dans les exports et leurs sommes ne remplacent pas les totaux du site.

Après publication, examiner séparément soumission, exploration et indexation, puis les demandes reçues. Réunir ou améliorer les pages redondantes. Ne pas promettre un classement ou une citation IA et ne pas soumettre sans cesse des URL inchangées.

## Enrichissement du 24 septembre

Les 19 988 fiches territoriales disposent d’un second instantané officiel (`territorial-enrichment.json`) : codes postaux partagés, homonymes, intercommunalité, superficie et trois centres de communes proches. `enrich-territories.mjs` utilise toutes les 34 969 communes de l’extraction, conserve les 9 994 identifiants du catalogue et vérifie les voisins par une comparaison exhaustive indépendante sur 18 cas. Les distances sont sphériques, jamais des trajets, et une intercommunalité n’est pas une zone de service.

Chaque fiche expose trois diagnostics (fait, action proposée, cas de recette), une comparaison territoriale sourcée, trois questions/réponses et un simulateur de qualification sans réseau ni enregistrement. Les six guides par axe sont des méthodes partagées chargées dans un composant commun ; ils ne sont pas comptés comme 20 000 textes originaux. Les 12 articles relus reçoivent également un cas de recette spécifique et le composant de guides. Les sources techniques sont ajoutées là où elles étayent le sujet (W3C, Google, OWASP).

Les contrôles `audit-enrichment.mjs` et `enrichment.test.mjs` vérifient couverture, stabilité des codes, provenance, partage postal et décisions prudentes du simulateur. Le rapport compte séparément les données uniques et les familles de méthodes communes. Il reste `readyForProduction:false` : une différenciation factuelle ne prouve pas une intention SEO indépendante. Les pages restent en relecture ; aucune promesse d’indexation ou de 100 000 visites.

Deux défauts du contrôle antérieur sont corrigés : la saturation des fragments fréquents n’autorise plus les copies suivantes ; le lot sélectionné exige une relecture actuelle de chaque article, sans compter les pages historiques comme de nouveaux articles. Un contrôle de 125 quasi-copies assure la régression. L’audit SEO conserve les routes et ancres des pages noindex sans garder tout leur HTML en mémoire.

Références éditoriales consultées :
- https://developers.google.com/search/docs/fundamentals/creating-helpful-content
- https://developers.google.com/search/docs/essentials/spam-policies
- https://developers.google.com/search/docs/fundamentals/using-gen-ai-content
- https://developers.google.com/search/docs/appearance/ai-features
- https://geo.api.gouv.fr/decoupage-administratif/communes

## Dossiers territoriaux du 25 septembre

Les **19 988 fiches** disposent toutes d’un dossier de mise en œuvre reproductible (`territorial-dossier.mjs`) : quatre étapes, six groupes de champs, sept à neuf cas de recette et quatre liens métier. Les cas distinguent lieu inconnu, desserte inconnue, disponibilité, projet à distance, reprise d’un événement, ambiguïtés postales et homonymes. Les prestataires, clients, implantations et couvertures commerciales ne sont jamais déduits de la commune.

`node scripts/seo/prepare-territorial-dossiers.mjs` produit un export JSONL complet et un rapport dans le dossier local ignoré. Il vérifie 158 306 décisions attendues et les 19 988 identifiants. Les adaptations comportent 46 profils conditionnels partagés : un hash différent par commune ne prouve pas une intention SEO originale. Le champ `editoriallyApproved` reste à zéro pour ces dossiers ; leur statut n’est pas promu automatiquement.

Le composant `TerritorialDossier.astro` expose le dossier sans dépendance JavaScript. Toutes les fiches restent dans l’aperçu noindex, hors sitemap. Les 24 guides publics et le CRM ne sont pas modifiés par cet enrichissement. Pour une validation éditoriale ultérieure, documenter un besoin local distinct, ses preuves et l’éventuelle consolidation ; les contrôles de génération ne remplacent pas cette décision.


## Navigation, brief et guides locaux — 25 septembre 2026

Le catalogue de relecture possède une recherche par commune, code postal ou INSEE, avec filtres département et difficultés de qualification. Les noms exacts sont classés avant les correspondances du département. La pagination conserve les filtres dans l’URL. Les 107 pages départementales donnent une voie de navigation en HTML, y compris sans JavaScript. Le JSON public du catalogue contient seulement des données géographiques ; comme les fiches, il n’est généré qu’en aperçu et reste sous l’en-tête noindex.

Les 19 988 fiches comportent un brief interactif : prestation, mode de travail, périmètre déclaré, rôle responsable, prochaine action et observations. Le téléchargement `.txt` est réalisé localement, sans stockage ou API, avec champs manquants et statut à relire explicites. Le code INSEE reste une chaîne ; les notes libres ne peuvent pas falsifier l’en-tête de l’export. Aucun CRM, devis, envoi ou scénario d’automatisation n’est créé par ce formulaire.

Trois guides relus et sourcés rejoignent le lot public : présentation des adresses à Annecy, qualification du code postal partagé 74210, migration historique du CRM autour de Valgelon-La Rochette. Les faits proviennent de Légifrance, Insee et de l’API publique de découpage administratif ; les méthodes proposées et cas fictifs sont identifiés. Ils ne sont pas dupliqués par commune. Des liens sont ajoutés seulement depuis les fiches correspondant aux cas cités.

Les dossiers passent en version 2 : un mode de prestation absent ou invalide bloque la proposition de rendez-vous ; un code postal absent reste inconnu. Le simulateur recalcule à l’ouverture et après retour navigateur, puis réinitialise le périmètre lorsqu’on change de commune. L’export vérifie **178 294 décisions** et les **19 988 dossiers**, répartis en 46 profils partagés.

Vérifications : 52 tests ciblés réussis ; compilation complète d’aperçu de 20 591 HTML en 85,18 s ; 799 527 liens territoriaux contrôlés ; compilation de production 296 HTML en 16,91 s ; 291 URL de sitemap, zéro lien cassé, données structurées valides. Dans le navigateur : recherche mobile, homonymes, filtres, état vide, remise à zéro, pagination et focus clavier, retour navigateur du simulateur, téléchargement puis lecture du fichier texte. Pas de débordement sur les rendus vérifiés à 375, 768 et 1440 px ; aucun journal navigateur en erreur.

## Historique et suivi après mise en ligne du catalogue

Les sections datées ci-dessus décrivent les étapes antérieures ; leurs indications « aperçu uniquement » et « hors sitemap » sont remplacées par la décision explicite du 25 septembre. Les nouvelles routes sont produites dans tous les contextes de compilation. Le suivi hebdomadaire doit désormais mesurer la découverte, l’exploration et l’indexation du catalogue, améliorer les fiches selon les besoins observés et conserver les contrôles des guides relus. Ne pas resoumettre les mêmes URL sans modification substantielle.

Contrôles de cette publication : `node --import tsx --test tests/seo/national.test.mjs tests/seo/enrichment.test.mjs tests/seo/acquisition.test.ts tests/seo/pricing.test.ts tests/seo/territorial-dossier.test.mjs tests/seo/territorial-search.test.mjs tests/seo/territorial-brief.test.mjs`, compilation, `node scripts/check-seo.mjs`, `node scripts/seo/quality.mjs --enforce-release` et `node scripts/seo/audit-territorial-publication.mjs`. Preuves finales, déploiements et soumission Google dans `PUBLICATION-2026-09-25/` du dossier de suivi SEO.
