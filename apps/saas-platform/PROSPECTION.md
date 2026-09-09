# Prospection locale FLEX-WEB

Administration : https://flexweb-gestion.netlify.app/admin/prospection/outreach

## Parcours

Le pilote repère jusqu’à 50 entreprises actives, diffusibles et domiciliées en Savoie ou Haute-Savoie, de codes NAF 43.22A/43.22B, ayant au plus 5 établissements. L’Annuaire des entreprises fournit les identifiants ; l’annuaire RGE de l’ADEME complète uniquement les coordonnées associées au SIRET exact. Chaque fiche conserve sa source. L’absence de correspondance impose une recherche manuelle et ne signifie jamais que l’entreprise n’a pas de site.

Un contrôle borné de la page d’accueil prépare des observations techniques et trois brouillons déterministes. Il ne rend pas la page dans un navigateur et ne prouve pas qu’un site est incompatible mobile ou sans formulaire. L’administrateur vérifie les observations, la source, l’adresse et la pertinence professionnelle, puis valide les trois textes. Une modification retire la validation. Les fiches et validations de plus de 30 jours sont exclues des premiers envois ; le bouton d’actualisation permet de revérifier le registre.

La campagne est créée en pause. Aucune prise de contact n’est lancée lors du déploiement. Les contacts froids ne vont pas dans Brevo. Après activation par l’administrateur, le moteur envoie au maximum 10 messages au total par jour ouvré, entre 9 h et 17 h Europe/Paris. Les relances sont dues au plus tôt à J+4 et J+10 (reportées si le créneau est fermé), avec au moins trois jours entre deux messages. Il faut une synchronisation IMAP complète et récente avant chaque envoi.

## Connexion IONOS

Expéditeur autorisé : **contact@flex-web.fr**. Serveurs fixes : smtp.ionos.fr:465 et imap.ionos.fr:993, TLS et certificat vérifié. Dans les variables sécurisées du projet Netlify **flexweb-gestion**, ajouter `IONOS_MAIL_PASSWORD`, contexte Production, toutes les portées (dont Functions), puis redéployer. Ne jamais enregistrer le mot de passe dans le dépôt ou le chat. Le bouton « Vérifier la connexion » contrôle SMTP et IMAP sans envoyer de message.

`OUTREACH_JOBS_ENABLED=true` active le déclencheur de collecte/diagnostic, toutes les 10 minutes (minutes 3,13,23,33,43,53 UTC). `OUTREACH_SEND_ENABLED=true` autorise techniquement le moteur d’envoi ; il reste inactif tant que la boîte n’est pas vérifiée, la campagne n’est pas activée et chaque séquence n’est pas validée. Mettre cette variable à false et redéployer constitue un arrêt global, en plus du bouton « Mettre en pause » immédiatement accessible dans l’administration.

Le mot de passe ne peut pas être testé tant que le propriétaire ne l’a pas configuré. Le raccordement réel et la livraison en boîte ne sont donc pas attestés par les tests automatisés.

## Réponses, désinscriptions et suivi

Le moteur consulte **INBOX uniquement**, sans marquer les messages comme lus, avec un curseur UID. Il ne faut pas déplacer automatiquement les réponses de prospection dans d’autres dossiers. La première synchronisation ignore les anciens courriers avant tout premier envoi. Un changement d’UIDVALIDITY ou un curseur manquant après un envoi suspend l’expédition et demande une réconciliation manuelle.

Tout courrier correspondant à un expéditeur déjà contacté ou aux références d’un message envoyé arrête la séquence, y compris une réponse automatique. Les notifications de non-distribution reconnaissables arrêtent également les relances. Seules des métadonnées liées aux prospects sont enregistrées ; aucun corps de courrier n’est stocké. La qualification « intéressé », « refus » ou « rendez-vous » reste humaine. Une opposition entraîne une empreinte d’adresse globale, contrôlée avant validation et avant envoi. L’arrêt prend effet à sa détection ; un message déjà en cours d’acheminement ne peut pas être rappelé.

Les liens de désinscription sont signés. GET affiche une confirmation sans mutation (pour les scanners d’e-mail) ; POST arrête la séquence. Un résultat SMTP incertain ou une interruption après la prise en charge place le message en vérification, sans nouvel essai automatique. Une seule tâche peut détenir le verrou d’expédition. Ne jamais remettre un message incertain en file sans vérifier le journal IONOS : SMTP ne garantit pas l’idempotence.

Les issues commerciales alimentent les prospects, relances humaines et rendez-vous existants. « Client signé » est une déclaration manuelle ; cela ne déclenche ni facturation ni paiement. Le parcours client existant commence sur https://flex-web.fr/demarrer/.

## Validation et limites

`npm run test:automation` utilise un PostgreSQL temporaire isolé : authentification, paiements et livraison existants, filtrage des annuaires, SSRF, signature et désinscription, validation, gel des messages, détection des réponses, plafond, échéances, erreurs SMTP et verrou concurrent. Aucun vrai e-mail envoyé par les tests.

Le fichier SQL `netlify/database/migrations/002_local-prospecting/migration.sql` ajoute six tables sans modifier les tables existantes. Le déploiement Netlify applique les migrations. Ne pas modifier une migration déjà publiée. Pour revenir à l’application précédente, restaurer le déploiement précédent et conserver les tables ; pas de suppression de données automatique.

L’acquisition doit ensuite être mesurée sur les réponses, rendez-vous, signatures, marge et fidélisation. Le logiciel ne garantit ni des prospects intéressés ni 10 000 € de revenu personnel net mensuel.
