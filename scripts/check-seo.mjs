import { readFile, readdir, access } from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
const root = path.resolve('dist');
async function walk(dir) { const entries = await readdir(dir,{withFileTypes:true}); return (await Promise.all(entries.map(e => e.isDirectory() ? walk(path.join(dir,e.name)) : path.join(dir,e.name)))).flat(); }
const files = (await walk(root)).filter(f => f.endsWith('.html'));
const origin='https://flex-web.fr';
const sitemap=await readFile(path.join(root,'sitemap.xml'),'utf8');
const urls=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
assert.equal(urls.length,new Set(urls).size,'Duplicate sitemap URL');
const redirects = new Map((await readFile(path.join(root,'_redirects'),'utf8')).split('\n').filter(l=>l.trim()&&!l.startsWith('#')).map(l=>{const [from,to,status]=l.split(/\s+/);assert.equal(status,'301');return [from,to];}));
const pages = new Map();
for (const file of files) {
 const html=await readFile(file,'utf8');
 const relative=path.relative(root,file).replaceAll(path.sep,'/');
 const route=relative==='index.html'?'/':relative.endsWith('/index.html')?'/'+relative.slice(0,-10):'/'+relative;
 pages.set(route,html);
}
const isNoindex=html=>/<meta\b[^>]*name="robots"[^>]*content="[^"]*noindex/.test(html);
const normalize=s=>s.replace(/&amp;/g,'&').replace(/&#(x[0-9a-f]+|[0-9]+);/gi,(_,n)=>String.fromCodePoint(n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n))).replace(/&quot;/g,'"');
for(const url of urls){
 const route=new URL(url).pathname;
 assert.equal(new URL(url).origin,origin);
 assert(route.endsWith('/'),`${url} canonical slash`);
 assert(pages.has(route),`Sitemap missing emitted page ${route}`);
 const html=pages.get(route);
 assert(!isNoindex(html),`Noindex included: ${route}`);
 assert.equal([...html.matchAll(/<h1(?:\s|>)/g)].length,1,`Single h1: ${route}`);
 assert.equal([...html.matchAll(/<title>/g)].length,1,`Single title: ${route}`);
 const canonical=[...html.matchAll(/<link\b[^>]*rel="canonical"[^>]*href="([^"]+)"/g)].map(m=>m[1]);
 assert.deepEqual(canonical,[url],`Canonical: ${route}`);
 assert(/<meta\b[^>]*name="description"[^>]*content="[^"]+"/.test(html),`Description: ${route}`);
 assert(!/aggregateRating|"@type"\s*:\s*"Review"/.test(html),`Unverified rating on ${route}`);
 for(const match of html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g))JSON.parse(match[1]);
}
const errors=[];
for(const [route,html] of pages){
 if(isNoindex(html)||route==='/404.html') continue;
 for(const m of html.matchAll(/<a\b[^>]*href="([^"]+)"/g)){
  const raw=normalize(m[1]);if(!raw.startsWith('/')&&!raw.startsWith(origin))continue;
  const target=new URL(raw,origin+route);if(target.origin!==origin||target.pathname.startsWith('/api/')||target.pathname.startsWith('/sites/'))continue;
  const pathname=target.pathname;
  const dest=pages.get(pathname)||pages.get(pathname.endsWith('/')?pathname:pathname+'/');
  if(!dest&&!redirects.has(pathname)) {try{await access(path.join(root,pathname));}catch{errors.push(`${route} -> ${raw}`);}}
  if(dest&&target.hash&&!dest.includes(`id="${decodeURIComponent(target.hash.slice(1))}"`)) errors.push(`${route} -> missing anchor ${raw}`);
 }
}
assert.deepEqual([...new Set(errors)],[],'Broken internal links');
for(const [from,to] of redirects){assert(pages.has(to),`Redirect target: ${to}`);assert(!redirects.has(to),`Redirect chain: ${from}`);assert(!pages.has(from),`Redirect source emitted: ${from}`);assert(!urls.includes(origin+from),`Redirect source in sitemap: ${from}`);}
for(const route of ['/automatisation-ia/','/automatisation-ia-savoie/','/automatisation-ia-haute-savoie/','/creation-site-internet/','/creation-application-mobile/','/journal/taches-automatiser-pme/','/journal/connecter-demandes-crm/','/journal/automatisation-ou-application-sur-mesure/']) assert(urls.includes(origin+route),`Priority page ${route}`);
const llms=await readFile(path.join(root,'llms.txt'),'utf8');assert.equal(llms,await readFile(path.join(root,'ai-overview.txt'),'utf8'));for(const amount of ['299 € TTC','990 € TTC','49 € TTC','99 € TTC'])assert(llms.includes(amount),amount);
console.log(JSON.stringify({pages:pages.size,sitemapUrls:urls.length,redirectRules:redirects.size,brokenLinks:0,structuredData:'valid',status:'passed'},null,2));
