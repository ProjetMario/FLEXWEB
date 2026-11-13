# Publication ciblée du correctif de découverte SEO

Les changements durables de contenu et de notification sont intégrés dans `main` par la PR #50 (`d6b1d6e600c5b3201ce0782a484f870e9c976d34`). Cette branche ponctuelle publie leurs fichiers sans réenvoyer les pages étrangères au correctif. Son workflow spécialisé ne doit pas remplacer le workflow normal de `main`.

La référence est le déploiement vérifié `6af7884cf8420561604ee736`, issu du correctif limité au formulaire du run GitHub 43512626929. La reconstruction part de l’artefact original `c2a9eaae945a93d5afa9dd070d8aa825b8270667`, puis récupère uniquement les sept fichiers de ce correctif depuis son URL Netlify immuable. L’empreinte complète doit correspondre exactement au reçu publié (`8d758bd8d9365a7286a7e62766365bea6ded669ff4b8e9d85b7cfef42e97fb05`).

Seuls `journal/index.html`, `creation-site-internet/index.html`, `sitemaps/principal-1.xml`, le marqueur de version et leurs éventuels nouveaux fichiers Astro sont autorisés. Aucune suppression, aucune modification d’un fichier partagé existant, aucune modification d’une autre entrée du sitemap ou de la configuration des fonctions n’est permise. Le transfert est bloqué au-delà de 30 fichiers changés.

Les contrôles rapprochent les 151 503 URL et leurs HTML de l’inventaire publié, valident tous les XML, puis testent les deux pages sur mobile et ordinateur. Un aperçu est vérifié avant publication du même artefact. La production et le commit source sont contrôlés avant l’envoi, et la publication reste verrouillée après validation. Le formulaire et sa notice de confidentialité sont vérifiés identiques à la version publiée.

IndexNow ne s’exécute qu’après émission d’un reçu de production effectivement vérifiée. La comparaison avec le déploiement précédent, les contrôles HTTP/canonique, la clé et le registre de réception sont conservés. Ce mécanisme n’annonce pas comme indexée une URL simplement reçue par IndexNow.

Validation locale du mécanisme : 26 tests de portée, verrouillage et notification ; un test de navigation/rendu mobile et ordinateur ; syntaxe YAML et branche autorisée vérifiées. Les résultats du build et de la publication seront archivés dans le run GitHub déclenché manuellement sur cette branche.
