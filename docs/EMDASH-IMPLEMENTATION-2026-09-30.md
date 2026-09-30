# Flex-Web — mise en œuvre EmDash et conversion

État du 30 septembre 2026. Travail isolé depuis la version publique `1bd0339`, en préservant les URL existantes. Ce rapport décrit les changements préparés et les contrôles réalisés ; **la publication en production n’est pas encore confirmée ici**.

## Pages commerciales et demandes de devis

Douze pages ont été renforcées : six pages de services en Savoie et Haute-Savoie, trois réalisations et trois guides métier. Les nouvelles sections rendent visibles les livrables, les informations nécessaires au devis, le premier périmètre réalisable et les étapes suivantes. Les appels à l’action présélectionnent la prestation et l’offre correspondantes ; les applications et les automatisations sur mesure restent sur devis.

Les montants viennent du catalogue partagé : 299 €, 590 € et 990 € TTC, avec options facultatives à 49 € et 99 € TTC/mois. La demande est gratuite ; le paiement suit l’acceptation du devis. Les descriptions des réalisations s’appuient sur les fonctions publiques déjà constatées, sans chiffre de résultat ni témoignage inventé. Les exemples de gains de temps restent explicitement illustratifs.

Routes confirmées à partir du diff `1bd0339..HEAD`, des données de réalisations et des modèles de pages :

| Ensemble | URL publique conservée |
| --- | --- |
| Site — Savoie | https://flex-web.fr/creation-site-internet-savoie/ |
| Site — Haute-Savoie | https://flex-web.fr/creation-site-internet-haute-savoie/ |
| Automatisation — Savoie | https://flex-web.fr/automatisation-ia-savoie/ |
| Automatisation — Haute-Savoie | https://flex-web.fr/automatisation-ia-haute-savoie/ |
| Applications — Savoie | https://flex-web.fr/creation-application-mobile-savoie/ |
| Applications — Haute-Savoie | https://flex-web.fr/creation-application-mobile-haute-savoie/ |
| Réalisation Foot Nation | https://flex-web.fr/realisations/foot-nation/ |
| Réalisation 2 Savoie Immo | https://flex-web.fr/realisations/2savoie-immo/ |
| Réalisation Serrurier 73 | https://flex-web.fr/realisations/serrurier73/ |
| Guide demandes et CRM | https://flex-web.fr/journal/connecter-demandes-crm/ |
| Guide tâches des PME | https://flex-web.fr/journal/taches-automatiser-pme/ |
| Guide automatisation ou application | https://flex-web.fr/journal/automatisation-ou-application-sur-mesure/ |

Ces liens désignent les routes existantes, pas une preuve que la nouvelle version y est déjà déployée. Le composant commun des réalisations bénéficie également des textes clarifiés. Les 27 guides nationaux soumis à relecture restent soumis à leur registre ; aucune empreinte de relecture n’est renouvelée automatiquement.

## CMS et publication

L’application EmDash est isolée dans `apps/content-cms/`, sur l’adaptateur officiel Cloudflare. Elle comporte six collections : pages, pages commerciales, réalisations, guides, communes et fiches territoriales. Le site public reste Astro statique sur Netlify **flex-webb** ; le CRM et ses données ne sont pas déplacés ni redéployés pour ces changements.

Le code permet l’édition des textes, métadonnées et images de contenu, avec protection des routes, identifiants, blocs tarifaires et composants interactifs. Les images conservent leurs wrappers et attributs de chargement ; un changement de source retire les anciens `srcset`. Les médias externes exigent l’origine HTTPS exacte du CMS et son chemin média natif ; les archives privées sont interdites.

L’export prépare un manifeste de référence et un import NDJSON compressé. L’importateur est en simulation par défaut, reprend depuis un checkpoint privé, vérifie les collisions d’identifiants et d’URL et préserve les éditions déjà présentes. Les créations réelles nécessitent `--execute` et un jeton administrateur natif. L’option distincte `--publish-baseline` publie les nouveaux enregistrements dans le CMS ; elle ne déploie pas le site public.

Le pipeline public utilise seulement les révisions publiées dans EmDash. Il contrôle le snapshot et les tarifs, compile, teste un aperçu Netlify puis promeut ce même déploiement si les vérifications passent. Il bloque si le code, le contenu ou la production ont changé entre-temps. **La publication automatique reste désactivée par défaut.**

## Vérifications et preuves disponibles

- 74 tests racine CMS/pipeline validés ; 21 tests du runtime CMS validés. Les fournisseurs externes sont simulés dans ces tests.
- Runtime : schéma natif EmDash validé, contrôle TypeScript sans erreur, compilation réussie et contrôles HTTP locaux de l’authentification et des archives privées. Détails : [vérification du CMS](../apps/content-cms/VERIFICATION-2026-09-30.md).
- [Exécution GitHub Actions 36679291148](https://github.com/ProjetMario/FLEXWEB/actions/runs/36679291148) : trois jobs réussis : contrôles du site public, protections du pipeline et runtime CMS. Le test SEO navigateur attend désormais que l’aperçu local réponde ; le job CMS installe aussi les dépendances du tsconfig parent.
- [Aperçu Netlify 6abcad98282b9c00089e9216](https://app.netlify.com/projects/flex-webb/deploys/6abcad98282b9c00089e9216) : déploiement indiqué prêt. Ce statut seul ne confirme ni tous les contrôles de navigation ni la promotion en production.
- Les tests de demande utilisent une API simulée. Aucun formulaire client ni e-mail réel n’a été envoyé pour ces vérifications.

Compilation complète et audits réussis : 20 587 URL de sitemap, 19 988 fiches territoriales indexables conservées, 228 anciennes pages locales préservées et aucun lien cassé. Les 56 tests SEO et 14 tests de demande/mesure/proxy passent. Les neuf pages prioritaires ont été contrôlées automatiquement à 375, 768 et 1440 pixels, avec navigation clavier et appels externes bloqués. Vérification visuelle du site Savoie à 375 px, de l’automatisation Haute-Savoie à 768 px et de Foot Nation à 1440 px ; le devis à 590 € TTC est correctement présélectionné après chargement. Aucun envoi réel. La promotion en production reste à confirmer. Aucune hausse de trafic, de demandes ou de ventes n’est attribuée à ces changements sans données mesurées.

## Export complet vérifié

La CI a produit puis validé en simulation **30 582 enregistrements** : 323 pages générales, 240 pages commerciales, 34 guides, 3 réalisations, 19 988 fiches territoriales et 9 994 communes. Cela représente 20 588 pages éditoriales, distinctes du décompte des URL indexables du sitemap. Le manifeste est versionné dans `cms/baseline.json.gz`.

- Empreinte du manifeste : `cbdd53b9693abe1ed13314e0862148791661b7f00b230170fbb20eb20767d9a1`.
- Archive locale privée : `.cms/import.ndjson.gz`, 162 677 706 octets compressés ; 802 771 087 octets NDJSON décompressés, sans extraction intégrale sur disque.
- Plus gros enregistrement : 126 543 octets. Contrôle de doublons et validation locale complète réussis ; 0 création distante, 0 publication CMS.
- [Artefact CI de migration](https://github.com/ProjetMario/FLEXWEB/actions/runs/36679291148/artifacts/11081681084). Copie locale conservée au-delà de la rétention CI de 14 jours.

Le volume NDJSON n’est pas une mesure de la taille D1 : les révisions natives et index ajoutent du stockage. La limite de 500 Mo par base D1 gratuite ne permet pas de présumer que l’ensemble tiendra ; vérifier les quotas du compte connecté avant import, sans changement de facturation automatique.

## Activation restant à effectuer

Le compte Cloudflare n’est pas connecté. Aucun CMS distant, ressource D1/R2, premier compte administrateur ou passkey n’a été créé ; aucun import distant ni test réel de récupération par e-mail n’a été exécuté. Le code livré ne constitue donc pas encore un CMS utilisable en production.

1. Connecter le compte Cloudflare et vérifier les quotas à partir du volume réel de l’export, sans achat ni changement de facturation automatique.
2. Déployer et vérifier l’environnement CMS d’aperçu, créer l’administration native et sa passkey, configurer les secrets serveur puis tester la récupération d’accès. Procédure : [README du CMS](../apps/content-cms/README.md).
3. Préparer les sauvegardes, tester leur restauration, vérifier les six collections puis effectuer la simulation et l’import réel avec reprise. Procédure : [gestion des contenus](EMDASH-CONTENUS.md).
4. Configurer les connexions GitHub/Netlify, valider le parcours brouillon → publication CMS → aperçu → site public, puis activer explicitement la publication automatique et la bascule des builds du seul site `flex-webb`. Procédure : [publication EmDash](EMDASH-PUBLICATION.md).

Le CMS ne doit être annoncé comme opérationnel qu’après ces vérifications distantes. Une publication des améliorations commerciales sur le site public pourra être confirmée séparément, sans attendre ni prétendre avoir activé EmDash.
