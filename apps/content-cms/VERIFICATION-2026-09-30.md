# Vérification du CMS — 30 septembre 2026

- Runtime : Node 24.19 ; dépendances épinglées, installation propre terminée et lock npm généré.
- `validateSeed` du paquet officiel `emdash@1.0.1` : `valid:true`, `errors:[]`, `warnings:[]`.
- `npm run check` final : 0 erreur, 0 warning, 1 hint (import inutilisé dans un test).
- `npm test` : 21 tests, 21 réussites. Couverture : empreintes canoniques, tokens fermés par défaut, archives immuables, reprise après interruption, concurrence de statuts, taille des requêtes, transport Brevo simulé, chemins médias encodés, fragments altérés/manquants, doublons, archive cumulée supérieure à 21 Mio et attestation éditoriale explicite.
- `npm run build` final : succès en 19,49 s, sortie serveur d’environ 30 Mio. Avertissement de taille de certains chunks natifs EmDash ; aucune erreur de compilation.
- Smoke HTTP local sur le vrai serveur Astro/EmDash : `/` et `/_emdash/admin` 200 ; `/_emdash/api/auth/me` et `/api/flexweb/snapshots` sans session 401 ; inscription publique 403 ; archive par proxy média 404 ; `robots.txt` 200. Réponses privées et non indexables vérifiées.
- L’agent du pipeline a également exécuté un test croisé de 40 Mio via les vrais helpers `createChunk`, `createShardedArchive` et `streamSnapshot`, avec R2 simulé.
- `wrangler whoami` : compte non authentifié. Aucun compte administrateur créé, aucune passkey enregistrée, aucune ressource Cloudflare créée, aucun e-mail réel envoyé et aucun déploiement CMS exécuté.
- Tests restant après connexion du propriétaire : setup réel et passkey, activation des plugins, récupération par e-mail reçue, import réel avec quotas suffisants, modification dans le navigateur, publication native, pipeline distant, restauration en aperçu et contrôle mobile de l’administration.

Le serveur local a été arrêté. Les répertoires `node_modules`, `dist`, `.astro` et `.wrangler` ne font pas partie des sources à publier dans Git. Le lock permet de réinstaller les dépendances si elles sont retirées pour libérer de l’espace disque.
