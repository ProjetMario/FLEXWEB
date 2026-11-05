import assert from 'node:assert/strict';
import {readFile,access,writeFile,mkdir} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import path from 'node:path';
import {readSitemap} from './read-sitemap.mjs';
import {expectedLanguage} from './recovery-language.mjs';

const origin='https://flex-web.fr';
const root=path.resolve(process.env.RECOVERY_DIST || 'dist');
const inventory=JSON.parse(gunzipSync(await readFile('seo/inventories/published-2026-10-22-and-2026-11-05.json.gz')));
const policy=JSON.parse(await readFile('seo/inventories/exceptions.json','utf8'));
assert.equal(inventory.schemaVersion,1);assert.equal(policy.schemaVersion,1);
const exceptions=new Map();
for(const exception of policy.exceptions){
 assert(exception.path?.startsWith('/')&&exception.reason&&['redirect','retired'].includes(exception.kind),'Every exception needs a path, documented reason and treatment');
 if(exception.kind==='redirect')assert(exception.target?.startsWith('/'),'Redirect exception must name its target');
 assert(!exceptions.has(exception.path),'Duplicate exception');exceptions.set(exception.path,exception);
}
const index=await readFile(path.join(root,'sitemap.xml'),'utf8');
const children=[...index.matchAll(/<loc>([^<]+)<\/loc>/g)].map(x=>new URL(x[1]).pathname);
const childrenSet=new Set(children);
assert.equal(childrenSet.size,children.length,'Duplicate sitemap children');
for(const child of inventory.current.sitemaps)assert(childrenSet.has(child),`Missing previously published sitemap: ${child}`);
const urls=await readSitemap(origin+'/sitemap.xml',url=>readFile(path.join(root,new URL(url).pathname),'utf8'));
const routes=urls.map(u=>{const url=new URL(u);assert.equal(url.origin,origin);assert(!url.search&&!url.hash);return url.pathname;});
const actual=new Set(routes);assert.equal(actual.size,routes.length,'Duplicate public sitemap URL');
const expected=new Set([...inventory.historical.paths,...inventory.current.paths]);
for(const [route] of exceptions)assert(expected.has(route),`Exception not in published inventory: ${route}`);
const missing=[...expected].filter(route=>!actual.has(route)&&!exceptions.has(route));
assert.equal(missing.length,0,`Published routes missing from sitemap: ${missing.slice(0,20).join(', ')} (${missing.length} total)`);
for(const [route] of exceptions)assert(!actual.has(route),`Noncanonical exception present in sitemap: ${route}`);
const historic=new Set(inventory.historical.paths),current=new Set(inventory.current.paths);
const failures=[];let checked=0,schemaCount=0;
const fail=(route,reason)=>{if(failures.length<50)failures.push(`${route}: ${reason}`);};
async function check(route){
 try{
  assert(!/^\/(?:api|admin|espace-projet|demarrer)(?:\/|$)/.test(route),'private or API route in sitemap');
  const file=path.join(root,route,'index.html');const html=await readFile(file,'utf8');
  assert(/<html\b/i.test(html)&&/<\/html>/i.test(html),'incomplete HTML');
  const language=html.match(/<html\b[^>]*\blang=["']([^"']+)["']/i)?.[1];
  assert.equal(language,expectedLanguage(route),'HTML language');
  assert.equal([...html.matchAll(/<h1(?:\s|>)/gi)].length,1,'single H1');
  assert.equal([...html.matchAll(/<title\b[^>]*>[\s\S]*?<\/title>/gi)].length,1,'title');
  assert(/<meta\b(?=[^>]*\bname=["']description["'])(?=[^>]*\bcontent=["'][^"']+)[^>]*>/i.test(html),'meta description');
  const canonicals=[...html.matchAll(/<link\b(?=[^>]*\brel=["']canonical["'])(?=[^>]*\bhref=["']([^"']+)["'])[^>]*>/gi)].map(m=>m[1]);
  assert.deepEqual(canonicals,[origin+route],'self canonical');
  const robots=html.match(/<meta\b(?=[^>]*\bname=["']robots["'])(?=[^>]*\bcontent=["']([^"']+)["'])[^>]*>/i)?.[1];
  assert(robots&&!/\bnoindex\b/i.test(robots),'indexable robots');
  const schemas=[...html.matchAll(/<script\b(?=[^>]*\btype=["']application\/ld\+json["'])[^>]*>([\s\S]*?)<\/script>/gi)];
  assert(schemas.length>0,'structured data');
  for(const schema of schemas){const data=JSON.parse(schema[1]);assert(data&&typeof data==='object','structured data object');schemaCount++;}
  checked++;
 }catch(error){fail(route,error.message);}
}
let next=0;const worker=async()=>{while(next<routes.length){const route=routes[next++];await check(route);}};
await Promise.all(Array.from({length:24},worker));
assert.equal(failures.length,0,`HTML validation failures: ${failures.join('; ')}`);
const report={status:'passed',currentPagesPreserved:inventory.current.paths.filter(p=>actual.has(p)).length,historicalPagesRestored:inventory.historical.paths.filter(p=>!current.has(p)&&actual.has(p)).length,historicalPagesAlreadyPresent:inventory.historical.paths.filter(p=>current.has(p)).length,exceptions:policy.exceptions,expectedDistinct:expected.size,sitemapUrls:routes.length,newBeyondInventory:routes.filter(p=>!expected.has(p)).length,sitemapChildren:children.length,htmlChecked:checked,structuredDataBlocks:schemaCount};
await mkdir('.cms',{recursive:true});await writeFile('.cms/recovered-inventory-validation.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
