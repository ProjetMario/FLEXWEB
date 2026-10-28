import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import path from 'node:path';
import {parse} from 'parse5';
import {readSitemap} from './read-sitemap.mjs';
import {candidates,directoryGroups,directoryPath,candidatePath,expansionEnabled} from '../../src/lib/seo-expansion/fr-ch.mjs';
if(!expansionEnabled())throw Error('Build the draft with FLEXWEB_FR_CH_EXPANSION=1');
const root=path.resolve('dist'),all=candidates(),groups=directoryGroups();
assert.equal(all.length,30000);
assert.equal(new Set(all.map(x=>x.path)).size,30000);
assert.equal(groups.reduce((sum,g)=>sum+g.items.length,0),15000);
const titles=new Set(),descriptions=new Set();
const sampleIndexes=new Set([0,1,12889,12890,14999,15000,15001,27889,27890,29999]);
for(let i=0;i<all.length;i++){
 const {path:route,audience,location}=all[i];
 const html=await readFile(path.join(root,route,'index.html'),'utf8');
 assert.match(html,/<meta\b[^>]*name="robots"[^>]*content="[^"]*noindex/,route);
 assert.equal([...html.matchAll(/<h1(?:\s|>)/g)].length,1,route);
 const title=html.match(/<title>([\s\S]*?)<\/title>/)?.[1];
 const description=html.match(/<meta\b[^>]*name="description"[^>]*content="([^"]+)"/)?.[1];
 assert(title&&!titles.has(title),`${route}: duplicate title`);titles.add(title);
 assert(description&&!descriptions.has(description),`${route}: duplicate description`);descriptions.add(description);
 assert(html.includes(`<link rel="canonical" href="https://flex-web.fr${route}"`),route);
 assert(html.includes(`Code ${location.country==='CH'?'OFS':'INSEE'} : ${location.code}`),route);
 assert(html.includes('Cette fiche ne revendique pas de bureau ni de client dans la commune'),route);
 if(audience==='particuliers'||location.country==='CH')assert(html.includes('mailto:contact@flex-web.fr'),`${route}: direct contact`);
 else assert(html.includes('/demarrer/?service=site'),`${route}: professional quote`);
 if(sampleIndexes.has(i)){
  const walk=n=>[n,...(n.childNodes||[]).flatMap(walk)], attr=(n,k)=>n.attrs?.find(a=>a.name===k)?.value;
  const nodes=walk(parse(html));
  const data=nodes.filter(n=>n.tagName==='script'&&attr(n,'type')==='application/ld+json').flatMap(n=>{const v=JSON.parse(n.childNodes.map(x=>x.value||'').join(''));return v['@graph']||[v];});
  const faq=data.find(v=>v['@type']==='FAQPage');assert(faq&&faq.mainEntity.length>=3,route);
  const main=nodes.find(n=>n.tagName==='main');const text=n=>n.nodeName==='#text'?n.value:(n.childNodes||[]).map(text).join(' ');const content=text(main).replace(/\s+/g,' ');
  for(const question of faq.mainEntity){assert(content.includes(question.name),route);assert(content.includes(question.acceptedAnswer.text),route);}
 }
}
await access(path.join(root,'projets-sites/index.html'));
for(const group of groups){
 const html=await readFile(path.join(root,directoryPath(group.country,group.page),'index.html'),'utf8');
 assert.match(html,/name="robots"[^>]*content="[^"]*noindex/);
 for(const location of group.items)for(const audience of ['particuliers','entreprises'])assert(html.includes(candidatePath(audience,location)),location.slug);
}
const urls=await readSitemap('https://flex-web.fr/sitemap.xml',url=>readFile(path.join(root,new URL(url).pathname),'utf8'));assert(!urls.some(url=>new URL(url).pathname.startsWith('/projets-sites/')));
console.log(JSON.stringify({status:'passed',draftPages:all.length,directoryPages:groups.length+1,checkedHtml:all.length,uniqueTitles:titles.size,uniqueDescriptions:descriptions.size,structuredDataSamples:sampleIndexes.size,indexation:'noindex',sitemap:'excluded'}));
