import {readSitemap} from './seo/read-sitemap.mjs';
import { readFile, readdir, access } from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
const root = path.resolve('dist');
async function walk(dir) { const entries = await readdir(dir,{withFileTypes:true}); return (await Promise.all(entries.map(e => e.isDirectory() ? walk(path.join(dir,e.name)) : path.join(dir,e.name)))).flat(); }
const files = (await walk(root)).filter(f => f.endsWith('.html'));
const origin='https://flex-web.fr';
const urls=await readSitemap(origin+'/sitemap.xml',url=>readFile(path.join(root,new URL(url).pathname),'utf8'));
assert.equal(urls.length,new Set(urls).size,'Duplicate sitemap URL');
const sitemapRoutes=new Set();
for(const url of urls){const parsed=new URL(url);assert.equal(parsed.origin,origin);assert(parsed.pathname.endsWith('/'),`${url} canonical slash`);sitemapRoutes.add(parsed.pathname);}
const redirects = new Map((await readFile(path.join(root,'_redirects'),'utf8')).split('\n').filter(l=>l.trim()&&!l.startsWith('#')).map(l=>{const [from,to,status]=l.split(/\s+/);assert.equal(status,'301');return [from,to];}));
const isNoindex=html=>/<meta\b[^>]*name="robots"[^>]*content="[^"]*noindex/.test(html);
const normalize=s=>s.replace(/&amp;/g,'&').replace(/&#(x[0-9a-f]+|[0-9]+);/gi,(_,n)=>String.fromCodePoint(n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n))).replace(/&quot;/g,'"');
// V8 can represent regex captures as slices backed by the entire input string.
// A no-op replace does not detach them. Copy every retained HTML-derived value
// so one small anchor cannot keep a complete territorial document alive.
const detached=value=>Buffer.from(value,'utf8').toString('utf8');
// Retain only graph/anchor metadata, not 20,000 complete HTML bodies. Identical
// targets are interned across pages. Every sitemap document is still audited.
const pages = new Map(),targets=new Map();
let peakRss=process.memoryUsage().rss;
for (const file of files) {
 const html=await readFile(file,'utf8');
 const relative=path.relative(root,file).replaceAll(path.sep,'/');
 const route=relative==='index.html'?'/':relative.endsWith('/index.html')?'/'+relative.slice(0,-10):'/'+relative;
 const noindex=isNoindex(html),anchors=new Set([...html.matchAll(/\bid="([^"]*)"/g)].map(m=>detached(normalize(m[1])))),links=new Map();
 if(sitemapRoutes.has(route)){
  assert(!noindex,`Noindex included: ${route}`);
  assert.equal([...html.matchAll(/<h1(?:\s|>)/g)].length,1,`Single h1: ${route}`);
  assert.equal([...html.matchAll(/<title>/g)].length,1,`Single title: ${route}`);
  const canonical=[...html.matchAll(/<link\b[^>]*rel="canonical"[^>]*href="([^"]+)"/g)].map(m=>m[1]);
  assert.deepEqual(canonical,[origin+route],`Canonical: ${route}`);
  assert(/<meta\b[^>]*name="description"[^>]*content="[^"]+"/.test(html),`Description: ${route}`);
  assert(!/aggregateRating|"@type"\s*:\s*"Review"/.test(html),`Unverified rating on ${route}`);
  for(const match of html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g))JSON.parse(match[1]);
 }
 if(!noindex&&route!=='/404.html')for(const match of html.matchAll(/<a\b([^>]*?)href="([^"]+)"([^>]*)>/g)){
  const target=new URL(normalize(match[2]),origin+route);if(target.origin!==origin)continue;
  const key=detached(target.pathname+target.hash);
  if(!targets.has(key))targets.set(key,{pathname:detached(target.pathname),hash:detached(target.hash)});
  const follow=!/\brel="[^"]*\bnofollow\b/.test(match[1]+match[3]);
  links.set(key,follow||links.get(key)===true);
 }
 assert(!pages.has(route),`Duplicate emitted route ${route}`);
 pages.set(route,{noindex,anchors,links});
 peakRss=Math.max(peakRss,process.memoryUsage().rss);
}
for(const route of sitemapRoutes)assert(pages.has(route),`Sitemap missing emitted page ${route}`);
const errors=[];
const assetExists=new Map();
for(const [route,page] of pages){
 if(page.noindex||route==='/404.html') continue;
 for(const raw of page.links.keys()){
  const target=targets.get(raw);if(target.pathname.startsWith('/api/')||target.pathname.startsWith('/sites/'))continue;
  const pathname=target.pathname;
  const dest=pages.get(pathname)||pages.get(pathname.endsWith('/')?pathname:pathname+'/');
  if(!dest&&!redirects.has(pathname)) {
   if(!assetExists.has(pathname)){try{await access(path.join(root,pathname));assetExists.set(pathname,true);}catch{assetExists.set(pathname,false);}}
   if(!assetExists.get(pathname))errors.push(`${route} -> ${raw}`);
  }
  if(dest&&target.hash&&!dest.anchors.has(decodeURIComponent(target.hash.slice(1)))) errors.push(`${route} -> missing anchor ${raw}`);
 }
}
assert.deepEqual([...new Set(errors)],[],'Broken internal links');
// A sitemap alone must not be the only way to discover a public page. Follow
// emitted HTML links from the homepage, including canonical slash redirects.
const adjacency=new Map();
for(const [route,page] of pages){
 if(page.noindex||route==='/404.html')continue;
 const links=new Set();
 for(const [key,follow] of page.links){
  if(!follow)continue;
  const target=targets.get(key);
  let destination=redirects.get(target.pathname)??target.pathname;
  if(!pages.has(destination)&&pages.has(destination+'/'))destination+='/';
  if(pages.has(destination)&&!pages.get(destination).noindex)links.add(destination);
 }
 adjacency.set(route,links);
}
const reached=new Set(['/']);
const queue=['/'];
for(let index=0;index<queue.length;index++){
 for(const destination of adjacency.get(queue[index])??[]){
  if(!reached.has(destination)){reached.add(destination);queue.push(destination);}
 }
}
const unreachable=urls.map(url=>new URL(url).pathname).filter(route=>!reached.has(route));
assert.deepEqual(unreachable,[],'Sitemap pages unreachable through HTML links from the homepage');
for(const [from,to] of redirects){assert(pages.has(to),`Redirect target: ${to}`);assert(!redirects.has(to),`Redirect chain: ${from}`);assert(!pages.has(from),`Redirect source emitted: ${from}`);assert(!urls.includes(origin+from),`Redirect source in sitemap: ${from}`);}
for(const route of ['/automatisation-ia/','/automatisation-ia-savoie/','/automatisation-ia-haute-savoie/','/creation-site-internet/','/creation-application-mobile/','/journal/taches-automatiser-pme/','/journal/connecter-demandes-crm/','/journal/automatisation-ou-application-sur-mesure/']) assert(urls.includes(origin+route),`Priority page ${route}`);
const llms=await readFile(path.join(root,'llms.txt'),'utf8');assert.equal(llms,await readFile(path.join(root,'ai-overview.txt'),'utf8'));for(const amount of ['299 € TTC','590 € TTC','990 € TTC','49 € TTC','99 € TTC'])assert(llms.includes(amount),amount);
console.log(JSON.stringify({pages:pages.size,sitemapUrls:urls.length,reachableSitemapUrls:urls.length-unreachable.length,redirectRules:redirects.size,brokenLinks:0,structuredData:'valid',peakRssBytes:Math.max(peakRss,process.memoryUsage().rss),status:'passed'},null,2));
