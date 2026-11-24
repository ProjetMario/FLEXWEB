import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {setTimeout as sleep} from 'node:timers/promises';
import {filesOf,rawFile,netJSON,request} from '../../catalogue/netlify.mjs';
import {digestOf,functionPayload} from '../../scripts/deploys.mjs';
import {applyPatch,checkReceiver,deployDelta,project,readSite,edgeFolder,sha256} from './delta.mjs';
import {checkPages,checkSitemap} from './check-delta.mjs';

assert.equal(process.env.GITHUB_ACTIONS,'true');
assert.equal(process.env.GITHUB_EVENT_NAME,'workflow_dispatch');
assert.equal(process.env.GITHUB_REF,'refs/heads/main');
assert.equal(process.env.GITHUB_REPOSITORY?.toLowerCase(),'projetmario/flexweb');
const receipt=JSON.parse(await readFile(new URL('./delta-receipt.json',import.meta.url)));
assert.equal(process.argv[2],receipt.preview);
const checkHead=()=>assert.equal(execFileSync('gh',['api','repos/ProjetMario/FLEXWEB/commits/main','--jq','.sha'],{encoding:'utf8'}).trim(),process.env.GITHUB_SHA);
checkHead();
const base=await netJSON('/deploys/'+receipt.base);
const draft=await netJSON('/deploys/'+receipt.preview);
const before=await readSite(), live=before.published_deploy;
assert.equal(draft.site_id,base.site_id);
assert.equal(draft.context,'deploy-preview');
assert.equal(draft.state,'ready');
assert.ok(draft.edge_functions_present && live.locked);
assert.deepEqual(functionPayload(draft),functionPayload(base));
assert.equal(sha256(await rawFile(draft.id,edgeFolder+receipt.edge+'.eszip')),receipt.edge);
const source=await filesOf(base.id);
const files=applyPatch(source,receipt);
const actualDraft=await filesOf(draft.id);
assert.equal(digestOf(actualDraft),receipt.after);
const url=id=>'https://'+id+'--flex-webb.netlify.app';
await checkPages(url(draft.id),files,receipt);
await checkReceiver();
checkHead();
const old=live.id===base.id;
let candidate;
const update=async path=>{const r=await request(path,{method:'POST'});await r.arrayBuffer();};
try {
  if(old) {
    assert.equal((await readSite()).published_deploy.id,base.id);
    // Preserve the live lock while Netlify prepares the new production-context copy.
    const copy={base,receipt,files,draft:false,getBytes:path=>rawFile(draft.id,path)};
    try {
      candidate=await deployDelta(copy);
    } catch (error) {
      if(!/HTTP (?:403|409|422).*?(?:locked|auto.?publish)/i.test(error.message))throw error;
      assert.equal((await readSite()).published_deploy.id,base.id);
      await update('/deploys/'+base.id+'/unlock');
      assert.equal((await readSite()).published_deploy.id,base.id);
      candidate=await deployDelta({...copy,locked:false});
    }
  } else {
    assert.equal(live.title,'Formulaires publics — correctif différentiel '+receipt.after,'Une autre publication est active');
    candidate=await netJSON('/deploys/'+live.id);
  }
  assert.equal(candidate.context,'production');
  assert.equal(candidate.state,'ready');
  assert.deepEqual(functionPayload(candidate),functionPayload(base));
  assert.equal(digestOf(await filesOf(candidate.id)),receipt.after,'Copie de production différente du correctif certifié');
  const active=(await readSite()).published_deploy;
  assert.ok([base.id,candidate.id].includes(active.id),'Publication concurrente');
  if(active.id!==candidate.id) {
    checkHead();
    // Explicitly publish only the production copy just verified, never the latest branch build.
    try {
      await update(project+'/deploys/'+candidate.id+'/restore');
    } catch (error) {
      if(!active.locked || !/HTTP (?:403|409|422).*?(?:locked|auto.?publish)/i.test(error.message))throw error;
      assert.equal((await readSite()).published_deploy.id,base.id);
      await update('/deploys/'+base.id+'/unlock');
      const now=(await readSite()).published_deploy.id;
      assert.ok([base.id,candidate.id].includes(now));
      if(now===base.id)await update(project+'/deploys/'+candidate.id+'/restore');
    }
  }
  for(let i=0;i<60;i++){
    if((await readSite()).published_deploy.id===candidate.id)break;
    await sleep(1000);
  }
  assert.equal((await readSite()).published_deploy.id,candidate.id);
  if(!(await readSite()).published_deploy.locked)await update('/deploys/'+candidate.id+'/lock');
  await checkPages('https://flex-web.fr',files,receipt);
  await checkSitemap('https://flex-web.fr');
  await checkReceiver();
  console.log('Version publique vérifiée',candidate.id,'avec',Object.keys(receipt.changes).length,'fichiers ou règles modifiés.');
} finally {
  const active=(await readSite()).published_deploy;
  if([base.id,candidate?.id].includes(active.id)&&!active.locked)await update('/deploys/'+active.id+'/lock');
}
