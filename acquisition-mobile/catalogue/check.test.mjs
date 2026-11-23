import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {checkCatalog,expectedPaths} from './check.mjs';

const origin='https://flex-web.fr';
const ns='xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"';
const reference=JSON.parse(await readFile(new URL('./expected.json',import.meta.url)));
const entry=(tag,path)=>'<'+tag+'><loc>'+origin+path+'</loc></'+tag+'>';
const index='<sitemapindex '+ns+'>'+reference.sitemaps.map(p=>entry('sitemap',p)).join('')+'</sitemapindex>';
const paths=[...expectedPaths];
function fixture(replace) {
  const buckets=reference.sitemaps.map(()=>[]);
  paths.forEach((path,i)=>buckets[i%buckets.length].push(entry('url',replace(path,i))));
  return async p=>p==='/sitemap.xml'?index:'<urlset '+ns+'>'+buckets[reference.sitemaps.indexOf(p)].join('')+'</urlset>';
}
test('le sitemap plat de 275 pages ne peut pas lancer une publication',async()=>{
  const flat='<urlset '+ns+'>'+paths.slice(0,275).map(p=>entry('url',p)).join('')+'</urlset>';
  await assert.rejects(checkCatalog(async()=>flat));
});
test('une URL substituée est détectée même si le total est identique',async()=>{
  await assert.rejects(checkCatalog(fixture((path,i)=>i===100?'/test-substitution-inventaire/':path)),/URL manquantes/);
});
test('un doublon entre deux sous-sitemaps bloque la publication',async()=>{
  await assert.rejects(checkCatalog(fixture((path,i)=>i===1?paths[0]:path)),/dupliquée/);
});
