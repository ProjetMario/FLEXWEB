# CRM SMS et e-mail

L’entrée est `/admin/prospection`. Chaque entreprise possède une fiche qui relie ses séquences e-mail et son contact SMS, avec ses sources, sa qualification et son historique commercial.

## Utilisation

1. Importer le CSV depuis **Import / Export**. Les fiches restent **À qualifier**, sans message préparé ni approbation. L’import détecte les identités déjà présentes et signale les coordonnées contradictoires.
2. Dans **Prospects**, filtrer par département et coordonnées disponibles. Ouvrir une fiche, vérifier l’activité et rechercher son site. Enregistrer la source et les éléments de vérification.
3. Choisir le canal et préparer le brouillon. Les modèles personnalisables sont disponibles dans **Modèles de messages**. La validation du message reste séparée de sa préparation.
4. Dans **SMS & e-mails**, consulter les connexions et activer uniquement une campagne dont les messages ont été validés. Une réponse suspend les séquences des deux canaux ; une opposition ajoute l’entreprise à la liste de non-contact.
5. Traiter les réponses, enregistrer des notes et des rappels, planifier un rendez-vous et mettre à jour le statut commercial jusqu’au client signé.

## Connexions et fonctionnement

- E-mail : boîte IONOS `contact@flex-web.fr`, synchronisation IMAP des réponses de prospects connus. Premier contact puis relances à J+4 et J+10 ; plafond existant de 10 e-mails par jour. Répondre personnellement et consulter les pièces jointes depuis IONOS.
- SMS : action officielle Onoff dans Zapier, confirmation et réponses par webhook. Un premier SMS, sans relance SMS automatique ; plafond existant de 5 par jour. Les tests de raccordement doivent être terminés avant l’activation.
- Un envoi incertain attend une vérification humaine et n’est pas renvoyé automatiquement.
- Les devis et clients sont des vues du suivi commercial ; aucun document de devis n’est généré par ce module.
- Les 50 anciennes fiches de recherche e-mail peuvent être rattachées avec **Relier les anciennes fiches e-mail au CRM**. L’action est idempotente et ne lance aucun envoi.

## Vérification technique

`npm run test:automation` crée une base PostgreSQL locale isolée et applique les migrations SQL Netlify. Les suites couvrent les paiements et projets existants, les envois et réponses e-mail, les SMS et le CRM. `node scripts/test-automation.mjs crm` exécute uniquement la suite CRM.

Les API `/api/crm/import`, `/api/crm/export` et `/api/crm/reconcile` exigent une session avec le rôle SUPER_ADMIN. Les mutations refusent les origines étrangères. Les exports sont privés, non mis en cache et neutralisent les formules CSV.
