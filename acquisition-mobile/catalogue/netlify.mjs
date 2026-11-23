import assert from 'node:assert/strict';
import {readFile, writeFile, rename, mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {setTimeout as sleep} from 'node:timers/promises';
import {cache, site} from '../scripts/baseline.mjs';

export const archiveId = '6af791098269e8f08591ce03';
export const mobileId = '6b0485a09cae4d4dbe96caf4';
export const cacheDir = join(cache,'catalogue');
const provider = 'https://api.netlify.com/api/v1';
let token;
async function authorization() {
  if (!token) {
    if (process.env.NETLIFY_AUTH_TOKEN) token=process.env.NETLIFY_AUTH_TOKEN;
    else {
      const config=JSON.parse(await readFile(join(process.env.HOME,'Library/Preferences/netlify/config.json'),'utf8'));
      token=config.users[config.userId].auth.token;
    }
  }
  return 'Bearer '+token;
}
export async function request(path,init={}) {
  const retryable = ['GET','PUT'].includes(init.method||'GET');
  let response;
  for (let attempt=0;attempt<(retryable?9:1);attempt++) {
    try {
      response = await fetch(provider+path,{...init,signal:AbortSignal.timeout(180000),headers:{Authorization:await authorization(),...init.headers}});
    } catch(error) {
      if (!retryable || attempt===8) throw error;
      await sleep(Math.min(30000,1000*2**attempt)); continue;
    }
    if (response.ok) return response;
    const status=response.status;
    if (retryable && [408,429,502,503,504,500].includes(status) && attempt<8) {
      const seconds=Number(response.headers.get('retry-after')||'0');
      await response.arrayBuffer();
      await sleep(Math.max(seconds*1000,Math.min(30000,1000*2**attempt))); continue;
    }
    throw new Error('Netlify '+(init.method||'GET')+' '+path+' HTTP '+status+' '+(await response.text()).slice(0,220));
  }
}
export const netJSON=async(path,init)=>(await request(path,init)).json();
const folderFor = id => join(cacheDir,'manifests',id);
function pathOf(id) { assert.match(id,/^[a-f0-9]{24}$/); return '/deploys/'+id+'/files'; }
export async function rawFile(id,path) {
  const remote=pathOf(id)+path.split('/').map(encodeURIComponent).join('/');
  const res=await request(remote,{headers:{'Content-Type':'application/vnd.bitballoon.v1.raw'}});
  return Buffer.from(await res.arrayBuffer());
}
export async function parallel(items,limit,fn) {
  let index=0;
  await Promise.all(Array.from({length:Math.min(items.length,limit)},async()=>{
    while (index<items.length) {const current=index++;await fn(items[current], current);}
  }));
}
export async function filesOf(id) {
  const folder=folderFor(id);
  await mkdir(folder,{recursive:true});
  const url=pathOf(id)+'?per_page=100&page=';
  const first=await request(url+'1');
  const last=parseInt((first.headers.get('link')||'').match(/page=(\d+)>; rel="last"/)?.[1]||'1',10);
  assert.ok(last>=1 && last<=5000, 'Nombre de pages de métadonnées Netlify inattendu');
  const initial=await first.json();
  function compact(batch) {
    return batch.map(f=>{
      assert.equal(f.deploy_id,id); assert.equal(f.site_id,site);
      assert.ok(f.path.startsWith('/'));assert.match(f.sha,/^[a-f0-9]{40}$/);
      return [f.path,f.sha];
    });
  }
  const files=Object.create(null);
  const pages=Array.from({length:last},(_,i)=>i+1);
  let complete=0;
  const start=Date.now();
  await parallel(pages,12,async n=>{
    const checkpoint=join(folder,n+'.json');
    let entries;
    try { entries=JSON.parse(await readFile(checkpoint,'utf8')); }
    catch(error) {
      if(error.code!=='ENOENT') throw error;
      entries=compact(n===1?initial:await netJSON(url+n));
      assert.ok(entries.length>0 && (n===last || entries.length===100));
      const temp=checkpoint+'.'+process.pid;
      await writeFile(temp,JSON.stringify(entries)); await rename(temp,checkpoint);
    }
    for(const [path,sha] of entries) {
      assert.ok(!Object.hasOwn(files,path),'Chemin répété : '+path);
      files[path]=sha;
    }
    if (++complete % 300===0 && Date.now()-start>5000) console.log(id,complete+'/'+last+' pages du manifeste lues');
  });
  return files;
}
export async function waitDeploy(id,seconds=2100) {
  for (let elapsed=0;elapsed<seconds;elapsed+=5) {
    const d=await netJSON('/deploys/'+id);
    if (d.state==='ready' && d.summary?.status==='ready') return d;
    assert.ok(!['error','rejected','canceled'].includes(d.state),'Netlify '+d.state+': '+d.error_message);
    await sleep(5000);
  }
  throw new Error('Délai Netlify dépassé, conserver le reçu et reprendre '+id);
}
if (process.argv[1]?.endsWith('/catalogue/netlify.mjs')) {
  const files=await filesOf(process.argv[2]||archiveId);console.log(Object.keys(files).length+' fichiers dans le manifeste immuable');
}
