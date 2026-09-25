// Browser-safe, pure helpers. No storage, requests or publishing side effects.
export const briefModes = [
 {value:'onsite',label:'Intervention ou rendez-vous sur place'},
 {value:'remote',label:'Travail à distance'},
 {value:'mixed',label:'Sur place et à distance'},
];
export const briefServices = {
 sites:[
  {value:'presentation',label:'Présenter mes prestations',scenario:'Décrire la prestation, ses limites et la zone réellement desservie avant de proposer un contact.'},
  {value:'quotation',label:'Recevoir des demandes de devis',scenario:'Recueillir le besoin et le lieu confirmé, puis préparer une tâche de qualification humaine.'},
  {value:'catalogue',label:'Présenter un catalogue professionnel',scenario:'Rattacher la demande aux références choisies ; faire vérifier le prix et la disponibilité avant de répondre.'},
  {value:'visibility',label:'Améliorer la visibilité de mon site',scenario:'Vérifier les contenus, les preuves et les accès des moteurs ; mesurer les demandes qualifiées sans promettre de position.'},
 ],
 automatisation:[
  {value:'case',label:'Créer et suivre les dossiers clients',scenario:'Rapprocher un formulaire ou un message du bon contact, retrouver les doublons et préparer la prochaine action.'},
  {value:'dispatch',label:'Affecter les demandes ou interventions',scenario:'Vérifier séparément la commune, la desserte et la disponibilité avant de proposer une affectation à une personne.'},
  {value:'documents',label:'Suivre les pièces manquantes',scenario:'Comparer les pièces reçues à la liste attendue, puis préparer un rappel à valider sans le transmettre.'},
  {value:'ai-summary',label:'Préparer une synthèse avec l’IA',scenario:'Produire un brouillon depuis les données autorisées, signaler les incertitudes et faire relire avant toute utilisation.'},
 ],
};
const limits={coveredCommunes:800,ownerRole:120,nextAction:600,observations:1800};
const labels={service:'Prestation',mode:'Mode de travail',coveredCommunes:'Communes effectivement couvertes',ownerRole:'Rôle responsable',nextAction:'Prochaine action'};

export function normalizeBriefText(value,{multiline=false}={}) {
 if(typeof value!=='string')return '';
 const clean=value.normalize('NFC').replace(/\r\n?/g,'\n').replace(/[\u2028\u2029]/g,'\n')
  .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g,'');
 return multiline?clean.split('\n').map(line=>line.replace(/[\t ]+/g,' ').trim()).join('\n').replace(/\n{3,}/g,'\n\n').trim():clean.replace(/\s+/g,' ').trim();
}
const slugify=name=>name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/œ/g,'oe').replace(/æ/g,'ae').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
export function briefIdentity(axis,commune) {
 if(!Object.hasOwn(briefServices,axis)||!commune||typeof commune.code!=='string'||!/^(?:\d{5}|2[AB]\d{3})$/.test(commune.code))throw Error('Identité territoriale invalide');
 const name=normalizeBriefText(commune.name);
 if(!name||name.length>150)throw Error('Nom de commune invalide');
 return {axis,communeCode:commune.code,communeName:name,sourcePath:`/territoires/${axis}/${slugify(name)}-${commune.code.toLowerCase()}/`};
}
export function createTerritorialBrief(axis,commune,input={}) {
 const identity=briefIdentity(axis,commune),raw=input&&typeof input==='object'?input:{},fields={};
 const service=briefServices[axis].find(item=>item.value===raw.service),mode=briefModes.find(item=>item.value===raw.mode);
 fields.service=service?.value||'';fields.mode=mode?.value||'';
 const errors=[];
 for(const [key,max] of Object.entries(limits)) {
  fields[key]=normalizeBriefText(raw[key],{multiline:key==='observations'});
  if(fields[key].length>max)errors.push(`${key}: ${max} caractères maximum`);
 }
 const missing=Object.keys(labels).filter(key=>!fields[key]).map(key=>({field:key,label:labels[key]}));
 if(raw.service&&!service)errors.push('service: choix inconnu');
 if(raw.mode&&!mode)errors.push('mode: choix inconnu');
 return {version:1,...identity,fields,serviceLabel:service?.label||'Non renseignée',modeLabel:mode?.label||'Non renseigné',scenario:service?.scenario||'Aucun scénario choisi. Préciser la prestation avant de préparer une méthode.',missing,errors,status:missing.length||errors.length?'incomplete':'ready-for-review'};
}
export function territorialBriefText(brief) {
 // Recompute from controlled identity and fields; never trust a supplied status/URL/scenario.
 const b=createTerritorialBrief(brief.axis,{code:brief.communeCode,name:brief.communeName},brief.fields);
 if(b.errors.length)throw Error('Brief invalide : '+b.errors.join('; '));
 const quote=value=>(value||'Non renseigné').split('\n').map(line=>`  > ${line}`).join('\n');
 return [
  'FLEX-WEB — BROUILLON DE PROJET TERRITORIAL',
  `Commune de la fiche : ${b.communeName}`,
  `Code commune (texte) : ${b.communeCode}`,
  `Fiche source : ${b.sourcePath}`,
  `Thème : ${b.axis==='sites'?'Site internet et visibilité':'Automatisation et IA'}`,
  `État : ${b.status==='incomplete'?'incomplet':'renseigné, à relire avec le responsable'}`,
  b.missing.length?`Champs à compléter : ${b.missing.map(item=>item.label).join(', ')}`:'Les champs sont remplis ; leur exactitude et leur faisabilité restent à vérifier.',
  '',
  'SAISIES DE L’UTILISATEUR — les lignes précédées de > sont des notes libres',
  'Prestation :',quote(b.serviceLabel),
  'Mode de travail :',quote(b.modeLabel),
  'Communes effectivement couvertes (déclaration à vérifier) :',quote(b.fields.coveredCommunes),
  'Rôle chargé du suivi :',quote(b.fields.ownerRole),
  'Prochaine action proposée :',quote(b.fields.nextAction),
  'Observations :',quote(b.fields.observations),
  '',
  'SCÉNARIO PROPOSÉ — À ADAPTER ET À VALIDER',b.scenario,
  'Ce scénario n’a été ni exécuté ni activé. La commune de la fiche ne prouve pas une implantation, une desserte ou une disponibilité.',
  'Vérifier le périmètre réel, les accès aux outils et le responsable avant toute réalisation.',
  'Document préparé localement. Aucun dossier CRM créé, aucun message envoyé.',
  '',
 ].join('\n');
}
export function territorialBriefFilename(brief) {
 const identity=briefIdentity(brief.axis,{code:brief.communeCode,name:brief.communeName});
 return `brief-${identity.axis}-${identity.communeCode.toLowerCase()}.txt`;
}
