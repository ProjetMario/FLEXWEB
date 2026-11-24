import assert from 'node:assert/strict';
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {filesOf,rawFile,parallel,netJSON} from '../../catalogue/netlify.mjs';
import {sha} from '../../scripts/baseline.mjs';
import {digestOf} from '../../scripts/deploys.mjs';
import {publishedAddresses, transformPublicContact} from '../../../scripts/contact/public-contact.mjs';
import {embedContact} from './embedded.mjs';
import {buildEdge,bundleDirectory,publicPageRules} from './bundle.mjs';
import {project,readSite,edgeFolder,sha256,applyPatch,deployDelta} from './delta.mjs';
const base=await netJSON('/deploys/'+(await readSite()).published_deploy.id);
assert.equal(base.id,'6b0571e482dfe03c8f565b08');
const original=await filesOf(base.id);
const bytes=new Map();
const changes={};
function stage(path,body){
  const digest=sha(body);
  if(digest!==original[path]){ bytes.set(path,body); changes[path]={from:original[path]??null,to:digest}; }
}
const candidates=Object.keys(original).filter(path=>/^\/(?:en\/)?contact\/index\.html$/.test(path) ||
  /^\/(?:llms(?:-full)?|ai-overview)\.txt$/.test(path) || /^\/(?:_astro|studio-redesign)\/[^/]+\.m?js$/.test(path));
await parallel(candidates,6,async path=>{
  const stored=await rawFile(base.id,path);assert.equal(sha(stored),original[path]);
  let text=stored.toString();
  if(path.endsWith('.html')) text=embedContact(text,path.startsWith('/en/')?'en':'fr');
  const output=transformPublicContact(path,text);
  assert.deepEqual(publishedAddresses(output),[],path);
  stage(path,Buffer.from(output));
});
const bundle=await buildEdge(publicPageRules);
const edge=bundle.bundles[0].asset.replace(/\.eszip$/,'');
for(const name of await readdir(bundleDirectory))stage(edgeFolder+name,await readFile(join(bundleDirectory,name)));
assert.equal(sha256(bytes.get(edgeFolder+edge+'.eszip')),edge);
const files=Object.assign({},original,Object.fromEntries(Object.entries(changes).map(([p,c])=>[p,c.to])));
const receipt={base:base.id,before:digestOf(original),after:digestOf(files),edge,changes};
applyPatch(original,receipt);
const recent=await netJSON(project+'/deploys?per_page=16');
const ready=recent.find(d=>d.context==='deploy-preview'&&d.state==='ready'&&d.branch==='main'&&d.title==='Formulaires publics — correctif différentiel '+receipt.after);
const preview=ready || await deployDelta({base,files,receipt,draft:true,getBytes:async p=>bytes.get(p)});
receipt.preview=preview.id;
await writeFile(new URL('./delta-receipt.json',import.meta.url),JSON.stringify(receipt,null,2)+'\n');
console.log('Delta',Object.keys(changes).length,'fichiers et objets de configuration, catalogue intact',receipt.preview);
