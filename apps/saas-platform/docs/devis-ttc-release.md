# Devis TTC — publication du 11 septembre 2026

Les demandes `2026-09-11-ttc` enregistrent `taxBasis: TTC` dans leur offre. Les montants de création et des options sont taxes incluses dans Stripe ; le webhook contrôle le total TTC. Le catalogue `2026-09-11` et les contrats sans version restent en HT, avec vérification historique du sous-total.

Aucune migration ou modification de proposition existante. Les demandes IA/application restent sur devis distinct. Tests : les deux formules, les quatre combinaisons d’options, les webhooks répétés et les montants incorrects, dans une base PostgreSQL locale et avec Stripe simulé.

Publication de la plateforme depuis le répertoire autonome de build avec node_modules locaux et binaires Sharp Linux. Les paiements et les e-mails automatiques restent désactivés tant que les comptes externes ne sont pas raccordés.

## Runtime Netlify Database

Utiliser Netlify CLI 27.5.2 (ou une version compatible ultérieure) pour **la compilation et le déploiement**. Le CLI global 23.15.1 produit un bootstrap 2.8.3 qui ne fournit pas la connexion Netlify Database : les pages statiques fonctionnent, mais les accès à la base échouent. Un simple redéploiement sans compilation conserve ce bootstrap obsolète.

La compilation doit afficher l’étape « Netlify Database setup ». Vérifier les cinq migrations déjà appliquées, sans migration en attente, puis contrôler une requête de devis volontairement incomplète avec chaque version de catalogue : réponse 400 pour les champs requis, aucune erreur de version, aucun projet créé. Ne publier le site marketing qu’après ce contrôle sur la plateforme publiée.
