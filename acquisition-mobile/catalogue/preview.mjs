import assert from 'node:assert/strict';
import {readFile,writeFile,rename} from 'node:fs/promises';
import {join} from 'node:path';
import {setTimeout as sleep} from 'node:timers/promises';
import {site,sha} from '../scripts/baseline.mjs';
import {assertFunctions,digestOf,functionPayload} from '../scripts/deploys.mjs';
import {prepare} from './manifest.mjs';
import {cacheDir,archiveId,mobileId,rawFile,filesOf,netJSON,request,parallel,waitDeploy} from './netlify.mjs';

const {files,uploads,archive,mobile,preview,facts}=await prepare();
const {digest}=facts;
const title='Catalogue et offre mobile — '+digest;
const checkpoint=join(cacheDir,'pending-'+digest+'.json');
const save=async(path,data)=>{
  const temp=path+'.'+process.pid;
  await writeFile(temp,JSON.stringify(data,null,2)+'\n');
  await rename(temp,path);
};
let pending;
try {pending=JSON.parse(await readFile(checkpoint,'utf8'));}
catch(e){if(e.code!=='ENOENT') throw e;}
if (!pending) {
  const recent=await netJSON('/sites/'+site+'/deploys?per_page=100');
  const prior=recent.find(d=>d.title===title && d.context==='deploy-preview' && !['error','canceled','rejected'].includes(d.state));
  const deploy=prior || await netJSON('/sites/'+site+'/deploys?title='+encodeURIComponent(title),{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({async:true,draft:true,branch:'main',files,...functionPayload(preview)})
  });
  pending={id:deploy.id,digest};await save(checkpoint,pending);
}
const {id}=pending;
assert.equal(pending.digest,digest);
assert.match(id,/^[a-f0-9]{24}$/);
const url='https://'+id+'--flex-webb.netlify.app';
console.log('Aperçu Netlify',url);
const endpoint='/sites/'+site+'/deploys/'+id;
let prepared;
for(let attempt=0;attempt<240;attempt++) {
  const d=await netJSON(endpoint);
  assert.equal(d.site_id,site);assert.ok(!d.published_at);
  assert.ok(!['error','rejected','canceled'].includes(d.state),'Déploiement échoué '+d.error_message);
  if(['prepared','uploading','uploaded','processing','ready'].includes(d.state)) {prepared=d;break;}
  if (attempt%12===0) console.log('Calcul Netlify',d.state);
  await sleep(4000);
}
assert.ok(prepared,'Calcul des différences du grand catalogue en attente, réexécuter pour reprendre.');
assert.deepEqual(prepared.required_functions||[],[]);
assert.deepEqual(prepared.required_edge_functions||[],[]);
if(['prepared','uploading'].includes(prepared.state)) {
  if(!pending.required) {
    pending.required=prepared.required || [];
    if(!pending.required.length && prepared.state==='uploading') pending.required=[...uploads.keys()];
    await save(checkpoint,pending);
  }
  const byHash=new Map(Object.entries(files).map(([path,hash])=>[hash,path]));
  console.log('Fichiers demandés par Netlify',pending.required.length);
  await parallel(pending.required,5,async hash=>{
    let source=uploads.get(hash);
    if(!source){
      const path=byHash.get(hash); assert.ok(path);
      const sourceId=mobile[path]===hash?mobileId:archiveId;
      assert.ok(mobile[path]===hash||archive[path]===hash,path);
      source={path,bytes:await rawFile(sourceId,path)};
    }
    assert.equal(sha(source.bytes),hash);
    const path=source.path.split('/').map(encodeURIComponent).join('/');
    const response=await request('/deploys/'+id+'/files'+path,{method:'PUT',headers:{'Content-Type':'application/octet-stream'},body:source.bytes});
    await response.arrayBuffer();
  });
}
const ready=await waitDeploy(id);
assert.equal(ready.context,'deploy-preview');
assert.equal(ready.site_id,site);
assertFunctions(preview,ready);
for(const title of [facts.redirects+' redirect rules processed',facts.headers+' header rules processed','2 functions deployed']){
  assert.ok(ready.summary.messages.some(m=>m.title===title && m.type==='info'),title);
}
assert.ok(ready.summary.messages.every(m=>m.type==='info'),JSON.stringify(ready.summary.messages));
await save(join(cacheDir,'preview-ready.json'),{...facts,id,url});
console.log('Prêt, vérification du manifeste distant',id);
const actual=await filesOf(id);
assert.equal(Object.keys(actual).length,facts.files);
assert.equal(digestOf(actual),digest);
const live=(await netJSON('/sites/'+site)).published_deploy;
assert.equal(live.id,facts.baseId);
assert.equal(live.locked,facts.productionLocked);
const candidate={...facts,id,url};
await save(join(cacheDir,'candidate.json'),candidate);
console.log(candidate);
