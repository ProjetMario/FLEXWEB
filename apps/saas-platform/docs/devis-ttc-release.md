# Devis TTC — publication du 11 septembre 2026

Les demandes `2026-09-11-ttc` enregistrent `taxBasis: TTC` dans leur offre. Les montants de création et des options sont taxes incluses dans Stripe ; le webhook contrôle le total TTC. Le catalogue `2026-09-11` et les contrats sans version restent en HT, avec vérification historique du sous-total.

Aucune migration ou modification de proposition existante. Les demandes IA/application restent sur devis distinct. Tests : les deux formules, les quatre combinaisons d’options, les webhooks répétés et les montants incorrects, dans une base PostgreSQL locale et avec Stripe simulé.

Publication de la plateforme depuis le répertoire autonome de build avec node_modules locaux et binaires Sharp Linux. Les paiements et les e-mails automatiques restent désactivés tant que les comptes externes ne sont pas raccordés.
