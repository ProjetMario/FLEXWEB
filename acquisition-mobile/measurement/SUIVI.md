# Suivi des devis mobiles et des citations IA

## Objectif commercial

Viser **60 nouveaux projets mobiles qualifiés sur 30 jours calendaires**, soit deux par jour en moyenne. Comparer deux fenêtres successives de 30 jours complets, avec la même définition. Conserver les dates de la publication réelle et de la dernière donnée disponible.

Un projet est reçu quand Flex-Web reçoit le formulaire, le message ou l’appel. Une même personne peut porter deux projets distincts. Une relance par e-mail après le formulaire reste le même projet. Le responsable commercial marque « qualifié » quand le demandeur est joignable, décrit un besoin mobile concret et souhaite discuter d’un devis. Garder les contacts à préciser en attente, puis dater le changement de statut.

### Export volontaire et privé

Exécuter localement le script Python 3, depuis la racine du dépôt. Conserver l’export et les résultats en dehors du dépôt, de Netlify et du répertoire public. Remplacer les identifiants par des codes de projet opaques stables. Les catégories ci-dessous suffisent au calcul. Le script fonctionne hors ligne, sans formulaire supplémentaire.

```sh
python3 acquisition-mobile/measurement/measure.py devis \
  --fin 2026-11-22 --csv ~/Documents/prive/projets-mobiles.csv
```

Le CSV UTF-8 utilise cet en-tête dans cet ordre.

```csv
project_key,first_received,updated,channel,service,status,source,country
```

| Champ | Valeurs et règle de saisie |
|---|---|
| project_key | Identifiant aléatoire de 4 à 64 caractères. Utiliser le même entre formulaire, téléphone, e-mail et CRM pour un même projet. |
| first_received, updated | Dates AAAA-MM-JJ en heure de Paris. Garder la première réception réelle, même antérieure à la fenêtre. Exporter les états datés disponibles jusqu’à la fin de chaque période. |
| channel | Premier canal de réception du projet parmi form, email, phone, other. Un clic sur le bouton de contact reste dans l’analytique. |
| service | mobile, other ou unknown. Qualifier le besoin au fil des échanges. |
| status | qualified, pending, unqualified, spam, test. Conserver un état consolidé par projet et par jour. |
| source | Source déclarée par le demandeur parmi chatgpt, gemini, claude, copilot, perplexity, grok, google, bing, referral, partner, direct, other, unknown. Si le client ne sait plus, conserver unknown. |
| country | Code ISO de deux lettres, par exemple FR, CH, BE ou CA. ZZ indique un pays inconnu. |

Le script examine le dernier état du projet disponible à la date de fin. Il attribue chaque projet à sa première réception. Il exclut tests et indésirables. Les totaux par source, pays et canal concernent les projets qualifiés. Un export incomplet ou dépourvu d’historique ne permet pas de reconstituer fidèlement une période antérieure. Pour distinguer une donnée manquante d’un vrai zéro, exécuter le calcul uniquement sur un export complet des canaux acceptés. Conserver séparément les visites attribuées avec consentement et les clics sur téléphone et e-mail.

## Panel francophone

Le générateur prépare **24 questions neutres** regroupant huit intentions dans trois zones. Chaque question est reprise mot pour mot sur ChatGPT, Gemini, Claude, Microsoft Copilot et Perplexity. Les intentions couvrent la sélection d’une agence, le budget, le projet individuel, la saisie terrain, les stores, la maintenance, le MVP et les réalisations vérifiables.

```sh
python3 acquisition-mobile/measurement/measure.py panel --date 2026-11-23 \
  > ~/Documents/prive/panel-mobile-2026-11-23.csv
```

1. Faire un relevé de départ et répéter mensuellement après publication. Pour chaque question, ouvrir une nouvelle conversation, en français, avec la recherche web activée quand elle est proposée. Désactiver la personnalisation si possible. Conserver le même protocole d’un mois à l’autre.
2. Noter le modèle affiché, le jour, la localisation réelle du test et le mode de recherche. Le pays demandé fait partie de la question. Une recherche effectuée depuis la France sur la Suisse reste une recherche depuis la France.
3. Pour une réponse obtenue, inscrire « observe », noter 1 ou 0 pour la mention explicite de Flex-Web et 1 ou 0 pour un lien vers flex-web.fr. Noter l’URL exacte et conserver une capture ou une transcription privée datée. Un lien vers FootNation seul ne compte pas comme citation de flex-web.fr. Identifier précisément l’agence en cas d’homonyme.
4. Si un assistant est inaccessible, noter « indisponible » et laisser les résultats vides. Garder « a_tester » tant que la question n’a pas été posée. Le dénominateur est le nombre de réponses observées. Publier la couverture séparément, par exemple 100 réponses observées sur 120 prévues.
5. Par pays et assistant, diviser les mentions et les citations par les réponses observées. Comparer entre mois, à configuration comparable, et vérifier les URL que les assistants citent. Ce panel échantillonne les réponses à ces questions précises.

## Références disponibles au démarrage

Le contrôle privé de Flex-Web du 13 novembre 2026 a relevé les valeurs suivantes pour **tout le domaine**. Ces rapports constituent des points de référence historiques. La mesure propre aux pages mobiles et celle des demandes qualifiées nécessitent des exports correspondant à la période de publication.

| Mesure | Dernière observation vérifiée dans le rapport historique |
|---|---|
| Pages indexées Google | 64 056 au 9 novembre |
| Pages indexées Bing | 294 à la consultation du 13 novembre |
| Impressions dans les fonctionnalités IA de Google Search | 14 du 14 octobre au 10 novembre |
| Citations Bing AI Performance, Microsoft Copilots and Partners | 12 du 14 octobre au 12 novembre, graphique disponible jusqu’au 10 novembre |
| Devis mobiles qualifiés sur 30 jours | Export commercial privé nécessaire |
| Citations du panel de 120 réponses | Relevé initial à réaliser |

Pour la recherche, filtrer les pages mobiles réellement publiées dans [Google Search Console](https://search.google.com/search-console/performance/search-analytics?resource_id=sc-domain%3Aflex-web.fr) et [Bing Webmaster Tools](https://www.bing.com/webmasters/searchperf?siteUrl=https%3A%2F%2Fflex-web.fr%2F). Conserver les exports datés avec impressions, clics, pages et pays. Comparer une fenêtre de 30 jours achevée avant publication à une fenêtre de 30 jours après publication lorsque les deux rapports couvrent toutes les dates. Les demandes et leur source déclarée viennent du CRM.

À J+7, examiner les pages que les moteurs ont pu lire et les liens vers le devis. À J+30, comparer le volume de projets en attente et qualifiés, leurs pays et les canaux de découverte. Si une offre obtient des impressions mais peu de clics, rapprocher son titre des requêtes réellement affichées. Si les prospects cliquent pour demander un devis sans le transmettre, vérifier le parcours sur mobile avec un test isolé. Si des assistants citent une ancienne prestation, mettre à jour en priorité la page qu’ils citent.

## Pistes de diffusion éditoriale

| Zone | Interlocuteur public | Proposition adaptée |
|---|---|---|
| France | [CCI Savoie](https://www.savoie.cci.fr/) | Proposer à l’équipe transformation numérique une fiche pour les PME sur le cadrage d’un outil métier mobile. |
| Suisse romande | [Chambre vaudoise du commerce et de l’industrie](https://cvci.ch/) | Demander à l’équipe événements si un retour d’expérience sur la première application d’un entrepreneur répond aux questions de ses membres. |
| Belgique francophone | [hub.brussels](https://hub.brussels/fr/services/information-entreprendre/) | Demander quel réseau bruxellois accompagne les porteurs de projets qui doivent arbitrer entre prototype, application et site mobile. |

**Brouillon à personnaliser par destinataire**

Objet proposé — Aider vos entrepreneurs à cadrer une première application mobile

Bonjour,

Je travaille chez Flex-Web, en Savoie. Lorsqu’une entreprise envisage sa première application mobile, elle doit choisir les fonctions à mettre en devis et anticiper les frais de maintenance. Nous pouvons illustrer ces choix avec FootNation, dont la fiche iOS permet de voir le produit.

Est-ce un sujet que vos entrepreneurs vous soumettent ? Si oui, je peux vous envoyer une trame d’atelier ou une fiche pratique pour que votre équipe en apprécie l’intérêt.

Bien cordialement,

L’équipe Flex-Web

Ces pistes sont des propositions à examiner avant tout contact. Aucune démarche de diffusion n’a été engagée.

## Bilans à partir de la mise en production

| Échéance | Décision commerciale |
|---|---|
| J+30 | Comparer les 30 jours écoulés aux 30 jours complets précédant la mise en ligne. Relever les projets reçus, qualifiés et en attente, les clics vers le devis, les pages d’entrée et les citations avec lien. Identifier le premier point de perte. |
| J+60 | Comparer les deux fenêtres de 30 jours. Identifier les pays et les questions qui amènent des projets qualifiés. Renforcer une page citée mais imprécise ou un parcours consulté dont le formulaire est peu utilisé. |
| J+90 | Comparer trois périodes complètes de 30 jours à définition constante. Utiliser les taux de qualification et les motifs donnés par les prospects pour décider quelles offres et quels partenariats développer. |

Les dates partent de la publication sur flex-web.fr. Pour chaque bilan, noter le dernier jour complet disponible dans chaque outil. Si une source manque, laisser la valeur indisponible.
