# Automatisation FLEX-WEB — Stripe et Brevo

## État au 9 septembre 2026

Le SaaS est déployé sur [flexweb-gestion.netlify.app](https://flexweb-gestion.netlify.app/login), dans le compte Netlify propriétaire `coooolzzzzzzzz`. La base PostgreSQL gérée par Netlify contient le schéma complet et le compte propriétaire a été initialisé. Les demandes et les propositions sont reliées à la vitrine par une API privée.

La vitrine de contrôle est [accessible ici](https://6aa1c514de18cb5721eb1a29--flex-webb.netlify.app/demarrer/). Les paiements et e-mails restent désactivés : les clés Stripe et Brevo ne sont pas encore présentes dans la configuration vérifiée. Aucun paiement ni e-mail réel n'a été envoyé.

Projets Netlify :

- Vitrine `flex-webb` : `5f0ec4e5-fe16-4ef3-8380-9b8aff26edbb`.
- SaaS `flexweb-gestion` : `8629ade6-d7d3-4b72-bf37-a6199968ca48`.

## Parcours implémenté

1. `/demarrer/` recueille activité, coordonnées, formule et besoin. Une demande n'est pas une commande. L'enregistrement crée le prospect, son projet et une relance interne. Les répétitions d'une même demande ne créent pas de doublon.
2. `/espace-projet/` donne un accès privé avec un lien aléatoire valable 180 jours. Le secret est retiré de l'adresse après stockage dans la session du navigateur. Ces pages ne chargent aucun outil analytique. Le client peut conserver son lien.
3. `/admin/prospection/automation` centralise le travail des SUPER_ADMIN : demandes, abonnements payés, support, file d'envoi et erreurs. FLEX-WEB vérifie le périmètre avant d'ouvrir la proposition.
4. Stripe Checkout utilise les prix enregistrés côté serveur, la création et la première mensualité, puis le prélèvement mensuel. Les taxes sont calculées dans Stripe. Le retour du navigateur ne prouve jamais le paiement : seul un webhook signé et revérifié chez Stripe débloque le brief.
5. Un brief complet déclenche cinq pages de brouillon et un formulaire de demande de devis. Les textes proviennent exclusivement des faits fournis. Il s'agit d'une base de travail à personnaliser, pas d'un site final créé par IA.
6. FLEX-WEB contrôle et corrige les contenus. Le client peut les valider ou demander des corrections. Chaque nouvelle version invalide les validations précédentes.
7. La publication exige paiement, contrôle qualité, validation client, domaine principal vérifié et HTTPS. Les informations légales, médias, rendu final et DNS demandent encore une intervention humaine. Le portail client montre un aperçu des contenus ; le rendu du site doit être vérifié séparément.
8. Les demandes reçues sur le formulaire du site client sont enregistrées dans la base, visibles dans son espace et placées dans la file de notification Brevo.
9. Le client ouvre ses demandes de modification dans son espace. L'administration conserve les réponses et le temps passé. Le décompte des minutes incluses et le bilan trimestriel restent à réaliser par FLEX-WEB.

## Architecture de déploiement

- Vitrine Astro à la racine du dépôt : projet Netlify `flex-webb`, domaine flex-web.fr.
- Plateforme Next.js dans `apps/saas-platform` : projet Netlify `flexweb-gestion`, avec PostgreSQL Netlify via `@netlify/database`. Son fichier `netlify.toml` est distinct de celui de la vitrine. Le proxy de session importe `auth.config.ts`, sans Prisma, pour être compatible avec les Edge Functions Netlify. Les vérifications de rôle restent exécutées côté serveur.
- La vitrine transmet les actions vers la plateforme via une fonction Netlify et un secret partagé. L'adresse de la plateforme et ce secret ne sont jamais envoyés au navigateur.
- Une fonction planifiée toutes les dix minutes traite les brouillons en attente et la file Brevo. `AUTOMATION_WORKER_ENABLED=true` est configuré pour la production de la vitrine ; la planification ne fonctionne que sur un déploiement publié. Le traitement interne a répondu sans erreur. Les envois Brevo et paiements Stripe ont chacun leur interrupteur, encore désactivé.

La vitrine impose `prevent_non_git_prod_deploys=true` : la publication sur flex-web.fr passe par le dépôt GitHub `ProjetMario/FLEXWEB`, branche `main`. Le CLI reste utilisable pour les prévisualisations. Conserver cette protection. Un retour arrière en production doit passer par un revert Git et un nouveau build.

## Configuration à fournir dans les environnements sécurisés

Ne jamais coller de secrets dans une conversation, un fichier versionné, une URL publique ou une commande susceptible de les afficher. Les `.env.example` décrivent les clés ; les valeurs réelles se placent dans les réglages Netlify ou les fichiers `.env` ignorés par Git.

| Service | Variables |
|---|---|
| Vitrine Netlify | `AUTOMATION_API_URL` : origine HTTPS de la plateforme ; `AUTOMATION_SHARED_SECRET` : secret aléatoire d'au moins 32 caractères ; `AUTOMATION_WORKER_ENABLED=false` au départ |
| Plateforme | `DATABASE_PROVIDER=netlify`, `AUTH_SECRET`, `AUTH_URL=https://flexweb-gestion.netlify.app`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_ROOT_DOMAIN` ; `NETLIFY_DB_URL` est fournie par Netlify. En local : `DATABASE_PROVIDER=postgres` et `DATABASE_URL`. Supabase est facultatif. |
| Parcours | `MARKETING_URL=https://flex-web.fr`, même `AUTOMATION_SHARED_SECRET`, `AUTOMATION_PAYMENTS_ENABLED=false`, `AUTOMATION_EMAILS_ENABLED=false` au départ |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_BILLING_PORTAL_CONFIGURATION` |
| Brevo | `BREVO_API_KEY` (clé API, pas clé SMTP), `EMAIL_FROM` : adresse vérifiée dans Brevo |

Avant des essais Stripe, utiliser des clés de test. Les essais de formulaire sur la base neuve du projet technique utilisent des destinataires synthétiques `example.test`, les e-mails désactivés et un nettoyage ciblé. Pour des essais futurs avec des clients déjà présents, employer une base isolée et un secret distinct.

## Base de données et administration

Pour une base existante, sauvegarder puis comparer son état et son historique Prisma avant application de la migration additive `prisma/migrations/20260909120000_sales_automation/migration.sql`. Elle crée cinq tables et leurs index ; elle ne remplace aucune table existante. Appliquer avec `prisma migrate deploy` uniquement lorsque l'historique est cohérent.

Pour la nouvelle base Netlify, le schéma complet est fourni par `netlify/database/migrations/001_initial-platform/migration.sql` et appliqué lors du déploiement. Ne pas appliquer seulement la migration Prisma d’automatisation : elle suppose les tables de la plateforme déjà présentes. Ne jamais lancer `prisma db push --accept-data-loss` sur une base existante.

Ne pas utiliser le seed de démonstration pour une mise en production : il contient des comptes de test. L'accès global nécessite un compte propriétaire avec une appartenance `SUPER_ADMIN`. Les demandes non payées peuvent être supprimées après saisie du nom exact de l’entreprise. La suppression est refusée dès qu’un paiement, une session Stripe ou un site existe. Les fiches prospects possédant un historique distinct sont conservées.

Les clients n'ont pas besoin de ces comptes : leur espace utilise le lien privé.

L'initialisation du propriétaire utilise `POST /api/automation/initialize-owner`, avec le secret serveur partagé et un mot de passe d'au moins 24 caractères. Elle prend un verrou transactionnel et refuse dès qu'un utilisateur existe ; elle ne permet pas de remplacer un compte. Cette action est exclue du relais public de la vitrine. Les accès créés sont conservés uniquement dans `.netlify/owner-access.json` (ignoré par Git, permissions `0600`).

Pour redéployer le SaaS depuis ce dépôt, utiliser un répertoire de staging indépendant lié à `flexweb-gestion` : le lien Netlify de la racine appartient à la vitrine. Copier le code en excluant `.env*`, `.netlify`, `.next` et les données locales ; installer les dépendances avec `npm ci`, puis utiliser Netlify CLI 27 ou plus récent : `netlify deploy --prod --context production`. Ne pas copier les anciens secrets Supabase ni les comptes de démonstration.

## Stripe

Configurer un endpoint `https://flexweb-gestion.netlify.app/api/stripe/webhook` pour :

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

Configurer les informations d'entreprise, facturation et Stripe Tax avant activation. Le tarif Croissance enregistré est 990 € HT de création + 299 € HT/mois. Le premier paiement comprend les deux. Les offres antérieures restent disponibles et les projets conservent leur prix et leur périmètre d'origine.

Créer une configuration dédiée du portail Stripe autorisant l'accès aux factures et la mise à jour du moyen de paiement. Ne pas activer un changement d'offre ou une résiliation immédiate qui contredirait le préavis contractuel ; les résiliations sont traitées selon le contrat. Le bouton du portail reste masqué sans identifiant de configuration.

Tester un paiement en mode test, son doublon de webhook, un refus, une régularisation et une résiliation. Basculer ensuite les clés et le secret du webhook vers la production, puis activer `AUTOMATION_PAYMENTS_ENABLED=true` uniquement après contrôle.

Références : [Checkout](https://docs.stripe.com/api/checkout/sessions/create), [webhooks](https://docs.stripe.com/webhooks), [abonnements](https://docs.stripe.com/billing/subscriptions/webhooks).

## Brevo et relances

Le module utilise `POST https://api.brevo.com/v3/smtp/email`, un expéditeur vérifié, des messages texte et une clé d'idempotence stable. Aucune liste marketing n'est créée. Messages prévus : accueil et lien privé, proposition disponible, paiement reçu, brief manquant à J+3/J+7, contenus à valider, publication, réponse de support et nouvelle demande de devis sur un site client.

La file conserve les messages quand l'envoi est désactivé. Avant de l'activer, éliminer les éventuelles données de test et vérifier les destinataires. Le statut `SENT` signifie accepté par Brevo, pas livré dans la boîte de réception. La délivrabilité se contrôle dans le journal transactionnel Brevo.

Un rejet explicite pour limite de débit peut être retenté. Une réponse incertaine, une erreur de configuration ou un traitement interrompu passent en vérification manuelle afin de ne pas renvoyer aveuglément un message déjà accepté. Brevo annonce une fenêtre d'idempotence de 30 minutes ; les tentatives s'arrêtent avant son expiration. Les messages devenus sans objet sont ignorés.

Les nouveaux liens privés sont préparés uniquement lorsque les e-mails sont activés. Leur renouvellement invalide immédiatement le lien précédent.

Références : [envoi transactionnel](https://developers.brevo.com/docs/send-a-transactional-email), [idempotence et durée](https://developers.brevo.com/docs/heterogenous-versions-batch-emails), [mode sandbox](https://developers.brevo.com/docs/using-sandbox-mode).

## Vérification et lancement

Huit tests métier passent. Le parcours demande → connexion propriétaire → qualification → proposition et la suppression des données synthétiques ont aussi été vérifiés sur Netlify, sur ordinateur et mobile, sans envoi ni paiement réel.

Depuis la racine : `npm run build` produit la vitrine. Depuis `apps/saas-platform` : `npm run build`, `npx tsc --noEmit`, `npm run test:automation`. Les tests créent une base PostgreSQL locale temporaire, requièrent `initdb` et `pg_ctl`, et la suppriment à la fin. Stripe et Brevo sont simulés ; aucun client n'est contacté.

Avant publication, vérifier dans une prévisualisation reliée à une base de test : demande complète, lien privé dans Brevo sandbox, qualification admin, Stripe test, brief, brouillon, corrections, validation, domaine/HTTPS et formulaire du site publié. Tester aussi le retour après paiement et la réouverture du lien privé sur mobile.

Le worker peut traiter les tâches internes dès que la base et l’administration sont raccordées. N’activer ses envois qu’après configuration et contrôle de Brevo. Vérifier les journaux et la file d’erreurs après le premier passage planifié.

## Objectif de revenu

Le tableau de bord mesure les mensualités HT d'abonnements payés. Ce chiffre n'est ni un bénéfice ni le revenu personnel net. Le dispositif réduit le travail répétitif ; l'acquisition, la vente, la qualité des livraisons, la marge, les charges et la fidélisation déterminent le résultat économique. Aucun minimum de 10 000 € nets personnels ne peut être garanti par ce code.
