import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';
import sax from 'sax';

const project = fileURLToPath(new URL('../../', import.meta.url));
const origin = 'https://flex-web.fr';
const ns = 'http://www.sitemaps.org/schemas/sitemap/0.9';
export const archiveOrigin = 'https://6af791098269e8f08591ce03--flex-webb.netlify.app';
export const productionOrigin = 'https://6b0452114b315390275a0f53--flex-webb.netlify.app';
export const candidateOrigin = 'https://6b0485a09cae4d4dbe96caf4--flex-webb.netlify.app';
export const defaultDirectory = join(project, 'acquisition-mobile/.release/catalogue');
const additions = new Map([
  ['/applications/suisse-romande/', '/sitemaps/principal-1.xml'],
  ['/applications/belgique-francophone/', '/sitemaps/principal-1.xml'],
  ['/realisations/footnation/', '/sitemaps/principal-1.xml'],
  ['/en/case-studies/footnation/', '/sitemaps/english-1.xml'],
]);
const digest = text => createHash('sha256').update(text).digest('hex');

function canonicalPath(loc, index) {
  const url = new URL(loc);
  assert.equal(loc, origin + url.pathname, 'URL non canonique dans le sitemap : ' + loc);
  const pattern = index ? /^\/sitemaps\/[a-z0-9-]+-\d+\.xml$/ : /^\/(?:[a-z0-9-]+\/)*$/;
  assert.match(url.pathname,pattern);
  return url.pathname;
}

// The sources use only the standard sitemap vocabulary. Reject unknown metadata
// rather than discarding it if a future archive starts using XML extensions.
export function parseSitemap(xml, index=false) {
  assert.ok(Buffer.byteLength(xml) <= 50 * 1024 * 1024);
  const root = index ? 'sitemapindex' : 'urlset';
  const tag = index ? 'sitemap' : 'url';
  const fields = index ? ['loc','lastmod'] : ['loc','lastmod','priority','changefreq'];
  const parser = sax.parser(true,{xmlns:true});
  const stack = [], entries = [];
  let fieldText = '', entry;
  parser.ondoctype = () => { throw new Error('DOCTYPE inattendu'); };
  parser.onopentag = node => {
    assert.equal(node.uri,ns);
    if (stack.length===0) assert.equal(node.local,root);
    else if (stack.length===1) {
      assert.equal(node.local,tag);
      entry={};
    } else {
      assert.ok(stack.length===2 && fields.includes(node.local), 'Élément XML inattendu : '+node.local);
      assert.ok(!Object.hasOwn(entry,node.local), 'Champ XML répété');
      fieldText='';
    }
    stack.push(node.local);
  };
  parser.ontext = text => {
    if(stack.length===3) fieldText+=text;
    else assert.ok(!text.trim(), 'Texte XML hors champ');
  };
  parser.oncdata=parser.ontext;
  parser.onclosetag = () => {
    const field=stack.pop();
    if (stack.length===2) entry[field]=fieldText.trim();
    if (stack.length===1) {
      assert.ok(entry.loc);
      canonicalPath(entry.loc,index);
      if (entry.lastmod) assert.match(entry.lastmod,/^\d{4}-\d\d-\d\d(?:T\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d))?$/);
      entries.push(entry);
    }
  };
  parser.write(xml).close();
  assert.ok(entries.length>0 && entries.length<=50_000);
  assert.equal(new Set(entries.map(e=>e.loc)).size,entries.length,'Doublon dans le fichier XML');
  return entries;
}

async function fetchXML(base, path) {
  let lastError;
  for(let attempt=0;attempt<4;attempt++){
    try {
      const response=await fetch(base+path,{redirect:'error',signal:AbortSignal.timeout(45_000)});
      if (!response.ok) {
        if (response.status!==429 && response.status<500) throw new TypeError('HTTP '+response.status+' '+path);
        throw new Error('HTTP '+response.status+' '+path);
      }
      return await response.text();
    } catch(error){
      if (error instanceof TypeError && error.message.startsWith('HTTP ')) throw error;
      lastError=error;
      if(attempt<3) await new Promise(resolve=>setTimeout(resolve,1000*2**attempt));
    }
  }
  throw lastError;
}

const xmlEscape = value=> value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
function serialize(entries,index=false){
  const tag=index?'sitemap':'url', root=index?'sitemapindex':'urlset';
  const rows=entries.map(entry=>'<'+tag+'>'+Object.entries(entry).map(([k,v])=>'<'+k+'>'+xmlEscape(v)+'</'+k+'>').join('')+'</'+tag+'>');
  return '<?xml version="1.0" encoding="UTF-8"?><'+root+' xmlns="'+ns+'">'+rows.join('')+'</'+root+'>\n';
}

function sameEntry(old,next){
  return ['loc','lastmod','priority','changefreq'].every(field=>old[field]===next[field]);
}
export function mergeShard(archive,candidate,extras=[]) {
  let changed=false;
  const entries=archive.map(old=>{
    const replacement=candidate.get(old.loc);
    if(!replacement || sameEntry(old,replacement)) return old;
    changed=true;
    return replacement;
  });
  entries.push(...extras);
  return {entries,changed:changed || extras.length>0};
}
async function put(file,content) {
  await mkdir(dirname(file),{recursive:true});
  const temporary=file+'.'+process.pid+'.tmp';
  await writeFile(temporary,content);
  await rename(temporary,file);
}

export async function buildInventory(options={}) {
  const directory=options.directory || defaultDirectory;
  const archive=options.archiveOrigin || archiveOrigin;
  const candidate=options.candidateOrigin || candidateOrigin;
  const production=options.productionOrigin || productionOrigin;
  const [indexXML,candidateXML,productionXML,archiveRecord]=await Promise.all([
    fetchXML(archive,'/sitemap.xml'),fetchXML(candidate,'/sitemap.xml'),fetchXML(production,'/sitemap.xml'),
    readFile(join(project,'seo/inventories/published-2026-10-22-and-2026-11-05.json.gz')),
  ]);
  const children=parseSitemap(indexXML,true);
  assert.equal(children.length,85);
  const candidateEntries=new Map(parseSitemap(candidateXML).map(entry=>[entry.loc,entry]));
  const productionEntries=parseSitemap(productionXML);
  assert.equal(candidateEntries.size,275);
  assert.equal(productionEntries.length,258);
  for(const {loc} of productionEntries) assert.ok(candidateEntries.has(loc),'Page publique absente de l’aperçu : '+loc);
  const reference=JSON.parse(gunzipSync(archiveRecord));
  const historicPaths=new Set([...reference.historical.paths,...reference.current.paths]);
  assert.equal(historicPaths.size,151473);

  const archived=new Set(), rows=[], xmlFiles={}, families={}, changedChildren=new Set();
  // Small batches bound memory, requests and writes. Keep shard order stable.
  for(let i=0;i<children.length;i+=5){
    const paths=children.slice(i,i+5).map(c=>canonicalPath(c.loc,true));
    const documents=await Promise.all(paths.map(path=>fetchXML(archive,path)));
    for(const [j,path] of paths.entries()){
      const xml=documents[j], original=parseSitemap(xml);
      for(const {loc} of original){
        assert.ok(!archived.has(loc),'URL dans deux sous-sitemaps : '+loc);
        archived.add(loc);
      }
      const extras=[...additions].filter(([,child])=>child===path).map(([route])=>{
        const value=candidateEntries.get(origin+route);
        assert.ok(value,'Nouvelle URL absente du candidat : '+route);
        return value;
      });
      const {entries,changed}=mergeShard(original,candidateEntries,extras);
      const result=changed?serialize(entries):xml;
      if (changed) {
        assert.deepEqual(parseSitemap(result),entries);
        changedChildren.add(path);
      }
      xmlFiles[path]=digest(result);
      const family=path.replace('/sitemaps/','').replace(/-\d+\.xml$/,'');
      families[family]=(families[family]||0)+entries.length;
      for(const entry of entries){
        const route=canonicalPath(entry.loc,false);
        rows.push({path:route,html:route+'index.html',sitemap:path,source:candidateEntries.has(entry.loc)?'candidate':'archive',lastmod:entry.lastmod||null});
      }
      await put(join(directory,'xml',path),result);
    }
  }
  assert.equal(archived.size,151503);
  for(const route of historicPaths) assert.ok(archived.has(origin+route),'URL historique absente : '+route);
  for(const entry of productionEntries) assert.ok(archived.has(entry.loc),'Nouvelle URL publique hors hypothèse');
  const entrepreneur=[...archived].filter(loc=>!historicPaths.has(new URL(loc).pathname));
  assert.equal(entrepreneur.length,30);
  assert.ok(entrepreneur.every(loc=>loc.startsWith(origin+'/entrepreneurs/')));
  const candidateOnly=[...candidateEntries.keys()].filter(loc=>!archived.has(loc)).map(loc=>new URL(loc).pathname).sort();
  assert.deepEqual(candidateOnly,[...additions.keys()].sort());
  assert.equal(new Set(rows.map(r=>r.path)).size,rows.length,'Doublon fusionné');
  assert.equal(rows.length,151507);
  assert.equal(rows.filter(r=>r.source==='candidate').length,275);
  // If a source index supplies lastmod for a changed shard, omit it: the
  // release date of the new sitemap itself is not established during build.
  let finalIndex=indexXML;
  if(children.some(c=>c.lastmod && changedChildren.has(new URL(c.loc).pathname))){
    finalIndex=serialize(children.map(c=>changedChildren.has(new URL(c.loc).pathname)?{loc:c.loc}:c),true);
  }
  assert.deepEqual(parseSitemap(finalIndex,true).map(c=>c.loc),children.map(c=>c.loc));
  xmlFiles['/sitemap.xml']=digest(finalIndex);
  const inventoryText=rows.map(row=>JSON.stringify(row)).join('\n')+'\n';
  const summary={archive,candidate,production,archivePages:archived.size,productionPages:productionEntries.length,candidatePages:candidateEntries.size,
    retainedFromCandidate:275,restoredFromArchive:rows.length-275,total:rows.length,children:children.length,
    families,archiveAdditions:candidateOnly,entrepreneurPages:entrepreneur.length,changedShards:[...changedChildren],xmlSha256:xmlFiles,
    inventorySha256:digest(inventoryText),routeSetSha256:digest(rows.map(row=>row.path).sort().join('\n')+'\n')};
  await put(join(directory,'xml/sitemap.xml'),finalIndex);
  await put(join(directory,'inventory.ndjson'),inventoryText);
  await put(join(directory,'inventory-summary.json'),JSON.stringify(summary,null,2)+'\n');
  return summary;
}
if(process.argv[1] && pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
  const summary=await buildInventory();
  console.log(summary.total+' URL, '+summary.children+' sous-sitemaps, '+summary.restoredFromArchive+' restaurations, '+summary.retainedFromCandidate+' pages du candidat.');
}
