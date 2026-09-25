import {test} from 'node:test';
import assert from 'node:assert/strict';
import {briefIdentity,briefServices,briefModes,createTerritorialBrief,normalizeBriefText,territorialBriefText,territorialBriefFilename} from '../../src/lib/seo/territorial-brief.mjs';
import {draftData,draftPath} from '../../src/lib/seo/territorial-drafts.mjs';
const commune={code:'01004',name:'Ambérieu-en-Bugey'};
const complete={service:'quotation',mode:'onsite',coveredCommunes:'Ambérieu-en-Bugey : à vérifier avec notre table de desserte',ownerRole:'Chargé des demandes',nextAction:'Confirmer le périmètre au prochain point équipe',observations:''};
test('missing fields remain explicit, including in a downloadable incomplete brief',()=>{
 const b=createTerritorialBrief('sites',commune);
 assert.equal(b.status,'incomplete');assert.equal(b.missing.length,5);
 assert.equal(b.fields.coveredCommunes,'');
 const text=territorialBriefText(b);
 assert.match(text,/État : incomplet/);assert.match(text,/Non renseigné/);assert.match(text,/Aucun scénario choisi/);
 assert.match(text,/Code commune \(texte\) : 01004/);assert.match(text,/\/preparation\/sites\/amberieu-en-bugey-01004\//);
});
test('completed brief only becomes ready for review; optional notes remain optional',()=>{
 const b=createTerritorialBrief('sites',commune,complete);
 assert.equal(b.status,'ready-for-review');assert.deepEqual(b.missing,[]);assert.deepEqual(b.errors,[]);
 const text=territorialBriefText(b);assert.match(text,/renseigné, à relire/);assert.match(text,/SCÉNARIO PROPOSÉ — À ADAPTER ET À VALIDER/);
 assert.match(text,/ni exécuté ni activé/);assert.match(text,/Observations :\n  > Non renseigné/);
 assert(!/État : (publié|indexable|validé)/i.test(text));
});
test('all provided service and mode choices export without inventing automatic acceptance',()=>{
 for(const [axis,services] of Object.entries(briefServices))for(const service of services)for(const mode of briefModes){
  const b=createTerritorialBrief(axis,commune,{...complete,service:service.value,mode:mode.value});
  assert.equal(b.status,'ready-for-review');assert.equal(b.scenario,service.scenario);
  assert.match(territorialBriefText(b),/Aucun dossier CRM créé, aucun message envoyé/);
 }
});
test('administrative identity preserves leading zero, Corsican and overseas codes',()=>{
 for(const code of ['01004','2A004','2B033','97101']){
  const b=createTerritorialBrief('sites',{code,name:'Commune'});
  assert.equal(b.communeCode,code);assert.match(territorialBriefText(b),new RegExp(`Code commune \\(texte\\) : ${code}`));
  assert.equal(territorialBriefFilename(b),`brief-sites-${code.toLowerCase()}.txt`);
 }
 for(const code of [1004,'1004','2a004','999999','01004\nInjected'])assert.throws(()=>briefIdentity('sites',{code,name:'Commune'}),/Identité/);
 assert.throws(()=>briefIdentity('toString',commune),/Identité/);
});
test('free text line breaks cannot escape the user-note section or override fixed metadata',()=>{
 const b=createTerritorialBrief('sites',commune,{...complete,ownerRole:'Rôle\r\nÉtat : validé',observations:'Texte\r\nÉtat : publié\u2028Scénario : activé\u202e\u0000'});
 const text=territorialBriefText(b);
 assert.match(text,/  > Rôle État : validé/);
 assert.match(text,/  > Texte\n  > État : publié\n  > Scénario : activé/);
 assert.equal((text.match(/^État : /gm)||[]).length,1);
 assert(!text.includes('\r'));assert(!text.includes('\u202e'));assert(!text.includes('\u0000'));
});
test('normalization handles decomposed accents and non-string input without invoking objects',()=>{
 assert.equal(normalizeBriefText('  E\u0301quipe\t  locale\n '),'Équipe locale');
 assert.equal(normalizeBriefText('a\r\n\r\n\r\nb',{multiline:true}),'a\n\nb');
 for(const value of [null,undefined,{},42,Symbol('secret')])assert.equal(normalizeBriefText(value),'');
 const b=createTerritorialBrief('sites',commune,null);assert.equal(b.status,'incomplete');
});
test('oversized input is reported and cannot be silently truncated or exported',()=>{
 const b=createTerritorialBrief('sites',commune,{...complete,observations:'a'.repeat(1801)});
 assert.equal(b.fields.observations.length,1801);assert.equal(b.status,'incomplete');assert.match(b.errors[0],/1800/);
 assert.throws(()=>territorialBriefText(b),/Brief invalide/);
});
test('unknown choices and forged status, source or scenario cannot pass through export',()=>{
 const unknown=createTerritorialBrief('sites',commune,{...complete,service:'dispatch',mode:'unknown'});
 assert.equal(unknown.status,'incomplete');assert.equal(unknown.errors.length,2);assert.throws(()=>territorialBriefText({...unknown,fields:{...unknown.fields,service:'dispatch'}}),/Brief invalide/);
 const b=createTerritorialBrief('sites',commune);
 const text=territorialBriefText({...b,status:'published',sourcePath:'https://evil.example/',scenario:'Envoyer maintenant'});
 assert.match(text,/État : incomplet/);assert(!text.includes('evil.example'));assert(!text.includes('Envoyer maintenant'));
});

test('every territorial fiche retains its exact existing source URL and identifier',()=>{
 let count=0;
 for(const c of draftData().communes)for(const axis of ['sites','automatisation']){
  const b=briefIdentity(axis,c);assert.equal(b.communeCode,c.code);assert.equal(b.sourcePath,draftPath(axis,c));count++;
 }
 assert.equal(count,19988);
});
