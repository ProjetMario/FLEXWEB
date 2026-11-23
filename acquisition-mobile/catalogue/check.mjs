import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {gunzipSync} from 'node:zlib';
import {parseSitemap} from './inventory.mjs';

const expected=JSON.parse(await readFile(new URL('./expected.json',import.meta.url)));
const historical=JSON.parse(gunzipSync(await readFile(new URL('../../seo/inventories/published-2026-10-22-and-2026-11-05.json.gz',import.meta.url))));
export const expectedPaths=new Set([...historical.historical.paths,...historical.current.paths,...expected.additionalPaths]);
const digest=list=>createHash('sha256').update([...list].sort().join('\n')+'\n').digest('hex');
assert.equal(expectedPaths.size,expected.urlCount);
assert.equal(digest(expectedPaths),expected.pathsSha256);
export async function checkCatalog(read,exact=false) {
  const paths=new Set();
  const children=parseSitemap(await read('/sitemap.xml'),true).map(e=>new URL(e.loc).pathname);
  // Future versions may add sections and URLs while keeping the established inventory.
  const childSet=new Set(children);
  assert.ok(expected.sitemaps.every(s=>childSet.has(s)),'Sous-sitemap historique absent');
  for (let i=0;i<children.length;i+=5) {
    const groups=await Promise.all(children.slice(i,i+5).map(async path=>parseSitemap(await read(path))));
    for (const records of groups) for (const row of records) {
      const path=new URL(row.loc).pathname;
      assert.ok(!paths.has(path),'URL dupliquée '+path);
      paths.add(path);
    }
  }
  const missing=[...expectedPaths].filter(p=>!paths.has(p));
  assert.equal(missing.length,0,'URL manquantes ('+missing.length+') : '+missing.slice(0,8).join(', '));
  if(exact){
    assert.equal(children.length,expected.sitemaps.length);
    assert.equal(paths.size,expected.urlCount);
  }
  return {urls:paths.size,sitemaps:children.length,pathsSha256:digest(paths)};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const [source,flag]=process.argv.slice(2);
  assert.ok(source,'Indiquer une origine HTTPS ou un dossier Astro');
  const remote=source.startsWith('https://');
  const read=remote?async path=>{
    const res=await fetch(new URL(path,source),{redirect:'error',signal:AbortSignal.timeout(45000)});
    assert.equal(res.status,200,path);
    return res.text();
  }:path=>readFile(join(resolve(source),path),'utf8');
  console.log(await checkCatalog(read,flag==='--exact'));
}
