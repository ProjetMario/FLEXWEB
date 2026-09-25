// Factual adaptations of shared methods, never evidence of a local market or office.
import {createHash} from 'node:crypto';
import {draftPath} from './territorial-drafts.mjs';
export function territoryAssessment(c,e){
 return {
  sharedPostal:e.postalGroups.some(p=>p.totalCommunes>1),
  multiplePostal:c.postalCodes.length>1,
  homonym:e.homonyms.length>0,
  crossDepartment:e.nearby.some(n=>n.departmentCode!==c.departmentCode),
  missingEpci:!e.epci,
  missingCoordinates:!e.coordinates,
  missingPostal:!c.postalCodes.length,
 };
}
export function dossierDecision(input){
 if(input.duplicateEvent)return 'reuse-existing-request';
 if(!input.communeConfirmed)return 'confirm-commune';
 if(!['remote','onsite'].includes(input.mode))return 'confirm-service-mode';
 if(input.mode==='remote')return 'qualify-remote-project';
 if(input.scope==='outside')return 'review-outside-scope';
 if(input.scope!=='covered')return 'confirm-service-area';
 if(!input.available)return 'confirm-availability';
 return 'prepare-appointment-for-approval';
}
export const decisionLabels={
 'reuse-existing-request':'Retrouver la demande existante, sans créer de doublon.',
 'confirm-commune':'Faire confirmer la commune ; aucune affectation automatique.',
 'confirm-service-mode':'Faire préciser le mode de prestation avant de vérifier la desserte ou un créneau.',
 'qualify-remote-project':'Qualifier le projet à distance, ses outils et son responsable.',
 'review-outside-scope':'Préparer une réponse hors périmètre à valider humainement.',
 'confirm-service-area':'Vérifier la zone de service déclarée par l’entreprise.',
 'confirm-availability':'Vérifier la disponibilité avant de proposer un créneau.',
 'prepare-appointment-for-approval':'Préparer un rendez-vous soumis à validation ; ne rien envoyer.',
};
export function territorialDossier(axis,c,e){
 if(!['sites','automatisation'].includes(axis)||!e||e.code!==c.code)throw Error('Territory identity mismatch');
 const a=territoryAssessment(c,e),near=e.nearby[0],shared=e.postalGroups.find(p=>p.totalCommunes>1),homonym=e.homonyms[0],cross=e.nearby.find(n=>n.departmentCode!==c.departmentCode);
 const steps=axis==='sites'?[
 {title:'Présenter le service avant la zone',text:`Pour une entreprise qui sert ${c.name}, la première décision du visiteur est de reconnaître la prestation proposée. Préparez une description du résultat attendu, des exclusions et du mode de travail : à distance, sur rendez-vous dans un établissement réel ou en déplacement. Le nom de la commune sert ensuite à vérifier la faisabilité géographique. Une adresse administrative de commune ne doit jamais remplacer celle de l’entreprise.`,deliverable:'Un bloc prestation et un contact réel, avec une formulation différente pour chaque mode de service.'},
 {title:'Construire un formulaire qui sait demander une précision',text:a.missingPostal?`Aucun code postal n’est renseigné pour ${c.name} dans cet instantané. Conservez la demande et demandez une confirmation de l’adresse et de la commune. Ne proposez pas un code voisin par défaut et ne bloquez pas le suivi commercial parce que ce champ est absent de la source.`:a.sharedPostal?`La saisie de ${shared.postalCode} laisse ${shared.totalCommunes} communes possibles dans le référentiel. Affichez la commune retenue avec son département et demandez sa confirmation. Si le visiteur ne sait pas choisir, conservez son message et proposez une qualification humaine. Ne remplacez pas silencieusement sa saisie par ${c.name}.`:`Même si aucun code postal partagé n’est relevé pour ${c.name} dans cet instantané, une adresse incomplète reste une demande exploitable. Présentez ${c.name} (${c.departmentCode}) pour confirmation et permettez de corriger le lieu. Une valeur absente doit rester absente : ne déduisez pas l’adresse du navigateur ou du nom de l’entreprise.`,deliverable:'Un récapitulatif corrigeable affichant la prestation, le lieu confirmé et les données encore manquantes.'},
 {title:'Transmettre la demande avec une référence stable',text:`Le formulaire remet au suivi commercial le code commune ${c.code}, le nom affiché et une référence de demande distincte. La référence sert à retrouver le même envoi lors d’une nouvelle tentative réseau ; elle ne doit pas fusionner deux demandes différentes faites au même endroit. Le message de confirmation annonce une réception uniquement après l’enregistrement réussi.`,deliverable:'Une demande retrouvable et une prochaine action nommée, sans devis ni réservation créés implicitement.'},
 {title:'Publier des preuves qui correspondent au périmètre',text:`Réunissez des réalisations autorisées et indiquez ce qu’elles démontrent : service fourni, périmètre et limites. Une réalisation extérieure à ${c.name} peut expliquer une méthode, mais doit conserver sa localisation réelle. Si aucune preuve locale n’existe, dites que l’accompagnement est proposé à distance et expliquez la procédure de qualification au lieu d’inventer une référence.`,deliverable:'Des exemples sourcés, un responsable de réponse et une mesure des demandes effectivement qualifiées.'},
 ]:[
 {title:'Séparer le signal entrant de la décision commerciale',text:`Une demande rattachée à ${c.name} (${c.code}) commence par un événement : formulaire, e-mail ou saisie interne. Conservez sa référence d’origine, sa date et le canal avant de choisir le client ou le projet à mettre à jour. Deux messages reçus de la même commune ne prouvent pas qu’ils concernent la même entreprise. Une synthèse IA reste une aide à la lecture, pas une instruction d’envoi.`,deliverable:'Un événement traçable, un dossier associé et une file pour les rapprochements incertains.'},
 {title:'Qualifier le lieu avec un identifiant administratif',text:a.homonym?`Le référentiel contient aussi ${homonym.name} (${homonym.departmentCode}, ${homonym.code}). Une détection du seul nom « ${c.name} » dans un e-mail ne permet donc pas de décider du lieu. Conservez la proposition et sa source, puis demandez le département ou l’adresse. Le code ${c.code} doit provenir d’une sélection confirmée, pas d’une préférence arbitraire pour cette fiche.`:`Pour ${c.name}, conservez ${c.code} séparément du libellé libre. Même sans homonyme détecté, une faute de frappe, un lieu-dit ou une adresse de facturation peut différer du lieu d’intervention. Faites confirmer le site concerné avant de déplacer le dossier vers une équipe.`,deliverable:'Des champs distincts pour le lieu d’intervention, le contact et l’adresse de facturation si elle est nécessaire.'},
 {title:'Appliquer une règle de desserte explicite',text:cross?`Le centre de ${cross.name} (${cross.departmentCode}) figure parmi les trois plus proches de ${c.name}, tout en appartenant à un autre département. Une règle fondée uniquement sur ${c.departmentCode} peut donc différer d’une zone de service choisie commune par commune. Décidez du périmètre réel avec le responsable, puis testez les deux dossiers séparément ; la proximité ne vaut pas disponibilité.`:`Enregistrez les communes réellement acceptées pour chaque prestation au lieu d’utiliser un rayon arbitraire autour de ${c.name}. Une prestation à distance suit son propre parcours. Pour une intervention, la couverture géographique et le créneau disponible sont deux contrôles séparés, et les lieux non configurés restent à qualifier.`,deliverable:'Une table de desserte versionnée par prestation, avec une branche hors périmètre et une validation de disponibilité.'},
 {title:'Rendre les erreurs visibles et reprendre sans réexpédier',text:'À chaque transmission, distinguez la préparation locale, l’acceptation par le fournisseur et la confirmation reçue. Après un délai d’attente, recherchez la référence avant toute nouvelle tentative. Une erreur ne doit ni faire disparaître la demande ni transformer un message incertain en message livré. Testez ce fonctionnement avec une panne volontaire et conservez la décision de reprise.',deliverable:'Un journal des transitions, une action de reprise contrôlée et aucune double notification sur le même événement.'},
 ];
 const fields=[
 {name:'Référence de demande',example:`TEST-${axis}-${c.code}-001`,rule:'Exemple de recette fictif. En production, identifiant unique de l’événement ; ne pas utiliser la commune seule.'},
 {name:'Commune confirmée',example:`${c.name} · ${c.departmentCode} · ${c.code}`,rule:'Stocker le code comme une chaîne pour conserver les zéros et les codes corses.'},
 {name:'Code postal',example:c.postalCodes.join(' / ')||'Non renseigné dans la source',rule:a.multiplePostal?'Plusieurs codes fournis : demander celui de l’adresse concernée.':a.sharedPostal?'Le code est partagé : il ne choisit pas la commune à lui seul.':'Vérifier avec la commune et l’adresse ; ne pas identifier le client par ce champ.'},
 {name:'Prestation et mode',example:'À distance / déplacement / rendez-vous sur place',rule:'Choix à renseigner par l’entreprise ; aucune déduction depuis les données géographiques.'},
 {name:'Périmètre et disponibilité',example:'À confirmer',rule:'Deux valeurs distinctes, sans état « accepté » par défaut.'},
 {name:'Responsable et prochaine action',example:'À nommer par l’entreprise',rule:'Attribuer un suivi humain aux cas incomplets, sans inventer de disponibilité.'},
 ];
 const cases=[];
 function add(id,label,communeCode,input,expected,why){cases.push({id:`${axis}:${c.code}:${id}`,label,communeCode,input,expected,expectedLabel:decisionLabels[expected],why});}
 add('unknown','Lieu non confirmé',c.code,{communeConfirmed:false,mode:'onsite'},'confirm-commune',`Le nom ${c.name} saisi en texte libre ne constitue pas une sélection confirmée.`);
 add('mode','Mode de prestation non précisé',c.code,{communeConfirmed:true,scope:'covered',available:true},'confirm-service-mode','Une zone couverte et un créneau disponible ne permettent pas de choisir entre déplacement et prestation à distance.');
 add('scope','Commune confirmée, desserte inconnue',c.code,{communeConfirmed:true,mode:'onsite',scope:'unknown'},'confirm-service-area','L’identification du lieu ne prouve pas sa couverture par le prestataire.');
 add('availability','Zone couverte, aucun créneau vérifié',c.code,{communeConfirmed:true,mode:'onsite',scope:'covered',available:false},'confirm-availability','Une règle géographique ne crée pas de disponibilité.');
 add('approved','Préparation après contrôles',c.code,{communeConfirmed:true,mode:'onsite',scope:'covered',available:true},'prepare-appointment-for-approval','Le résultat prépare une proposition, sans message envoyé automatiquement.');
 add('remote','Projet réalisé à distance',c.code,{communeConfirmed:true,mode:'remote',scope:'outside'},'qualify-remote-project','Une exclusion pour les déplacements ne rejette pas un projet à distance.');
 add('duplicate','Nouvelle tentative du même événement',c.code,{duplicateEvent:true,communeConfirmed:true,mode:'onsite'},'reuse-existing-request','Retrouver la référence exacte ; ne pas dédupliquer sur le seul contact ou la commune.');
 if(shared)add('postal',`Code ${shared.postalCode} seul`,c.code,{communeConfirmed:false,mode:'onsite'},'confirm-commune',`${shared.totalCommunes} communes partagent ce code dans l’extraction officielle.`);
 if(homonym)add('homonym',`Nom partagé avec ${homonym.name} (${homonym.departmentCode})`,homonym.code,{communeConfirmed:false,mode:'onsite'},'confirm-commune',`Distinguer ${c.code} et ${homonym.code} avant tout routage.`);
 if(near)add('neighbour',`Demande voisine : ${near.name}`,near.code,{communeConfirmed:true,mode:'onsite',scope:'outside'},'review-outside-scope',`Scénario fictif où ${near.name} est déclarée hors périmètre : sa proximité ne doit pas annuler cette règle.`);
 const needs=axis==='sites'?[
 ['devis-nettoyage-multisites','Nettoyage multisites : distinguer les bâtiments et les fréquences'],
 ['menuiserie-projet-sur-mesure','Menuiserie : qualifier les mesures et la visite'],
 ['paysagiste-demande-amenagement','Paysagiste : préparer le contexte du terrain'],
 ['catalogue-professionnel-sans-vente','Catalogue professionnel : renseigner une demande de prix'],
 ]:[
 ['creation-dossier-formulaire','Créer le dossier sans recopier ni dupliquer'],
 ['collecte-pieces-manquantes','Suivre les pièces réellement attendues'],
 ['affectation-interventions','Affecter avec une zone et une disponibilité confirmées'],
 ['synchronisation-contacts','Synchroniser les contacts avec des identifiants stables'],
 ];
 const checks=[
 `Confirmer le lieu réel de l’entreprise ; ${c.name} est ici un territoire d’étude, pas une agence Flex-Web.`,
 `Valider la liste de desserte séparément des ${e.nearby.length} communes proches données comme repères.`,
 a.missingEpci?'L’intercommunalité manque dans la source : laisser ce champ vide, sans reconstitution.':`Le rattachement à ${e.epci.name} ne vaut ni partenariat ni périmètre commercial.`,
 'Fournir au moins un besoin propre et des preuves autorisées avant une validation éditoriale locale.',
 'Décider si cette fiche apporte une réponse distincte ou doit être regroupée dans une page de zone.',
 ];
 const dossier={id:`territory:${axis}:${c.code}`,version:2,status:'prepared-not-editorially-approved',axis,communeCode:c.code,url:draftPath(axis,c),assessment:a,steps,fields,cases,needs:needs.map(([slug,label])=>({url:`/ressources/${axis}/${slug}/`,label})),checks};
 return {...dossier,contentHash:createHash('sha256').update(JSON.stringify(dossier)).digest('hex')};
}
