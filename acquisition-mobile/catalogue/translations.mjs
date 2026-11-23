import assert from 'node:assert/strict';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parse} from 'parse5';
import {cache, filePath, put} from '../scripts/baseline.mjs';
import {mobilePages} from '../src/data/mobile.mjs';

const archive = 'https://6af791098269e8f08591ce03--flex-webb.netlify.app';
const mobile = 'https://6b0485a09cae4d4dbe96caf4--flex-webb.netlify.app';
const canonical = 'https://flex-web.fr';
const dir = join(cache,'catalogue');

async function html(origin, route) {
  const res=await fetch(origin+route,{redirect:'error',signal:AbortSignal.timeout(20000)});
  assert.equal(res.status,200,route);
  return res.text();
}
function languages(html) {
  const head=parse(html).childNodes.find(n=>n.tagName==='html').childNodes.find(n=>n.tagName==='head');
  const result={};
  for (const el of head.childNodes.filter(n=>n.tagName==='link')) {
    const a=Object.fromEntries(el.attrs.map(a=>[a.name,a.value]));
    if (a.rel !== 'alternate' || !a.hreflang) continue;
    assert.ok(!result[a.hreflang],a.hreflang+' dupliqué');
    const url=new URL(a.href);
    assert.equal(url.origin,canonical);
    result[a.hreflang]=url.pathname;
  }
  return result;
}
export async function translations(){
  const groups=mobilePages.filter(p=>p.lang==='fr' && p.alternates.en);
  const paths=[];
  for (const group of groups) {
    const urls=languages(await html(archive,group.path));
    assert.deepEqual(Object.keys(urls).sort(),['de','en','fr','it','x-default']);
    for (const lang of ['de','it','en']) assert.deepEqual(languages(await html(archive,urls[lang])),urls,urls[lang]);
    for (const lang of ['fr','en']) {
      const route=group.alternates[lang];
      assert.equal(urls[lang],route);
      const current=await html(mobile,route);
      const old=languages(current);
      assert.deepEqual(old,{fr:urls.fr,en:urls.en,'x-default':urls['x-default']});
      const tags=['de','it'].map(l=>'<link rel="alternate" hreflang="'+l+'" href="'+canonical+urls[l]+'">').join('');
      const updated=current.replace('</head>',tags+'</head>');
      assert.deepEqual(languages(updated),urls);
      const file=filePath(route);
      await put(join(dir,'html'),file,updated);
      paths.push(file);
    }
  }
  assert.equal(paths.length,14);
  await put(dir,'translations.json',JSON.stringify({paths:paths.sort()},null,2)+'\n');
  console.log(paths.length+' pages FR/EN reliées à leurs variantes DE/IT vérifiées.');
}
if(process.argv[1]===fileURLToPath(import.meta.url)) await translations();
