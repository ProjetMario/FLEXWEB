// An illustrative planner: no account data, network request, side effect or automatic dispatch.
export function qualificationDecision({territoryKnown,inScope,channel}){
 if(!territoryKnown)return 'À qualifier : la commune doit être confirmée avant toute affectation.';
 if(!['remote','onsite'].includes(channel))return 'Mode de prestation à confirmer : préciser une intervention sur place ou un projet à distance.';
 if(channel==='remote')return 'Projet à distance : valider la prestation, les outils et un responsable du dossier.';
 if(inScope==='yes')return 'Zone déclarée couverte : faire confirmer la disponibilité avant de promettre une intervention.';
 if(inScope==='no')return 'Zone déclarée non couverte : préparer une réponse à valider, sans rendez-vous automatique.';
 return 'Périmètre non confirmé : conserver la demande dans la file de qualification.';
}
