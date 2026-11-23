import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseSitemap, mergeShard } from './inventory.mjs';

const ns='http://www.sitemaps.org/schemas/sitemap/0.9';
const loc='https://flex-web.fr/applications/ios/';
const entry={loc,lastmod:'2026-10-28'};
const row=(fields)=>'<url>'+Object.entries(fields).map(([k,v])=>'<'+k+'>'+v+'</'+k+'>').join('')+'</url>';
const xml=(rows)=>'<urlset xmlns="'+ns+'">'+rows.join('')+'</urlset>';

test('validate canonical, distinct URLs and the sitemap namespace',()=>{
  assert.deepEqual(parseSitemap(xml([row(entry)])),[entry]);
  assert.throws(()=>parseSitemap(xml([row(entry),row(entry)])),/Doublon/);
  for(const value of ['https://www.flex-web.fr/applications/ios/',loc+'?q=x',loc+'#faq','https://flex-web.fr:443/applications/ios/']){
    assert.throws(()=>parseSitemap(xml([row({loc:value})])));
  }
  assert.throws(()=>parseSitemap(xml([row(entry)]).replace(ns,'https://example.com/')));
  assert.throws(()=>parseSitemap(xml([row({...entry,news:'unreviewed-extension'})])));
  assert.throws(()=>parseSitemap('<!DOCTYPE urlset>'+xml([row(entry)])));
});

test('recognize the sitemap index independently from an HTML URL set',()=>{
  const child='https://flex-web.fr/sitemaps/territoires-1.xml';
  const doc='<sitemapindex xmlns="'+ns+'"><sitemap><loc>'+child+'</loc></sitemap></sitemapindex>';
  assert.deepEqual(parseSitemap(doc,true),[{loc:child}]);
  assert.throws(()=>parseSitemap(doc));
  assert.throws(()=>parseSitemap(doc.replace(child,loc),true));
});

test('keep known candidate dates; do not assign an archive date to a changed page with unknown modification time',()=>{
  const updated={loc,lastmod:'2026-11-23'}, elsewhere={loc:'https://flex-web.fr/applications/android/',lastmod:'2026-10-25'};
  const additions=[{loc:'https://flex-web.fr/realisations/footnation/',lastmod:'2026-11-23'}];
  assert.deepEqual(mergeShard([entry,elsewhere],new Map([[loc,updated]]),additions),
    {changed:true,entries:[updated,elsewhere,...additions]});
  assert.deepEqual(mergeShard([entry],new Map([[loc,{loc}]])),{changed:true,entries:[{loc}]});
  assert.deepEqual(mergeShard([entry,elsewhere],new Map([[loc,{...entry}]])),{changed:false,entries:[entry,elsewhere]});
});
