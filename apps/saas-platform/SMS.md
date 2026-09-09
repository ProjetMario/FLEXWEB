# Prospection SMS avec Onoff

Écran propriétaire : `/admin/prospection/sms`. Le module crée des brouillons pour des mobiles professionnels français sourcés. Avant validation : recherche du site au-delà de la fiche Google, pertinence professionnelle, information/opposition ou accord SMS, preuve conservée. Il ne traite pas une coordonnée publique comme un consentement. Le premier pilote vise les artisans de Dolomieu et des Avenières ; aucune collecte des contacts personnels Onoff.

## Fonctionnement

Un seul premier SMS par mobile normalisé, plafond 5 tentatives par jour ouvré, 9–17 h Europe/Paris. La file démarre en pause. Une édition retire la validation. Une validation de plus de 30 jours est exclue. Les numéros fixes sont refusés. Les prises de contact engagées dans le canal e-mail bloquent le canal SMS et inversement. Les réponses et STOP arrêtent les messages en attente ; un message déjà confié à Onoff ne peut être rappelé. Pas de relance SMS automatique dans ce pilote.

Onoff Advanced est compatible avec les webhooks et l’intégration Zapier. L’API REST publique n’expose pas encore d’envoi SMS, mais l’action officielle Zapier **Send a SMS** le permet, sous réserve des restrictions Onoff. Ne jamais employer des endpoints privés de l’application web.

## Raccordement

1. Sur l’écran propriétaire, créer les deux clés. Seules leurs empreintes SHA-256 sont conservées. Elles sont visibles une seule fois. Réception et expédition ont des clés distinctes.
2. Onoff → Intégrations → Onoff SMS Webhook : `https://flexweb-gestion.netlify.app/api/sms/onoff`, clé webhook dans API Key. Onoff utilise `X-API-KEY`, envoie un échantillon puis des notifications SMS. Le serveur vérifie le schéma, déduplique l’ID et filtre le numéro Onoff autorisé. Les messages sans fiche correspondante et les événements antérieurs à la fiche sont ignorés. Les réponses utiles sont conservées, bornées à 2 000 caractères ; jamais tout l’historique privé.
3. Zapier, scénario `FLEX-WEB - Prospection SMS Onoff` : Schedule chaque heure → Webhooks POST `https://flexweb-gestion.netlify.app/api/sms/dispatch`, en-tête `X-API-KEY` avec la clé dispatch, JSON `{"mode":"test"}` → Filter `send` is true → Onoff Business Send a SMS, `from`, `to`, `text` issus du POST. Le test retourne `send:false` et aucun destinataire. Ne pas tester l’action SMS sur un prospect.
4. Remplacer le mode par `claim`, ajouter `requestId` = horodatage stable de l’exécution Schedule. Ne jamais utiliser un identifiant aléatoire recalculé lors d’un nouvel essai. Désactiver Autoreplay et les reprises automatiques du Zap, puis publier et activer la file lorsque les deux connexions sont vérifiées.

Un POST claim marque atomiquement le message comme confié au scénario. Une répétition du même identifiant ne redonne jamais son texte. Tant que l’envoi n’est pas confirmé, aucun suivant n’est confié à Zapier. Après 15 minutes, l’incertitude est affichée : contrôler le journal Onoff puis enregistrer l’envoi ou l’échec, sans renvoi automatique. La confirmation SENT doit correspondre au même numéro, au texte exact et à l’heure de tentative. SENT ne prouve ni livraison ni lecture. Une reprise manuelle dans Zapier de l’étape SMS peut créer un doublon : toujours repartir de la prise en charge par FLEX-WEB et ne jamais rejouer un envoi.

Les webhooks Onoff ne constituent pas une synchronisation exhaustive : après leurs reprises bornées, un événement peut être perdu. Le journal doit être consulté en cas d’anomalie. Les clés seules prouvent la connectivité lors du test ; un vrai envoi de contrôle et sa réponse sont nécessaires pour vérifier toute la chaîne avant un lancement large.

## Déploiement et validation

Migration additive `003_sms-onoff` : cinq tables nouvelles, aucune donnée existante supprimée. Tests sur PostgreSQL temporaire isolé : numéros, secrets distincts, validation, doublons, horaires, concurrence, plafonds, messages incertains, confirmations et STOP. Aucun SMS réel émis par les tests. Le forfait Zapier est un essai Pro de 14 jours constaté lors du raccordement ; les étapes premium nécessiteront ensuite un forfait adapté, sans achat automatique de notre part.

Sources vérifiées le 10/09/2026 :
- https://docs.onoffbusiness.com/webhook/reference/send-sms-log
- https://docs.onoffbusiness.com/webhook/authorization
- https://zapier.com/apps/onoff-business/integrations
- https://www.cnil.fr/fr/la-prospection-commerciale-par-sms-mms
