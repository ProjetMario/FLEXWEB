import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {parse as parseToml} from 'smol-toml';
import {archiveId,cacheDir,filesOf,parallel,rawFile} from '../netlify.mjs';
import {parseSitemap} from '../inventory.mjs';
import {inspectHTML,readHTTP,sampleRows} from './inspect.mjs';
import {checkSupport} from './support.mjs';

const id=process.argv[2];
assert.match(id||'',/^[a-f\d]{24}$/,'Indiquer l’identifiant du déploiement Netlify à contrôler');
const certified='6af79012972137a7ad14d158';
const certRun='https://github.com/ProjetMario/FLEXWEB/actions/runs/43517431541';
const archiveMode=id===archiveId;
const host='https://'+id+'--flex-webb.netlify.app';
const digest=(bytes,algo='sha1')=>createHash(algo).update(bytes).digest('hex');
const proof=await readFile(new URL('certified-html.json',import.meta.url));
const release=await readFile(new URL('certified-release.json',import.meta.url));
assert.equal(digest(proof,'sha256'),'ef927c3e5df92261d2b623017fa8e9181f8778545c2b0e4deee4d87e8f098a7f');
assert.equal(digest(release,'sha256'),'baa5e92b57eb5c4c8ca775661083b2eccc2655e7ffd7e9960f8c658572f1859a');
const certifiedReport=JSON.parse(proof);
assert.equal(certifiedReport.status,'passed');
assert.equal(certifiedReport.htmlChecked,151503);
assert.equal(JSON.parse(release).published.id,certified);
const rows=(await readFile(join(cacheDir,'inventory.ndjson'),'utf8')).trim().split('\n').map(JSON.parse);
assert.equal(rows.length,151507);
const inventory=new Map(rows.map(row=>[row.path,row]));
assert.equal(inventory.size,rows.length);
const [certFiles,targetFiles,archiveFiles]=await Promise.all([filesOf(certified),filesOf(id),id===archiveId?null:filesOf(archiveId)]);
const archiveInventory=archiveFiles||targetFiles;
const published=rows.filter(r=>archiveInventory[r.html]);
assert.equal(published.length,151503,'Sitemap historique de référence');
const audited=archiveMode?published:rows;
const paths=new Set(audited.map(r=>r.path));

// The full CI checks apply only to a path that was in the certified sitemap and has the same bytes.
const originOf=dep=>'https://'+dep+'--flex-webb.netlify.app';
async function xml(dep,files){
  const fetchXML=async path=>{
    const res=await readHTTP(originOf(dep),path);
    assert.match(res.type,/xml/i,path);
    assert.equal(digest(res.bytes),files[path],path+' empreinte du serveur');
    return res.bytes.toString();
  };
  const children=parseSitemap(await fetchXML('/sitemap.xml'),true).map(e=>new URL(e.loc).pathname);
  assert.equal(children.length,85);
  assert.equal(new Set(children).size,85);
  const result=new Map();
  await parallel(children,6,async shard=>{
    const entries=parseSitemap(await fetchXML(shard));
    for(const {loc} of entries){
      const url=new URL(loc);
      assert.equal(url.origin,'https://flex-web.fr');
      assert.ok(!url.search&&!url.hash);
      assert.ok(!result.has(url.pathname),loc+' répété');
      result.set(url.pathname,shard);
    }
  });
  return result;
}
const [certURLs,targetURLs]=await Promise.all([xml(certified,certFiles),xml(id,targetFiles)]);
assert.equal(certURLs.size,certifiedReport.htmlChecked);
assert.equal(targetURLs.size,paths.size);
assert.deepEqual(new Set(targetURLs.keys()),paths);
for(const row of audited){
  assert.equal(targetURLs.get(row.path),row.sitemap,row.path+' sous-sitemap');
  assert.ok(targetFiles[row.html],row.path+' fichier HTML absent');
}
const rules=parseToml((await rawFile(id,'/netlify.toml')).toString());
const prefixRules=[],exact=new Set();
function addBlocking(pattern) {
  if (!pattern.includes('*')&&!pattern.includes(':')) {exact.add(pattern);return;}
  const source=pattern.split(/(\*|:[\w-]+)/).map(x=>x==='*'?'.*':x.startsWith(':')?'[^/]+':x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('');
  prefixRules.push(new RegExp('^'+source+'$'));
}
for(const rule of rules.redirects||[]) if (!Object.keys(rule.query||{}).length && (rule.force||rule.status===410)) addBlocking(rule.from);
for(const rule of rules.headers||[]){
  for(const [k,v] of Object.entries(rule.values||{})) if(k.toLowerCase()==='x-robots-tag' && /\b(noindex|none)\b/i.test(v)) addBlocking(rule.for);
}
for(const path of paths)assert.ok(!exact.has(path)&&!prefixRules.some(re=>re.test(path)),path+' règle de service restrictive');

const inherited=audited.filter(row=>certURLs.has(row.path)&&certFiles[row.html]===targetFiles[row.html]);
const certifiedSet=new Set(inherited.map(r=>r.path));
const reparse=audited.filter(r=>!certifiedSet.has(r.path));
const inspected=new Map([...sampleRows(audited), ...reparse].map(r=>[r.path,r]));
// Validate all 275 maintained pages over HTTP as well, even if the bytes still match the old artifact.
if(!archiveMode)for(const row of rows)if(row.source==='candidate')inspected.set(row.path,row);
const assets=new Set();
const verificationErrors=[];
await parallel([...inspected.values()],7,async row=>{
  try {
    const res=await readHTTP(host,row.path);
    assert.match(res.type,/text\/html/i,row.path);
    assert.equal(digest(res.bytes),targetFiles[row.html],row.path+' corps différent du fichier Netlify');
    const results=inspectHTML(res.bytes,row.path);
    for(const asset of results.assets)assets.add(asset);
  }catch(e){verificationErrors.push(row.path+' '+e.message);}
});
assert.equal(verificationErrors.length,0,JSON.stringify(verificationErrors.slice(0,12)));
for(const path of assets) assert.ok(targetFiles[path.toLowerCase()],path+' ressource référencée absente du manifeste');
const support=await checkSupport(host,targetFiles,paths);
const report={
  support,
  checkedAt:new Date().toISOString(),id,origin:host,certifiedDeployment:certified,certificationRun:certRun,
  sitemapUrls:targetURLs.size,subSitemaps:85,requiredHTML:audited.length,checkedFileDigests:audited.length,
  certifiedUnmodifiedHTML:inherited.length,changedOrNewHTMLDirectlyInspected:reparse.length,
  directHTTP200andHTMLInspections:inspected.size,routeFamilies:19,initialEntrepreneurPages:audited.filter(x=>x.path.startsWith('/entrepreneurs/')).length,
  directAssetPathsInManifest:assets.size,failed:verificationErrors.length,
  method:'Contrôle exhaustif par appartenance aux XML, fichier HTML, règles de routage et indexation. La certification H1/canonique/robots/langue du HTML historique est transposable uniquement à chemin et empreinte Netlify identiques. Chaque différence est relue en HTTP, avec un échantillon de chaque famille. Les 151 507 URL ne sont pas toutes requêtées individuellement.'
};
const dir=join(cacheDir,'audit');await mkdir(dir,{recursive:true});
await writeFile(join(dir,id+'.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
