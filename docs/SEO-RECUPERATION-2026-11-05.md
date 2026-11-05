# Récupération des catalogues publiés — 5 novembre 2026

## Références et périmètre

Le point de départ est `main` au commit `eadac9fc8329b4436e89ca5049ba9db53d6622a7`. Le déploiement historique conservé en lecture seule est `https://6ada6fce9a1d4bbb5d4cfa0b--flex-webb.netlify.app`, issu du commit `29ac7d72958d3ca25250ed378b04c1e4f9178dc6`. Les extensions non publiées de la branche historique ne sont pas incluses.

L'inventaire versionné `seo/inventories/published-2026-10-22-and-2026-11-05.json.gz` contient les URL des deux sitemaps et leurs sous-sitemaps d'origine. Il est une preuve d'appartenance aux sitemaps : il ne prouve ni l'indexation, ni le statut HTTP passé de chaque URL. L'outil `scripts/seo/capture-route-inventory.py` refuse de remplacer cette référence si les nombres publiés ont changé sans revue. Les exceptions documentées sont dans `seo/inventories/exceptions.json`.

| Inventaire | URL distinctes | Sous-sitemaps |
| --- | ---: | ---: |
| Archive du 22 octobre | 121 317 | 70 |
| Site public du 5 novembre | 50 648 | 31 |
| Union dédupliquée | 151 473 | — |
| Génération locale candidate | 151 473 | 85 |

La candidate contient les 50 648 URL actuelles et réintroduit 100 825 URL historiques absentes du sitemap actuel. Ce dernier chiffre ne signifie pas que toutes répondaient en 404. Aucune exception n'a été ajoutée à ce stade : les redirections existantes documentées ne figurent pas dans l'inventaire des sitemaps. Aucun retrait d'article produit n'a été annulé.

## Mise en œuvre

Les routes françaises du répertoire national, les fiches applications et CRM et les guides locaux anglais sont générés à leurs adresses historiques. Les deux familles territoriales actuelles conservent leurs composants enrichis et le répertoire national évite les doublons. L'adresse historique `/application-metier-sur-mesure/` dispose de nouveau d'une page de service. Les annuaires relient les familles rétablies ; les pages Savoie, Chambéry et Annecy expliquent le devis et les frais récurrents sans changer les tarifs.

Le pipeline reste GitHub Actions → Netlify. L'aperçu récupère le snapshot du CMS publié, le valide et l'applique avant compilation. Le manifeste CMS et les identifiants existants n'ont pas été remplacés. `scripts/seo/validate-recovered-inventory.mjs` vérifie la conservation des URL, les exceptions, les sous-sitemaps actuels et, après compilation et application du CMS, les balises et données structurées des pages du sitemap. Le contrôle s'exécute avant la publication de production. Les anciennes assertions fixées sur 31 sous-sitemaps et quatre ajouts sont remplacées par l'inventaire et le contrôle de conservation.

## Vérifications et limites

La génération en serveur Astro de développement a été comparée à l'inventaire complet : 151 473 URL, 85 sous-sitemaps et aucun doublon ou écart d'appartenance. Le serveur de développement sert les sous-sitemaps XML avec une barre finale ; seul un build de production et son aperçu permettent de valider leur chemin public exact.

Les échantillons locaux incluent Locronan, Brailly-Cornehotte, Beuvry-la-Forêt, Lezennes, Grenoble et Brézins. Les vues mobiles et ordinateurs vérifient titre, H1, canonique, langue et indexabilité. Les tests de devis utilisent des données et des API simulées ; aucun message réel n'est envoyé. La mesure existante enregistre une demande confirmée séparément des clics, sous réserve du consentement analytique ; les URL historiques nouvellement rétablies ne sont pas toutes reconnues comme pages d'entrée par l'attribution existante, qui reste volontairement restrictive pour éviter d'enregistrer des données privées.

Le sitemap généré en développement et les échantillons ne prouvent pas que les 151 473 fichiers de production ont été construits et déployés. Le build CI, le contrôle HTML exhaustif, les contrôles de liens, le snapshot CMS réel et l'aperçu Netlify doivent encore réussir. La production exige ensuite une validation expresse de l'aperçu. Les soumissions aux moteurs et les comparaisons J+7/J+28 ne sont pas réalisées avant publication vérifiée.
