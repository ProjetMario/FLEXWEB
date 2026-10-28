# Préparation du catalogue France / Suisse

État : **inventaire préparé, pages non créées et non publiées**. Cet état n’est pas un résultat d’indexation.

L’inventaire distingue 15 000 communes et deux publics, soit 30 000 combinaisons candidates : 12 890 communes françaises et les 2 110 communes suisses présentes dans le relevé officiel au 1er janvier 2026. Pour la France, la sélection est ordonnée par population décroissante puis code INSEE, à partir du fichier déjà sourcé du projet. La Suisse utilise le répertoire de l’Office fédéral de la statistique. Les sources, leurs empreintes SHA-256 et le champ de région linguistique sont conservés dans les données ; la région linguistique ne remplace pas une traduction ni une validation du service dans cette région.

La présence d’une commune dans cet inventaire ne signifie pas que Flex-Web y possède un bureau ou un client, ni que des tarifs, frais, délais, langues ou conditions de vente transfrontalières ont été confirmés.

La demande de projet existante exige aujourd’hui une activité professionnelle, aussi bien dans `src/components/onboarding/StartProject.jsx` que dans `apps/saas-platform/lib/automation/core.ts`. Les parcours destinés aux particuliers doivent être traités de bout en bout, avec des conditions commerciales réellement applicables et une validation de la plateforme de gestion. Une page promettant une demande pour particulier qui serait refusée à l’envoi ne répondrait pas au besoin.

Google recommande de ne pas indexer des pages géographiques très similaires créées principalement pour capter des requêtes : [règles sur les pages satellites et le contenu produit à grande échelle](https://developers.google.com/search/docs/essentials/spam-policies). Avant de publier les pages candidates, il faut vérifier leur contenu, leur utilité et leur différence réelle, ainsi que les canoniques, les liens, le sitemap et les parcours de devis. Aucune suppression des pages existantes n’est prévue sans vérification.

Validation effectuée : trois tests unitaires de sélection et d’entrées erronées ; génération répétée identique ; 30 000 combinaisons uniques entre deux pays, sans création de routes ni modification de la production. Le générateur utilise `--france-json`, `--swiss-csv` et `--output` ; les données source sont fournies explicitement pour éviter les téléchargements ou modifications implicites.
