import {readFileSync} from 'node:fs';
import path from 'node:path';
let cache;
export function enrichmentData(){return cache??=JSON.parse(readFileSync(path.resolve('src/data/national/territorial-enrichment.json'),'utf8'));}
let lookup;
export function enrichedTerritory(code){lookup??=new Map(enrichmentData().communes.map(c=>[c.code,c]));return lookup.get(code);}
export function localInsights(axis,c,e){
 const shared=e.postalGroups.filter(p=>p.totalCommunes>1),near=e.nearby[0],h=e.homonyms;
 const postal=shared.length?shared.map(p=>`${p.postalCode} (${p.totalCommunes} communes dans la source)`).join(', '):c.postalCodes.join(', ');
 const local=[{
  title:axis==='sites'?'Un formulaire adapté aux adresses de '+c.name:'Identifier correctement le dossier à '+c.name,
  fact:shared.length?`Le code postal ne suffit pas ici : ${postal}. ${shared[0].others.length?`Par exemple, ${shared[0].others.map(n=>n.name+' ('+n.code+')').join(', ')} partage${shared[0].others.length>1?'nt':''} le code ${shared[0].postalCode}.`:''}`:`Dans cette extraction, ${c.name} est la seule commune associée à ${postal}. Cette observation doit être réévaluée si le référentiel évolue.`,
  action:axis==='sites'?`Demandez la commune avec le code postal et faites confirmer l'adresse avant tout engagement. Enregistrez ${c.code} comme identifiant de commune pour ${c.name}, indépendamment du texte saisi.`:`Conservez séparément le code postal, le nom affiché et le code commune ${c.code}. Une correspondance incertaine doit créer une tâche de vérification, sans affectation automatique à une équipe.`,
  check:`Cas de recette : envoyer une demande ${shared.length?'avec le seul code '+shared[0].postalCode:'sans adresse précise'}, puis la compléter avec ${c.name} et ${c.code}. Le dossier initial doit être mis à jour, pas dupliqué.`
 },{
  title:'Éviter les confusions de territoire',
  fact:h.length?`Après normalisation des accents et de la typographie, le nom ${c.name} correspond aussi à ${h.map(x=>x.name+' ('+x.departmentCode+', code '+x.code+')').join('; ')}. Une recherche sur le nom seul peut donc désigner un autre territoire.`:`Aucune autre commune portant le même nom normalisé que ${c.name} n'a été trouvée dans cette extraction. Les fautes, abréviations et lieux-dits restent des cas à traiter séparément.`,
  action:axis==='sites'?`Affichez ${c.name}, ${c.department} (${c.departmentCode}) dans le contact et le récapitulatif de demande. Ne créez pas de fausse adresse d'agence pour rendre cette page locale.`:`Dans le CRM, affichez ${c.departmentCode} et ${c.code} à côté du nom. Ne fusionnez jamais deux entreprises sur leur seule commune ou un nom ressemblant.`,
  check:`Cas de recette : saisir « ${c.name} » sans département. Vérifiez le résultat proposé et la possibilité de corriger la sélection avant validation.`
 },{
  title:axis==='sites'?'Décrire une zone réellement desservie':'Définir une affectation géographique contrôlable',
  fact:near?`Parmi les centres fournis par l'API, ${near.name} (${near.departmentCode}, code ${near.code}) est le plus proche de celui de ${c.name}, à environ ${near.distanceKm.toLocaleString('fr-FR')} km à vol d'oiseau. ${e.epci?`${c.name} est rattachée à ${e.epci.name} (${e.epci.code}).`:''}`:`Le rapprochement géographique est indisponible pour ${c.name}. ${e.epci?`L'intercommunalité fournie est ${e.epci.name} (${e.epci.code}).`:''}`,
  action:axis==='sites'?'Séparez les prestations à distance, les visites sur place et les interventions. Pour chacune, indiquez les communes réellement couvertes. Un voisinage géographique ou administratif ne vaut pas engagement de desserte.':'Définissez une liste explicite de communes autorisées pour chaque équipe, puis une file de vérification pour les autres. La distance entre centres et l’intercommunalité ne remplacent ni un trajet réel ni une disponibilité.',
  check:near?`Cas de recette : comparer une demande à ${c.name} (${c.code}) et une à ${near.name} (${near.code}). Les statuts ne doivent différer que si une règle de desserte a été expressément configurée.`:`Cas de recette : une commune sans coordonnées doit rester qualifiable manuellement et ne pas être rejetée silencieusement.`
 }];
 return local;
}
export function localQuestions(axis,c,e){return [
 {q:`Le code postal suffit-il pour une demande à ${c.name} ?`,a:e.postalGroups.some(p=>p.totalCommunes>1)?`Non : au moins un code postal de ${c.name} est partagé par plusieurs communes dans la source. Demandez aussi la commune et conservez son code INSEE ${c.code}.`:`La source n'indique pas de partage pour les codes postaux de ${c.name}. Il reste utile de demander la commune et l'adresse ; le code ${c.code} identifie la commune, pas le client.`},
 {q:axis==='sites'?`Faut-il une page pour chaque commune autour de ${c.name} ?`:`Peut-on envoyer automatiquement chaque demande de ${c.name} à la même équipe ?`,a:axis==='sites'?'Seulement si chaque page répond à un besoin distinct avec des informations propres et vérifiées. Une page de zone bien expliquée peut être plus utile que plusieurs copies. Les lieux proches ci-dessous servent à vérifier le périmètre, pas à multiplier les pages.':'Il faut d’abord confirmer la prestation, la zone réellement couverte et les disponibilités. Le lieu seul ne suffit pas. Les cas incomplets restent dans une file de qualification.'},
 {q:'Ces données indiquent-elles le potentiel commercial local ?',a:`Non. Les données de ${c.name} décrivent un territoire administratif. Elles ne mesurent ni les recherches Google, ni les entreprises intéressées, ni des ventes possibles.`}
 ];}
