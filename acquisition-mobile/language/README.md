# Lecture du site en français et en anglais

Les visiteurs de France, d’outre-mer, de Suisse et de Belgique commencent en français. Les autres pays commencent en anglais. La langue de secours est le français quand Netlify ne situe pas la connexion. Le bouton FR ou EN mémorise le choix explicite pendant six mois sur ce navigateur.

Le pays provient de `context.geo.country.code`. L’API `/api/langue/` répond uniquement par une langue et désactive le cache partagé. Les pages HTML, le sitemap, les canoniques et leurs statuts HTTP sont indépendants de cette décision. Les versions anglaises dédiées conservent leurs URL. Les versions suisse allemande et italienne restent accessibles directement.

Une fiche sans équivalent se lit dans l’autre langue à la même adresse. Le navigateur télécharge ses dictionnaires depuis Flex-Web. La préparation des textes utilise les modèles OPUS-MT français–anglais et anglais–français, exécutés localement par CTranslate2. Les révisions des modèles sont fixées dans `translate.py`. Les données géographiques, le téléphone et les montants sont réinsérés dans les modèles de phrases. Les libellés revus manuellement figurent dans `reviewed.json`.

Le formulaire de contact garde ses champs dans le même cadre pendant le changement de langue. Le cadre échange avec la page la langue, sa hauteur et un indicateur de saisie commencée. Le formulaire de devis conserve également ses contrôles en place. Les espaces clients et les sites autonomes servis sous `/sites/` suivent leur propre fonctionnement.

## Prochaines publications

Une construction complète régénère les ressources après le rendu définitif d’Astro et du CMS. La commande `node acquisition-mobile/language/refresh-build.mjs dist` relit les textes publics, réutilise les traductions existantes et traite les nouveaux textes. Les ressources produites se trouvent dans `dist/language-assets`.

Pour une mise à jour différentielle du catalogue, `release.mjs` utilise le manifeste de la production active et crée un aperçu avec les nouvelles ressources de lecture et le programme Edge. `preview.json` répertorie les empreintes pour vérifier le contenu livré. La version du formulaire attendue est identifiée dans `form-release.json`. `preview-form.mjs` limite l’intégration du formulaire d’essai à l’origine de l’aperçu.

Après validation du propriétaire, fusionner d’abord la modification du formulaire vers la branche `formulaire-contact`, puis la modification du catalogue vers `main`. L’action GitHub **Publier les ressources de lecture bilingue** exige l’identifiant de l’aperçu approuvé et vérifie le formulaire et les manifestes avant publication.

## Contrôles reproductibles

```sh
node --test acquisition-mobile/language/reading.test.mjs acquisition-mobile/redesign/contact/edge.test.mjs
node acquisition-mobile/language/inventory-check.mjs public
node acquisition-mobile/language/verify-preview.mjs
node acquisition-mobile/language/browser-check.mjs https://6b0742f252e052f360da902d--flex-webb.netlify.app
```

Le contrôle de l’inventaire porte sur les 151 507 URL du sitemap. Les tests navigateur simulent le choix associé aux pays et bloquent les envois de formulaires. Le contrôle HTTP interroge aussi la véritable décision de Netlify. Les vérifications du manifeste et des XML comparent l’aperçu à la production.
