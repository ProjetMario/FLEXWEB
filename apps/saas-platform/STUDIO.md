# FLEX-WEB Autonome

Offre distincte des prestations accompagnées : un site vitrine de cinq pages,
essai privé de 14 jours sans carte, puis 49 € HT/mois sans frais de création.
L’entreprise confirme son adresse e-mail, renseigne ses informations, corrige
son aperçu et valide les contenus avant le paiement et la publication.

## Exploitation

- Espace client : `/studio` ; supervision : `/admin/prospection/studio`.
- Authentification clients : Netlify Identity, confirmation obligatoire. Les
  administrateurs conservent leur authentification existante.
- Configurer les modèles Identity : `/identity-emails/confirmation.html` et
  `/identity-emails/recovery.html`. Ils renvoient vers `/studio/`.
- Migration additive : `005_autonomous-sites`. Aucune donnée CRM supprimée.
- `STUDIO_OPEN_SIGNUP=false` limite la création aux adresses séparées par des
  virgules dans `STUDIO_PILOT_EMAILS`.
- `STUDIO_AI_ENABLED` active la génération ; `STUDIO_JOBS_ENABLED` active le
  traitement planifié toutes les cinq minutes, en complément du déclenchement
  immédiat. Les appels internes exigent `AUTOMATION_SHARED_SECRET`.
- `STUDIO_EMAILS_ENABLED` active les notifications transactionnelles via le
  compte IONOS existant (`IONOS_MAIL_PASSWORD`). Les envois incertains passent
  en REVIEW sans réémission automatique. Ce flux n’active aucune prospection.
- `STUDIO_PAYMENTS_ENABLED` reste faux jusqu’aux essais Stripe. Configurer
  `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` et
  `STRIPE_BILLING_PORTAL_CONFIGURATION` avec des valeurs du même mode.
  Webhook : `/api/stripe/webhook`, événements checkout, abonnement et facture.
  Activer/configurer Stripe Tax et le portail de résiliation en fin de période.
- Publication standard : `https://flex-web.fr/sites/<slug>`. La vitrine relaie
  `/sites/*` et `/_next/*` vers la plateforme.
- Domaine optionnel : TXT de propriété, CNAME vers la plateforme, puis
  vérification HTTPS. Le raccordement exige `STUDIO_NETLIFY_TOKEN`, à fournir
  avec les droits minimaux appropriés. Sans ce secret le domaine reste en
  attente ; la publication sur l’adresse FLEX-WEB demeure indépendante.

## Limites et reprise

Trois appels IA pendant l’essai, vingt par période mensuelle payée. Chaque
appel réserve 0,25 € avant traitement dans un budget global de 50 €/mois UTC.
C’est une réserve conservatrice, pas une mesure du coût fournisseur. Le modèle
est fixé à gpt-4.1-mini avec sortie limitée ; contrôler la facturation Netlify
avant de changer ce modèle ou ces limites. Les réservations ambiguës restent
consommées. Les modifications concurrentes ne sont jamais écrasées par l’IA.

Les images sont converties en WebP, limitées à 4 Mo par téléversement et
stockées dans Netlify Blobs. Stockage : 50 Mo en essai, 200 Mo avec abonnement.
Les brouillons et leurs images sont privés. Le retour à la publication
précédente conserve deux instantanés. Aucun code généré n’est exécuté.

Un impayé bénéficie de sept jours de grâce. Une résiliation prend effet à la
fin de la période payée. Une suspension conserve les contenus. Les exceptions
de paiement, de domaine et de notification nécessitent une intervention ;
le service ne garantit ni un revenu ni l’absence totale de support.

## Vérification et ouverture

`node scripts/test-automation.mjs` exécute 54 tests dans une base PostgreSQL
locale isolée, dont 11 sur le parcours Autonome. `studio` sélectionne ces onze
tests uniquement. Ils couvrent les quotas concurrents, la séparation clients,
les versions, l’expiration, la publication et Stripe avec un fournisseur simulé.

Avant ouverture générale : vérifier sur Netlify inscription/confirmation,
génération réelle, upload, confidentialité ; puis Stripe en mode test avec
paiement, répétition des webhooks, impayé et résiliation. Ces tests ne remplacent
pas le raccordement et la validation des comptes externes. Passer ensuite aux
clés réelles et ouvrir les inscriptions seulement après réussite de ces étapes.
