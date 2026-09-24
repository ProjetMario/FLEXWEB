import {test} from 'node:test';
import assert from 'node:assert/strict';
import {draftData} from '../../src/lib/seo/territorial-drafts.mjs';
import {enrichedTerritory} from '../../src/lib/seo/territorial-insights.mjs';
import {territorialDossier,dossierDecision} from '../../src/lib/seo/territorial-dossier.mjs';
const communes=draftData().communes;
test('all 19988 dossiers retain identity and source-linked edge cases',()=>{
 const ids=new Set();
 for(const c of communes)for(const axis of ['sites','automatisation']){
  const e=enrichedTerritory(c.code),d=territorialDossier(axis,c,e);assert.equal(d.communeCode,c.code);assert(!ids.has(d.id));ids.add(d.id);
  assert.equal(d.status,'prepared-not-editorially-approved');assert.equal(d.cases.some(x=>x.id.endsWith(':postal')),e.postalGroups.some(p=>p.totalCommunes>1));
  assert.equal(d.cases.some(x=>x.id.endsWith(':homonym')),e.homonyms.length>0);
  const validCodes=new Set([c.code,...e.nearby.map(n=>n.code),...e.homonyms.map(n=>n.code)]);
  for(const t of d.cases)assert(validCodes.has(t.communeCode));
  assert(d.fields.find(f=>f.name==='Commune confirmée').example.includes(c.code));
 }
 assert.equal(ids.size,19988);
});
test('a covered commune never implies a confirmed appointment',()=>{
 assert.equal(dossierDecision({communeConfirmed:true,mode:'onsite',scope:'covered'}),'confirm-availability');
 assert.equal(dossierDecision({communeConfirmed:true,mode:'onsite',scope:'covered',available:true}),'prepare-appointment-for-approval');
});
test('unknown locations and rejected local coverage cannot dispatch work',()=>{
 assert.equal(dossierDecision({communeConfirmed:false,mode:'onsite',scope:'covered',available:true}),'confirm-commune');
 assert.equal(dossierDecision({communeConfirmed:true,mode:'onsite',scope:'outside',available:true}),'review-outside-scope');
 assert.equal(dossierDecision({communeConfirmed:true,mode:'remote',scope:'outside'}),'qualify-remote-project');
});
test('duplicate event recovery precedes further qualification',()=>{
 assert.equal(dossierDecision({duplicateEvent:true,communeConfirmed:false}),'reuse-existing-request');
});
test('mismatched sources and unsupported axes fail instead of inventing facts',()=>{
 const c=communes[0],e=enrichedTerritory(c.code);
 assert.throws(()=>territorialDossier('unknown',c,e),/identity/);
 assert.throws(()=>territorialDossier('sites',c,{...e,code:'00000'}),/identity/);
});
test('missing EPCI remains explicitly missing and does not block the dossier',()=>{
 const c=communes.find(c=>!enrichedTerritory(c.code).epci),d=territorialDossier('automatisation',c,enrichedTerritory(c.code));
 assert(d.checks.some(x=>x.includes('laisser ce champ vide')));
 assert(!JSON.stringify(d).includes('undefined'));
});
