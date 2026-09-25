import {test} from 'node:test';
import assert from 'node:assert/strict';
import {enrichedTerritory,enrichmentData,localInsights,localQuestions} from '../../src/lib/seo/territorial-insights.mjs';
import {qualificationDecision} from '../../src/lib/seo/qualification.mjs';
import {draftData,draftEntries} from '../../src/lib/seo/territorial-drafts.mjs';
import {projectGuides} from '../../src/lib/seo/project-guides.mjs';
test('all existing territories have provenance and exact stable identifiers',()=>{
 const d=enrichmentData();assert.match(d.sourceSha256,/^[a-f0-9]{64}$/);assert.equal(new URL(d.source).hostname,'geo.api.gouv.fr');assert.deepEqual(d.communes.map(c=>c.code),draftData().communes.map(c=>c.code));
 for(const c of d.communes){assert.equal(c.nearby.length,3);assert.equal(new Set(c.nearby.map(n=>n.code)).size,3);for(const n of c.nearby){assert.notEqual(n.code,c.code);assert(n.distanceKm>=0);}for(const p of c.postalGroups){assert(p.totalCommunes>=p.others.length+1);assert(!p.others.some(o=>o.code===c.code));}}
});
test('shared postal codes drive an explicit useful diagnosis, not an invented market claim',()=>{
 const c=draftData().communes.find(c=>c.code==='73065'),e=enrichedTerritory(c.code);assert(e.postalGroups.some(p=>p.postalCode==='73000'&&p.totalCommunes>1));
 for(const axis of ['sites','automatisation']){const insights=localInsights(axis,c,e);assert(insights[0].fact.includes('ne suffit pas'));assert(insights[0].action.includes('73065'));assert(insights[2].fact.includes('vol d\'oiseau'));assert(localQuestions(axis,c,e)[2].a.includes('ne mesurent'));}
});
test('territorial catalogue publishes the same complete routes in production and preview',()=>{
 const old=process.env.CONTEXT,flag=process.env.FLEXWEB_DRAFT_PREVIEW;process.env.CONTEXT='production';delete process.env.FLEXWEB_DRAFT_PREVIEW;const production=draftEntries();assert.equal(production.length,19988);process.env.CONTEXT='deploy-preview';assert.deepEqual(draftEntries(),production);if(old===undefined)delete process.env.CONTEXT;else process.env.CONTEXT=old;if(flag===undefined)delete process.env.FLEXWEB_DRAFT_PREVIEW;else process.env.FLEXWEB_DRAFT_PREVIEW=flag;
});
test('qualification is conservative for missing facts and never confirms a booking',()=>{
 assert.match(qualificationDecision({territoryKnown:false,inScope:'yes',channel:'remote'}),/À qualifier/);
 assert.match(qualificationDecision({territoryKnown:true,inScope:'unknown',channel:'onsite'}),/non confirmé/);
 assert.match(qualificationDecision({territoryKnown:true,inScope:'no',channel:'onsite'}),/sans rendez-vous automatique/);
 assert.match(qualificationDecision({territoryKnown:true,inScope:'yes',channel:'onsite'}),/confirmer la disponibilité/);
 assert.match(qualificationDecision({territoryKnown:true,inScope:'no',channel:'remote'}),/à distance/);
});
test('twelve guides provide decisions, examples and recipe checks',()=>{
 for(const axis of ['sites','automatisation']){assert.equal(projectGuides[axis].length,6);assert.equal(new Set(projectGuides[axis].map(g=>g.id)).size,6);for(const g of projectGuides[axis]){assert(g.inputs.length>=2&&g.steps.length>=3&&g.checks.length>=2&&g.limits.length>=1);assert.match(g.example,/illustratif/i);assert(g.metric.length>20);}}
});

test('similar names disclose accent normalization instead of claiming strict spelling equality',()=>{
 const c=draftData().communes.find(c=>c.code==='73181'),e=enrichedTerritory(c.code);
 assert(e.homonyms.some(h=>h.name!==c.name));
 assert(localInsights('sites',c,e)[1].fact.includes('normalisation des accents'));
});

test('an absent postal code remains unknown in both the diagnosis and FAQ',()=>{
 const source=draftData().communes[0],c={...source,postalCodes:[]},e={...enrichedTerritory(c.code),postalGroups:[]};
 for(const axis of ['sites','automatisation']){
  const fact=localInsights(axis,c,e)[0].fact,answer=localQuestions(axis,c,e)[0].a;
  assert.match(fact,/Aucun code postal n’est renseigné/);
  assert.match(answer,/ne reconstituez pas le code postal/);
  assert(!fact.includes('la seule commune'));
  assert(!answer.includes('indique pas de partage'));
 }
});

test('an incomplete postal comparison does not become evidence of exclusivity',()=>{
 const c=draftData().communes[0],e={...enrichedTerritory(c.code),postalGroups:[]};
 for(const axis of ['sites','automatisation']){
  assert.match(localInsights(axis,c,e)[0].fact,/rapprochement.*incomplet/);
  assert.match(localQuestions(axis,c,e)[0].a,/Ne concluez pas à un code exclusif/);
  assert(!localInsights(axis,c,e)[0].fact.includes('la seule commune'));
 }
});

test('qualification asks for the service mode when absent or invalid',()=>{
 for(const channel of [undefined,null,'','unknown','REMOTE']){
  assert.match(qualificationDecision({territoryKnown:true,inScope:'yes',channel}),/Mode de prestation à confirmer/);
 }
});
