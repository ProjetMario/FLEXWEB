# Nova Habitat — source de la refonte

Branche dédiée `nova-habitat` dans `ProjetMario/FLEXWEB`. La branche `main` du site d'agence n'est pas modifiée.

Site cible uniquement : https://nova-habitat-demo-flexweb.netlify.app/

## Fichiers éditables

`site/index.html` : les trois activités, avec le curage comme spécialité principale. `site/nova-v2.css` : présentation responsive et palette terracotta. `site/nova-v2.js` : menu, sélection du besoin et formulaire. `site/nova-forms.html` : définition statique Netlify Forms. `site/merci-nova.html` : confirmation sans JavaScript.

Le logo original est réutilisé, jamais modifié. Les illustrations IA sont explicitement présentées comme des simulations, jamais comme des chantiers réels. Le drone reste désactivé (`droneEnabled: false`). Les mentions d'indexation et la présentation de maquette sont conservées tant que le lancement commercial n'est pas validé.

## Publication non destructive

Ce dépôt contient le nouveau site vitrine, pas le code privé des six fonctions déjà déployées. **Ne pas glisser uniquement le dossier `site` dans Netlify et ne pas configurer un déploiement statique classique à partir de cette branche** : cela supprimerait les fonctions ou l'administration.

Le script `scripts/deploy.mjs` construit un nouveau déploiement Netlify à partir du manifeste complet du site existant. Il ne remplace que les cinq fichiers de la refonte et ses trois images. Il réutilise les empreintes des autres fichiers, du logo, de `netlify.toml`, de l'administration et des six fonctions. Il contrôle un aperçu avant toute publication en production et refuse de publier si le site a changé pendant l'opération. Il ne modifie aucun domaine, secret, dépôt lié ni réglage d'authentification.

Installer avec `npm install`. L'authentification se fait avec un ticket d'autorisation officiel Netlify (`--ticket <identifiant>`) ou une variable `NETLIFY_AUTH_TOKEN` fournie dans l'environnement. Aucun jeton n'est écrit dans le dépôt ni affiché par le script.

`npm run preview -- --ticket <identifiant>` crée seulement un aperçu vérifié. `npm run deploy -- --ticket <identifiant>` publie la version après les vérifications automatiques. L'accès peut aussi être transmis via la variable d'environnement plutôt qu'un ticket.

Le statut GitHub du code ne constitue pas à lui seul une preuve de publication. Seul le résultat `published: true` du script, suivi du contrôle de l'adresse publique, confirme une mise en ligne.

Les notifications de soumission doivent être vérifiées séparément dans Netlify. Ne pas prétendre qu'un e-mail a été reçu sans test réel. Compléter les mentions légales avec les coordonnées légales réelles de l'entreprise avant le lancement commercial.
