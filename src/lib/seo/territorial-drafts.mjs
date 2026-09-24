import {readFileSync} from 'node:fs';
import path from 'node:path';
export const draftPreviewEnabled=()=>process.env.CONTEXT==='deploy-preview'&&process.env.FLEXWEB_DRAFT_PREVIEW==='1';
export const slugify=name=>name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/œ/g,'oe').replace(/æ/g,'ae').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
export const draftPath=(axis,commune)=>`/preparation/${axis}/${slugify(commune.name)}-${commune.code.toLowerCase()}/`;
export const draftHubPath=(axis,page=1)=>`/preparation/${axis}/${page>1?`page/${page}/`:''}`;
let cached;
export function draftData(){return cached??=JSON.parse(readFileSync(path.resolve('src/data/national/territorial-drafts.json'),'utf8'));}
export function draftEntries(){if(!draftPreviewEnabled())return [];return ['sites','automatisation'].flatMap(axis=>draftData().communes.map(commune=>({axis,commune,slug:`${slugify(commune.name)}-${commune.code.toLowerCase()}`})));}
export function draftGroups(){if(!draftPreviewEnabled())return [];const data=draftData(),size=100,total=Math.ceil(data.communes.length/size);return ['sites','automatisation'].flatMap(axis=>Array.from({length:total},(_,i)=>({axis,page:i+1,total,items:data.communes.slice(i*size,(i+1)*size)})));}
export function draftContent(axis,c){
 const area=`${c.name} (${c.department}), en ${c.region}`;
 return axis==='sites'?{
 title:`Site internet à ${c.name} : préparer votre projet`,
 introduction:`Pour préparer un site destiné à une entreprise intervenant à ${area}, commencez par préciser ses prestations et son périmètre réel. Cette trame propose un parcours de travail à personnaliser ; elle ne décrit pas une réalisation locale de Flex-Web.`,
 sections:[
 ['Définir la clientèle et le périmètre','Listez les services proposés, les demandes que vous souhaitez recevoir et les informations nécessaires pour y répondre. Une activité qui reçoit sur place ne présente pas son accès de la même façon qu’une entreprise qui se déplace. La zone administrative ci-dessous sert à identifier le territoire ; elle ne prouve ni une implantation ni un volume de clients potentiels.'],
 ['Préparer les pages et les preuves',`Une page de présentation, les prestations et un contact clair peuvent constituer un premier périmètre. Pour une recherche à ${c.name}, indiquez seulement les lieux réellement desservis. Les photos, références et avis demandent une autorisation et une vérification. Les contenus propres à votre métier restent à fournir avant de considérer cette page comme une réponse locale complète.`],
 ['Relier le site au suivi des demandes','Le formulaire recueille un besoin, puis le CRM peut préparer une tâche de rappel ou demander une précision. Le site ne doit pas confirmer un prix, une disponibilité ou une intervention avant vérification. Les connecteurs et automatisations sont définis au devis ; l’IA n’est pas nécessaire lorsque quelques règles fiables suffisent.'],
 ['Vérifier avant la mise en ligne','Testez le site sur téléphone, l’envoi d’une demande et le message affiché en cas d’erreur. Préservez les URL utiles si un site existe déjà. Le référencement et la recherche IA dépendent de contenus utiles, d’informations cohérentes et de l’accès des moteurs ; aucun nombre de pages ne garantit une position ou du trafic.']
 ],
 checklist:['Prestations et zone réellement desservie','Photos et références publiables','Contact chargé de répondre aux demandes','Contenus métier distinctifs à ajouter'],
 related:'/ressources/sites/site-internet-industrie/',
 }:{
 title:`Automatisation IA à ${c.name} : cadrer les tâches`,
 introduction:`Pour une entreprise située à ${area}, l’automatisation commence par l’observation du travail quotidien : quelles données arrivent, qui les traite et quelle décision suit ? Ce document est une trame à enrichir, pas une étude du tissu économique local.`,
 sections:[
 ['Choisir une tâche répétitive précise','Décrivez le déclencheur, les informations disponibles, le résultat attendu et la personne responsable. Une demande de devis reçue par formulaire peut créer un dossier et une tâche. Une réservation exige un agenda fiable. Une relance de facture suppose un solde vérifié. Ces scénarios ne sont pas interchangeables et doivent être testés séparément.'],
 ['Décider où l’IA apporte une aide','Une règle classique peut router une demande selon un champ connu ou une échéance. Une IA peut préparer une synthèse, classer un texte libre ou proposer un brouillon. Le message reçu reste une donnée à examiner, pas une autorisation d’envoyer ou de supprimer des informations. Les cas incertains doivent être transmis à une personne.'],
 ['Préparer les outils et le contexte',`Le territoire ${c.department} permet de situer la demande, mais ne détermine pas les outils utilisés par les entreprises de ${c.name}. Il faut inventorier le CRM, la messagerie, les agendas et leurs possibilités de connexion. Les horaires, droits d’accès et éventuels coûts de consommation sont fixés pour le projet réel, sans supposition tirée de la commune.`],
 ['Mesurer et contrôler le fonctionnement','Conservez les erreurs, les validations et l’état réel des transmissions. Une réponse suspend une relance prévue ; une opposition doit être respectée. Testez les doublons, les pannes et les informations manquantes avant d’augmenter l’autonomie. Mesurez ensuite les corrections et le temps réellement consacré ; aucun gain chiffré ne peut être promis ici.']
 ],
 checklist:['Tâche et fréquence observées','Logiciels et accès autorisés','Décisions à valider par une personne','Exemples anonymisés pour la recette'],
 related:'/ressources/automatisation/qualification-emails/',
 };
}
