import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {readSitemap} from '../seo/read-sitemap.mjs';
const origin='https://flex-web.fr';
const marker=await fetch(origin+'/.well-known/flexweb-release.json').then(r=>{assert.equal(r.status,200);return r.json();});
assert.equal(marker.codeCommit,'1b456b742739cf6aad2d5cf8e65c3a8117ea2b18','Production changed: review the baseline before preparing this preview');
const urls=await readSitemap(origin+'/sitemap.xml',async url=>{assert.equal(new URL(url).origin,origin);const r=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(30000)});assert.equal(r.status,200,url);return r.text();});
await mkdir('.cms',{recursive:true});
await writeFile('.cms/geo-baseline.json',JSON.stringify(urls)+'\n');
await writeFile('.cms/geo-production-marker.json',JSON.stringify(marker)+'\n');
console.log(JSON.stringify({productionCode:marker.codeCommit,sitemapUrls:urls.length}));

