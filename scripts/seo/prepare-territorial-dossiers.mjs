import {mkdirSync,writeFileSync,openSync,writeSync,closeSync} from 'node:fs';
import assert from 'node:assert/strict';
import {draftData} from '../../src/lib/seo/territorial-drafts.mjs';
import {enrichedTerritory,enrichmentData} from '../../src/lib/seo/territorial-insights.mjs';
import {territorialDossier,dossierDecision} from '../../src/lib/seo/territorial-dossier.mjs';
const output='outputs/seo-national-20260924';mkdirSync(output,{recursive:true});
const fd=openSync(`${output}/territorial-dossiers.jsonl`,'w');
const ids=new Set(),hashes=new Set(),profiles=new Map();let cases=0;const adaptations={};
try{
 for(const c of draftData().communes)for(const axis of ['sites','automatisation']){
  const d=territorialDossier(axis,c,enrichedTerritory(c.code));assert(!ids.has(d.id));ids.add(d.id);hashes.add(d.contentHash);
  assert.equal(d.steps.length,4);assert.equal(d.fields.length,6);assert(d.cases.length>=7);assert.equal(d.status,'prepared-not-editorially-approved');
  for(const test of d.cases){assert.equal(dossierDecision(test.input),test.expected,`${d.id}: ${test.id}`);cases++;}
  for(const [key,value] of Object.entries(d.assessment))if(value)adaptations[key]=(adaptations[key]||0)+1;
  const family=axis+':'+Object.values(d.assessment).map(Number).join('');profiles.set(family,(profiles.get(family)||0)+1);
  writeSync(fd,JSON.stringify(d)+'\n');
 }
}finally{closeSync(fd)}
assert.equal(ids.size,19988);assert.equal(hashes.size,19988);
const report={generatedAt:new Date().toISOString(),prepared:ids.size,uniqueRecordHashes:hashes.size,testCasesVerified:cases,adaptations,sharedConditionProfiles:profiles.size,profiles:Object.fromEntries(profiles),editoriallyApproved:0,sourceDate:enrichmentData().retrievedAt,sourceSha256:enrichmentData().sourceSha256,note:'Unique record hashes include territory identity; they do not prove distinct SEO intent. All dossiers retain noindex preview status. No fabricated market, client or office.'};
writeFileSync(`${output}/territorial-dossiers-audit.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
