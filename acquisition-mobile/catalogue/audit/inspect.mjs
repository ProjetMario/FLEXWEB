import assert from 'node:assert/strict';
import {parse} from 'parse5';
import {expectedLanguage} from '../../../scripts/seo/recovery-language.mjs';
import {setTimeout as sleep} from 'node:timers/promises';

const canonicalOrigin='https://flex-web.fr';
const isAsset=path=>/\.(?:avif|css|eot|gif|ico|jpeg|jpg|js|json|mjs|mp4|otf|png|svg|ttf|webmanifest|webm|webp|woff2?)$/i.test(path);
const attributes = (node) => Object.fromEntries((node.attrs||[]).map(a=>[a.name,a.value]));
const attempts=4;
export async function readHTTP(origin,path){
  for(let i=0;i<attempts;i++){
    try {
      const res=await fetch(origin+path,{redirect:'manual',signal:AbortSignal.timeout(40000)});
      if ([429,502,503,504].includes(res.status) && i<attempts-1) {
        await res.body?.cancel();
        await sleep(700*(2**i));
        continue;
      }
      assert.equal(res.status,200,path+' statut HTTP '+res.status);
      return {bytes:Buffer.from(await res.arrayBuffer()),type:res.headers.get('content-type')||'',robots:res.headers.get('x-robots-tag')||''};
    } catch(e) {
      if (e.code==='ERR_ASSERTION'|| i===attempts-1) throw e;
      await sleep(700*(2**i));
    }
  }
}
const local = (value,base) => {
  if (!value || value.startsWith('#') || /^(data|blob|mailto|tel|javascript):/i.test(value)) return null;
  let url;
  try {url=new URL(value,new URL(base,canonicalOrigin));} catch{return null;}
  return url.origin===canonicalOrigin?url.pathname:null;
};
export function inspectHTML(bytes,path) {
  const html=bytes.toString();
  assert.match(html,/<\/html\s*>/i,path);
  const root=parse(html);
  const canonicals=[],blocks=[],h1=[],meta=[],titles=[],assets=new Set(),links=new Set();
  function asset(value) {
    const pathname=local(value,path);
    if (pathname && isAsset(pathname)) assets.add(pathname);
  }
  function visit(node,inHead=false){
    const a=attributes(node), tag=node.tagName;
    if (tag==='html') assert.equal(a.lang,expectedLanguage(path),path+' langue');
    if (tag==='head') inHead=true;
    const txt=node=>(node.childNodes||[]).map(n=>n.value??txt(n)).join('');
    if(tag==='h1')h1.push(txt(node).trim());
    if(tag==='title'&&inHead)titles.push(txt(node).trim());
    if(tag==='meta'&&inHead){
      meta.push(a);
      if (['og:image','twitter:image'].includes(a.property||a.name)) asset(a.content);
    }
    if(tag==='link'){
      if (inHead && (a.rel||'').split(/\s+/).includes('canonical'))canonicals.push(a.href);
      if (['preload','modulepreload','stylesheet','icon','apple-touch-icon','manifest'].includes(a.rel))asset(a.href);
    }
    if(tag==='script' && a.type==='application/ld+json')blocks.push(JSON.parse(txt(node)));
    if(tag==='a') {
      const target=local(a.href,path);
      if (target) { if(isAsset(target)) assets.add(target); else links.add(target); }
    }
    if(['script','img','source','video','audio','input'].includes(tag)) asset(a.src);
    if(tag==='video')asset(a.poster);
    if(tag==='astro-island') { asset(a['component-url']); asset(a['renderer-url']); }
    if(a.srcset)for(const entry of a.srcset.split(','))asset(entry.trim().split(/\s+/)[0]);
    for(const child of node.childNodes||[])visit(child,inHead);
  }
  visit(root);
  assert.deepEqual(canonicals,[canonicalOrigin+path],path+' canonique');
  assert.ok(h1.length===1&&h1[0],path+' H1');
  assert.ok(titles.length===1&&titles[0],path+' titre');
  const robots=meta.filter(m=>['robots','googlebot','bingbot'].includes((m.name||'').toLowerCase()));
  assert.ok(!robots.some(m=>/\b(?:noindex|none)\b/i.test(m.content||'')),path+' robots');
  assert.ok(meta.some(m=>m.name==='description'&&m.content?.trim()),path+' description');
  return {assets:[...assets],links:[...links],structuredDataBlocks:blocks.length};
}
export function sampleRows(rows){
  const byFamily=new Map();
  for(const row of rows){
    const family=row.sitemap.replace(/^\/sitemaps\/|-[0-9]+\.xml$/g,'');
    if(!byFamily.has(family))byFamily.set(family,[]);
    byFamily.get(family).push(row);
  }
  assert.equal(byFamily.size,19);
  const sample=new Map();
  for(const familyRows of byFamily.values()){
    for(const i of [0,Math.floor(familyRows.length/2),familyRows.length-1])sample.set(familyRows[i].path,familyRows[i]);
  }
  for(const row of rows)if(row.path.startsWith('/entrepreneurs/'))sample.set(row.path,row);
  return [...sample.values()];
}
export function assetReferences(bytes,path) {
  const text=bytes.toString();
  const refs=new Set();
  if(path.endsWith('.css')){
    for(const match of text.matchAll(/(?:url\(\s*|@import\s*)["']?([^"')\s;]+)["']?/gi)){
      const target=local(match[1],path);
      if(target&&isAsset(target))refs.add(target);
    }
  } else if (/\.m?js$/.test(path)) {
    for(const match of text.matchAll(/\bfetch\(\s*["']([^"']+)["']/g)){
      const target=local(match[1],path);
      if (target&&isAsset(target)&&!/^\/(api|admin|private)\//.test(target)) refs.add(target);
    }
    for(const match of text.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)["']([^"']+)["']/g)){
      const spec=match[1];
      if(spec.startsWith('.')||spec.startsWith('/')) {
        const target=local(spec,path);
        if(target&&isAsset(target))refs.add(target);
      }
    }
  }
  return [...refs];
}
