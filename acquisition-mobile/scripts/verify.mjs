import assert from 'node:assert/strict';
import {parse} from 'parse5';
import {pages,locations,origin} from './assemble.mjs';
import {baseline,filePath,get,linkPages,output,sha,baseUrl} from './baseline.mjs';

const destination = process.argv[2]?.replace(/\/$/,'');
const attrs = el => Object.fromEntries((el.attrs || []).map(a=>[a.name,a.value]));
function elements(node,name) {
  return [...(node.tagName === name ? [node] : []), ...(node.childNodes || []).flatMap(child=>elements(child,name))];
}
async function bytes(route,subdir=output) {
  if (!destination) return get(subdir,filePath(route));
  const res = await fetch(destination + route,{redirect:'manual', signal:AbortSignal.timeout(25000)});
  assert.equal(res.status, 200, route + ' statut HTTP');
  return Buffer.from(await res.arrayBuffer());
}
async function batch(arr,fn,limit=5) {
  let next=0;
  await Promise.all(Array.from({length:Math.min(arr.length,limit)},async()=>{
    while (next<arr.length) await fn(arr[next++]);
  }));
}
const routes = new Set(), titles = new Set(), descriptions = new Set();
const markupText = node => node.value ?? (node.childNodes || []).map(markupText).join('');
const publicXML = (await bytes('/sitemap.xml')).toString();
const old = locations((await get(baseline,'/sitemap.xml')).toString());
const urlList = locations(publicXML);
const inventory = new Set(urlList);
assert.equal(urlList.length,inventory.size);
assert.deepEqual(inventory,new Set([...old,...pages.map(p=>origin+p.path)]));
await batch(pages,async p=>{
  const html=(await bytes(p.path)).toString();
  const doc=parse(html);
  assert.equal(attrs(elements(doc,'html')[0]).lang,p.lang,p.path);
  assert.equal(elements(doc,'h1').length,1,p.path);
  assert.ok(markupText(elements(doc,'h1')[0]).trim(),p.path);
  const title=markupText(elements(doc,'title')[0]).trim();
  const meta=elements(doc,'meta').map(attrs);
  const desc=meta.find(m=>m.name==='description')?.content;
  assert.ok(title && !titles.has(title),p.path+' titre'); titles.add(title);
  assert.ok(desc && !descriptions.has(desc),p.path+' description'); descriptions.add(desc);
  assert.ok(!meta.some(m=>['robots','googlebot','bingbot'].includes(m.name) && /\bnoindex\b/i.test(m.content)),p.path);
  const links=elements(doc,'link').map(attrs);
  assert.deepEqual(links.filter(l=>l.rel==='canonical').map(l=>l.href),[origin+p.path],p.path);
  for (const [lang,path] of Object.entries(p.alternates || {})) {
    assert.ok(links.some(l=>l.hreflang===lang && l.href===origin+path),p.path+' '+lang);
  }
  const graph=elements(doc,'script').filter(e=>attrs(e).type==='application/ld+json')
    .map(e=>JSON.parse(markupText(e))).flatMap(o=>o['@graph']||o);
  const types = graph.map(o=>o['@type']).flat();
  for (const req of ['WebPage','BreadcrumbList',p.kind||'Article']) assert.ok(types.includes(req),p.path+' '+req);
  if (p.id) {
    const faq = graph.find(n=>n['@type']==='FAQPage');
    assert.ok(faq?.mainEntity?.length,p.path+' FAQ');
    const bodyText = markupText(elements(doc,'body')[0]).replace(/\s+/g,' ');
    for (const q of faq.mainEntity) assert.ok(bodyText.includes(q.name) && bodyText.includes(q.acceptedAnswer.text),p.path+' FAQ visible');
  }
  for (const tag of ['a','img','script','link','astro-island']) for (const el of elements(doc,tag)) {
    const a=attrs(el);
    for (const target of [a.href,a.src,a['component-url'],a['renderer-url']]) if (target?.startsWith('/') && !target.startsWith('//')) routes.add(new URL(target,origin).pathname);
  }
});
for (const route of linkPages) {
  const page=(await bytes(route)).toString();
  assert.ok(page.includes('id="mobile-project-resources"'),route);
}
if (destination) {
  // Check every sitemap route as well as navigational links and critical assets.
  const queue=new Set([...routes,...urlList.map(u=>new URL(u).pathname)]);
  await batch([...queue],async path=>{
    const res=await fetch(destination+path,{redirect:'manual',method:'HEAD',signal:AbortSignal.timeout(25000)});
    assert.equal(res.status,200,path);
  },6);
  for (const path of ['/','/en/','/robots.txt']){
    const live=await fetch(baseUrl+path);
    assert.equal(live.status,200);
    assert.equal(sha(await bytes(path)),sha(Buffer.from(await live.arrayBuffer())),path+' différent');
  }
  console.log(queue.size+' destinations HTTP répondent 200 ; accueil FR/EN et robots identiques octet pour octet.');
}
console.log(pages.length+' pages mobiles et '+linkPages.length+' pages de liens vérifiées ; sitemap '+old.length+' → '+inventory.size+'.');
