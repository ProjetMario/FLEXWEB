import assert from 'node:assert/strict';
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {join,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildEdge,bundleDirectory,publicPageRules} from '../redesign/contact/bundle.mjs';
import {checkReceiver,deployDelta,edgeFolder,project,readSite} from '../redesign/contact/delta.mjs';
import {filesOf,netJSON,rawFile} from '../catalogue/netlify.mjs';
import {sha,site} from '../scripts/baseline.mjs';
import {digestOf} from '../scripts/deploys.mjs';

export const titlePrefix='Lecture français-anglais — ';
export const receiptFile=new URL('./preview.json',import.meta.url);
const publicAssets=fileURLToPath(new URL('../../public/language-assets/',import.meta.url));
export function applyLanguageDelta(source,receipt){
  assert.equal(digestOf(source),receipt.before);
  const output={...source};
  for(const [path,change] of Object.entries(receipt.changes)){
    assert.ok(/^\/language-assets\/[a-z0-9./-]+$/.test(path) && !path.includes('..') ||
      path===edgeFolder+'manifest.json' || path===edgeFolder+receipt.edge+'.eszip',path);
    assert.equal(source[path]??null,change.from,path);
    assert.match(change.to,/^[a-f0-9]{40}$/);output[path]=change.to;
  }
  assert.equal(digestOf(output),receipt.after);
  return output;
}
export async function verifyBaseEdge(id){
  const old=JSON.parse(await rawFile(id,edgeFolder+'manifest.json'));
  assert.ok(old.routes.length && !old.post_cache_routes?.length);
  assert.ok(old.routes.every(r=>r.function==='public-contact' || r.function==='language-country'),'Unexpected existing edge handler');
  const contact=old.routes.find(r=>r.function==='public-contact');assert.equal(contact?.path,'/*');
  assert.ok(contact.excluded_patterns.length>=7);
  return old;
}
async function prepare(){
  const live=await readSite(),base=await netJSON('/deploys/'+live.published_deploy.id);
  assert.equal(base.site_id,site);assert.ok(base.locked && base.state==='ready');
  await verifyBaseEdge(base.id);
  const original=await filesOf(base.id), bytes=new Map(), changes={};
  function stage(path,data){
    const hash=sha(data);if(original[path]===hash)return;
    changes[path]={from:original[path]??null,to:hash};bytes.set(path,data);
  }
  for(const item of await readdir(publicAssets,{recursive:true,withFileTypes:true})){
    if(!item.isFile())continue;
    const filename=join(item.parentPath??item.path,item.name);
    stage('/language-assets/'+relative(publicAssets,filename),await readFile(filename));
  }
  const contact=publicPageRules[0];
  const decl=[{...contact,excludedPath:[...contact.excludedPath,'/language-assets/*','/api/langue/']},{function:'language-country',path:'/api/langue/'}];
  const manifest=await buildEdge(decl);const edge=manifest.bundles[0].asset.replace(/\.eszip$/,'');
  for(const name of await readdir(bundleDirectory))stage(edgeFolder+name,await readFile(join(bundleDirectory,name)));
  const output={...original,...Object.fromEntries(Object.entries(changes).map(([path,c])=>[path,c.to]))};
  const receipt={base:base.id,before:digestOf(original),after:digestOf(output),edge,changes};
  applyLanguageDelta(original,receipt);
  console.log('Base',receipt.base,'fichiers repris',Object.keys(original).length,'ressources de lecture et edge',Object.keys(changes).length);
  const ready=(await netJSON(project+'/deploys?per_page=100')).find(d=>d.context==='deploy-preview' && d.state==='ready' && d.title===titlePrefix+receipt.after);
  const draft=ready||await deployDelta({base,files:output,receipt,draft:true,getBytes:path=>bytes.get(path),baseHasEdge:true,titlePrefix});
  receipt.preview=draft.id;
  await writeFile(receiptFile,JSON.stringify(receipt,null,2)+'\n');
  assert.equal((await readSite()).published_deploy.id,base.id);await checkReceiver();
  console.log('Aperçu https://'+draft.id+'--flex-webb.netlify.app');
}
if(process.argv[1]===fileURLToPath(import.meta.url))await prepare();
