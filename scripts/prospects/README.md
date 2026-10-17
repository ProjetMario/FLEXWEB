# Données de maquettes commerciales Flex-Web

Générateur sans réseau : il lit un export CSV privé du CRM, filtre les fiches « aucun site renseigné sur Google », exclut les oppositions et conversations engagées, dédoublonne et produit des propositions de pages. Il n’envoie aucun message et ne modifie pas le CRM.

## Intégration

- Copier uniquement `public/prospects.json` vers `src/data/prospects.json`.
- Le générateur et son fichier de tests peuvent être copiés dans `scripts/` du projet.
- Ne jamais copier `private/` dans le dépôt, les assets, une sortie de build ou un artefact CI public. Ce dossier contient le registre de rapprochement, les coordonnées, les notes source et les brouillons SMS.
- Les pages doivent porter `noindex`, rester hors sitemap et afficher clairement leur statut de maquette non officielle. Le générateur ne configure pas ces règles HTML/HTTP.
- Les champs publics sont explicitement limités à `slug`, `name`, `activity`, `city`, `theme`, `headline`, `intro`, `services`, `sourceUrl`, `verifiedAt`, `batch`. Il n’y a aucun identifiant CRM, téléphone, email, adresse postale ni note privée.

## Reproduction

```sh
python3 generate-prospect-mockups.py \
  --source '/chemin/prive/export-crm.csv' \
  --repo '/chemin/du/depot' \
  --public-output '/chemin/du/depot/src/data/prospects.json' \
  --private-output '/chemin/prive/registre-maquettes' \
  --as-of 2026-10-17
python3 test-generate-prospect-mockups.py
```

Pour une régénération, ajouter `--previous-registry '/chemin/prive/registre-precedent.json'` afin de conserver les URL. Une collision nouvelle avec une route réservée provoque un échec explicite : aucune URL publiée n’est déplacée silencieusement. Les contenus générés sont reproductibles ; les personnalisations éditoriales futures doivent être conservées dans leur propre source avant régénération.

## État vérifié de cette génération

Export courant du 17 octobre 2026 : 10 655 contacts. Le filtre correspond aux 591 résultats visibles dans le CRM. 564 propositions sont générées après exclusion de 20 oppositions/refus, 3 statuts REPONDU, 3 INTERESSE et AT Concept Garage (site actuel trouvé avec coordonnées concordantes, appartenance officielle non confirmée). Aucun doublon résiduel n’a été trouvé dans cet export. Les 10 pilotes couvrent les 9 thèmes, suivis de lots de 50 et d’un dernier lot de 4.

185 activités manquent dans le CRM : 117 pages proposent une direction clairement étiquetée, tirée uniquement de mots métier explicites dans le nom ; 68 restent neutres. 195 sources datent de plus de 30 jours, 293 de 30 jours ou moins et 76 n’ont pas de date disponible. `verifiedAt` conserve la date réellement exportée et reste `null` lorsqu’elle manque. La date d’export ne constitue pas une nouvelle vérification Google. Aucun logo n’est présent ou annoncé comme vérifié.

L’export ne contient pas d’UUID CRM : `crmId` reste `null` dans le registre. L’enregistrement ultérieur d’une note nécessite un rapprochement contrôlé téléphone + nom + ville et une vérification de lecture après écriture. La valeur `generated_unpublished` ne doit devenir « publié » qu’après contrôle HTTP réel. Les brouillons SMS sont des préparations, pas des envois.

Le test local compte 17 scénarios : filtre, formats de téléphone, oppositions et conversations engagées, propagation aux alias, identité source conflictuelle, dédoublonnage, collisions et conservation des URL, absence de coordonnées privées dans le JSON public, sources malformées, activité inconnue, dates manquantes/futures et génération déterministe.

Les exclusions issues du contrôle externe sont reproductibles : fournir `--verification-overrides /chemin/prive/verification-overrides.json`. AT Concept reste dans `review-holds.json`, avec la source, la date réelle du contrôle et son ancien slug. Le contrôle web limité des 10 pilotes initiaux est conservé dans `pilot-web-evidence.json` ; son remplacement Auto Cluses n’a pas encore été contrôlé sur le Web. Aucun résultat de recherche négatif ne prouve une absence de site.
