import assert from 'node:assert/strict';
import {readFile, readdir, mkdir, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {parse, stringify} from 'smol-toml';
import {root,baseId,site,sha} from '../scripts/baseline.mjs';
import {digestOf,assertFunctions} from '../scripts/deploys.mjs';
import {cacheDir,archiveId,mobileId,netJSON,rawFile,filesOf} from './netlify.mjs';

async function configuration(mobile,archived) {
  const original=await rawFile(mobileId,'/netlify.toml');
  const old=await rawFile(archiveId,'/netlify.toml');
  assert.equal(sha(original),mobile['/netlify.toml']);
  assert.equal(sha(old),archived['/netlify.toml']);
  const current=parse(original.toString()), previous=parse(old.toString());
  const territorialRedirect=previous.redirects.filter(rule=>rule.from==='/preparation/*');
  const territorialHeaders=previous.headers.filter(rule=>rule.for==='/territoires/donnees/*');
  assert.equal(territorialRedirect.length,1);
  assert.equal(territorialHeaders.length,1);
  assert.ok(!current.redirects.some(r=>r.from==='/preparation/*'));
  const extra=stringify({redirects:territorialRedirect,headers:territorialHeaders});
  const result=Buffer.concat([original,Buffer.from('\n'+extra)]);
  const fresh=parse(result.toString());
  assert.deepEqual(fresh,{...current,headers:[...current.headers,...territorialHeaders],redirects:[...current.redirects,...territorialRedirect]});
  return {result,redirects:fresh.redirects.length,headers:fresh.headers.length};
}
export async function prepare() {
  const live=(await netJSON('/sites/'+site)).published_deploy;
  assert.equal(live.id,baseId,'Rebaser la fusion si la production a changé.');
  const mobileReceipt=JSON.parse(await readFile(join(root,'release-candidate.json'),'utf8'));
  assert.equal(mobileReceipt.id,mobileId);assert.equal(mobileReceipt.baseId,baseId);
  const [archive,mobile,reference,preview,original]=await Promise.all([filesOf(archiveId),filesOf(mobileId),netJSON('/deploys/'+baseId),netJSON('/deploys/'+mobileId),netJSON('/deploys/'+archiveId)]);
  for(const d of [reference,preview,original]) {assert.equal(d.site_id,site);assert.equal(d.state,'ready');}
  assertFunctions(reference,preview);
  assert.ok(!reference.edge_functions_present && !reference.server);
  assert.equal(digestOf(mobile),mobileReceipt.digest);
  const files={...mobile};
  const uploads=new Map();
  const classified=JSON.parse(await readFile(join(cacheDir,'inventory-summary.json'),'utf8'));
  assert.equal(classified.total,151507);assert.equal(classified.children,85);
  const required=new Set();
  const input=(await readFile(join(cacheDir,'inventory.ndjson'),'utf8')).trimEnd().split('\n');
  for (const line of input) {
    const row=JSON.parse(line), path=row.html.toLowerCase();
    assert.ok(!required.has(path));
    required.add(path);
    if (row.source==='candidate') assert.ok(mobile[path],path+' absent de l’aperçu mobile');
    else {
      assert.equal(row.source,'archive');assert.ok(!mobile[path] && archive[path],path);
      files[path]=archive[path];
    }
  }
  assert.equal(required.size,classified.total);
  // Recover immutable framework bundles, public editorial media and the geographic
  // directory used by TerritorySearch. Prospect dossiers and unrelated routes stay outside the manifest.
  let supportingPages=0;
  for (const [path,hash] of Object.entries(archive)) {
    if (!files[path] && (
      /^\/projets-sites\/suisse\/(?:de|fr|it)\/(?:entreprises|particuliers)\/[a-z0-9-]+\/index\.html$/.test(path) ||
      /^\/projets-sites\/index\.html$/.test(path) ||
      /^\/projets-sites\/(?:ch|fr)\/page\/[0-9]+\/index\.html$/.test(path)
    )) {
      files[path]=hash; supportingPages++;
    }
    if (/^\/_astro\/[\w.@-]+\.(?:js|css|woff2?|png|webp|jpg|svg)$/.test(path)
      || /^\/images\/(?:journal|showcase)\/[\w./-]+\.(?:avif|webp|png|jpe?g|svg)$/.test(path)
      || path==='/territoires/donnees/catalogue.json') {
      if (files[path] && path.startsWith('/_astro/')) assert.equal(files[path],hash,'Collision de bundle '+path);
      files[path] ??= hash;
    }
  }
  assert.equal(supportingPages,8592,'Pages auxiliaires hors sitemap');
  assert.ok(files['/territoires/donnees/catalogue.json']);
  const explicit=new Set(['/sitemap.xml','/netlify.toml']);
  function add(path,bytes) {
    const hash=sha(bytes);files[path]=hash;uploads.set(hash,{path,bytes});
  }
  const translations=JSON.parse(await readFile(join(cacheDir,'translations.json'),'utf8'));
  assert.equal(translations.paths.length,new Set(translations.paths).size);
  for(const path of translations.paths) {
    assert.ok(required.has(path),'Traduction inattendue '+path);
    explicit.add(path); add(path,await readFile(join(cacheDir,'html',path)));
  }
  const members=await readdir(join(cacheDir,'xml','sitemaps'));
  assert.equal(members.length,85);
  for(const path of ['/sitemap.xml',...members.map(name=>'/sitemaps/'+name)]) {
    assert.ok(path==='/sitemap.xml'||/^\/sitemaps\/[\w-]+\.xml$/.test(path));
    add(path,await readFile(join(cacheDir,'xml',path)));
  }
  const config=await configuration(mobile,archive);
  add('/netlify.toml',config.result);
  for(const [path,hash] of Object.entries(mobile)) if (!explicit.has(path)) assert.equal(files[path],hash,path);
  const digest=digestOf(files);
  const facts={baseId,archiveId,mobileId,digest,files:Object.keys(files).length,routes:required.size,supportingPages,sitemaps:members.length,redirects:config.redirects,headers:config.headers,functions:preview.available_functions.map(f=>f.n),productionLocked:live.locked};
  await mkdir(cacheDir,{recursive:true});
  await writeFile(join(cacheDir,'expected-manifest.json'),JSON.stringify(files));
  await writeFile(join(cacheDir,'expected.json'),JSON.stringify(facts,null,2)+'\n');
  return {files,uploads,archive,mobile,preview,facts};
}
if (process.argv[1]?.endsWith('/catalogue/manifest.mjs')) {
  console.log((await prepare()).facts);
}
