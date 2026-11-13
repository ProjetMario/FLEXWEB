import assert from 'node:assert/strict';
import { readFile, writeFile, access } from 'node:fs/promises';
import { parse } from 'parse5';
import { readSitemap } from '../seo/read-sitemap.mjs';
import { tsImport } from 'tsx/esm/api';

const { editorialDates } = await tsImport('../../src/data/geo/editorial-dates.ts', import.meta.url);

const origin = 'https://flex-web.fr';
const newPaths = ['/creation-site-internet-pas-cher/', '/francophonie/', '/en/affordable-websites/', '/en/french-speaking-clients/'];
const changedPaths = [...newPaths, '/creation-site-internet/', '/creation-application-mobile/', '/automatisation-ia/', '/crm-automatisation-entreprise/', '/pricing/', '/about/', '/contact/', '/en/websites/', '/en/applications/', '/en/ai-automation/', '/en/crm/', '/en/pricing/', '/en/about/', '/en/contact/', '/realisations/', '/realisations/foot-nation/', '/realisations/2savoie-immo/', '/realisations/serrurier73/'];
const attrs = (node, name) => node.attrs?.find(a=>a.name===name)?.value;
const nodes = node => [node,...(node.childNodes || []).flatMap(nodes)];
const text = node => ['script','style'].includes(node.tagName) ? '' : node.nodeName === '#text' ? node.value : (node.childNodes||[]).map(text).join(' ');
const norm = value => value.replace(/\s+/g,' ').trim();
const titles = new Set(), descriptions = new Set();
let checkedLinks = 0;
for (const route of changedPaths) {
  const all = nodes(parse(await readFile(`dist${route}index.html`,'utf8')));
  const main = all.find(n=>n.tagName==='main');
  const title = norm(text(all.find(n=>n.tagName==='title')));
  const description = attrs(all.find(n=>n.tagName==='meta'&&attrs(n,'name')==='description'),'content');
  assert.equal(all.filter(n=>n.tagName==='h1').length,1,route);
  assert(!titles.has(title),`Duplicate title: ${route}`); titles.add(title);
  assert(description && !descriptions.has(description),`Duplicate or missing description: ${route}`); descriptions.add(description);
  assert.equal(attrs(all.find(n=>n.tagName==='link'&&attrs(n,'rel')==='canonical'),'href'),origin+route);
  assert(!/noindex/.test(attrs(all.find(n=>n.tagName==='meta'&&attrs(n,'name')==='robots'),'content')||''),route);
  const visible = norm(text(main));
  assert.doesNotMatch(visible,/Témoignage client à ajouter|Résultats chiffrés à confirmer|Deux fiches seront publiées/);
  const schemas=all.filter(n=>n.tagName==='script'&&attrs(n,'type')==='application/ld+json').flatMap(n=>{const data=JSON.parse(n.childNodes.map(c=>c.value||'').join(''));return data['@graph']||[data];});
  for(const schema of schemas.filter(s=>s['@type']==='FAQPage'))for(const q of schema.mainEntity){assert(visible.includes(norm(q.name)),route+': visible FAQ question');assert(visible.includes(norm(q.acceptedAnswer.text)),route+': visible FAQ answer');}
  for(const schema of schemas.filter(s=>s.dateModified))assert.equal(schema.dateModified,editorialDates[route] ?? '2026-11-03',route+': reviewed date');
  for(const link of nodes(main).filter(n=>n.tagName==='a'&&attrs(n,'href'))){
    const target = new URL(attrs(link,'href'),origin+route);
    if(target.origin !== origin)continue;
    await access(`dist${target.pathname}index.html`).catch(()=>assert.fail(`${route}: missing target ${target.pathname}`));
    checkedLinks++;
  }
}
const sitemap = await readFile('dist/sitemap.xml','utf8');
const children = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
assert(children.length>0,'Sitemap index must contain children');
const urls = await readSitemap(origin+'/sitemap.xml',url=>readFile('dist'+new URL(url).pathname,'utf8'));
const baseline=JSON.parse(await readFile('.cms/geo-baseline.json','utf8'));
const urlSet=new Set(urls),baselineSet=new Set(baseline);
assert.deepEqual(baseline.filter(url=>!urlSet.has(url)),[],'Published URLs must remain');
const additions=urls.filter(url=>!baselineSet.has(url));
for(const route of newPaths)assert(urlSet.has(origin+route),`Priority route missing: ${route}`);
const full=await readFile('dist/llms-full.txt','utf8');
for(const route of [...newPaths,'/applications/ios/','/applications/android/','/de/anwendungen/windows/','/it/applicazioni/macos/'])assert(full.includes(origin+route),'Full summary missing '+route);
assert(full.includes('Language: de') && full.includes('Language: it'));
assert.doesNotMatch(full,/\bundefined\b/);
const report={status:'passed',newPages:newPaths,validatedPages:changedPaths.length,checkedInternalLinks:checkedLinks,childSitemaps:children.length,uniqueUrls:urls.length,preservedUrls:baseline.length,addedUrls:additions.length};
await writeFile('.cms/geo-budget-validation.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
