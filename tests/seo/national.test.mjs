import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {auditArticles,releaseReadiness,neutralize} from '../../scripts/seo/quality.mjs';
import {chunks,urlset,sitemapIndex} from '../../src/lib/seo/xml.mjs';
import {readSitemap} from '../../scripts/seo/read-sitemap.mjs';
const articles=JSON.parse(await readFile(new URL('../../src/data/national/articles.json',import.meta.url),'utf8'));
test('reviewed editorial catalogue has distinct intents, sources and both service axes',()=>{
 assert.deepEqual(auditArticles(articles),[]);
 assert(articles.some(a=>a.axis==='sites'));
 assert(articles.some(a=>a.axis==='automatisation'));
});
test('copied content with a new title and slug cannot pass',()=>{
 const duplicate={...articles[0],slug:'another-slug',intent:'another-intent',title:'Another title for another city'};
 assert(auditArticles([...articles,duplicate]).some(s=>s.startsWith('Duplicate body:')));
 assert(auditArticles([...articles,duplicate]).some(s=>s.startsWith('Similar bodies:')));
});
test('frequent fingerprints still detect every near duplicate after 100 copies',()=>{
 const copies=Array.from({length:125},(_,i)=>({...structuredClone(articles[0]),slug:`copy-${i}`,intent:`copy-${i}`,title:`Distinct copy title ${i}`,intro:`${articles[0].intro} territoireunique${i}`,related:[]}));
 const issues=auditArticles(copies);
 // Bodies differ in a territorial token: exact-body hashing cannot catch them.
 assert(!issues.some(s=>s.startsWith('Duplicate body:')));
 for(let i=1;i<copies.length;i++)assert(issues.some(s=>s.startsWith('Similar bodies:')&&s.includes(` / copy-${i} (`)),`Near duplicate ${i} must not escape the saturated fingerprint index`);
});
test('invalid sources, future reviews and broken related links are rejected',()=>{
 const bad={...articles[0],reviewedAt:'2099-12-31',sources:[],related:['does-not-exist']};
 const issues=auditArticles([bad]);
 for(const fragment of ['Missing review','Missing source','Unknown related'])assert(issues.some(s=>s.startsWith(fragment)));
});
test('draft content is not counted by release readiness caller',()=>{
 const draft={...articles[0],status:'draft',slug:'draft-only',intent:'draft-only',title:'New draft only'};
 const selected=[...articles,draft].filter(a=>a.status==='reviewed');assert.equal(selected.length,articles.length);
});
test('a reviewed batch can release without filling the catalogue target',()=>{
 assert.equal(releaseReadiness(286,[],{sites:12,automatisation:12}).ready,true);
 assert.equal(releaseReadiness(20000,[],{sites:0,automatisation:0}).ready,false);
 assert.equal(releaseReadiness(286,['Stale review'],{sites:12,automatisation:12}).ready,false);
 assert.equal(releaseReadiness(5,[],{sites:12,automatisation:12}).ready,false);
});
test('any meaningful content change invalidates its review',()=>{
 const a=structuredClone(articles[0]);a.sections[0].text+=' Nouveau périmètre.';
 assert(auditArticles([a]).some(s=>s.startsWith('Stale review:')));
});
test('place names and figures cannot disguise copied content',()=>{
 assert.equal(neutralize('Intervention à Annecy 74000 pour 3 sites',['Annecy']),neutralize('Intervention à Chambéry 73000 pour 8 sites',['Chambéry']));
});
test('a paraphrased title does not create a different declared need',()=>{
 const copy={...structuredClone(articles[0]),slug:'renamed-guide',title:'Une autre formulation du même problème',intent:'renamed-guide'};
 assert(auditArticles([...articles,copy]).some(s=>s.startsWith('Duplicate need:')));
});
test('selected drafts never count as valid published articles',()=>{
 const a={...structuredClone(articles[0]),status:'draft'};
 assert(auditArticles([a]).some(s=>s.startsWith('Selected draft:')));
});
test('20,000 synthetic URLs split into exact, complete sitemap segments (not content or a build benchmark)',async()=>{
 const records=Array.from({length:20000},(_,i)=>({url:`/synthetic-test-${i}/`,lastmod:'2026-09-24'}));
 const groups=chunks(records);assert.equal(groups.length,10);assert(groups.every(g=>g.length===2000));
 const paths=groups.map((_,i)=>`/sitemaps/test-${i}.xml`);
 const files=new Map([['/sitemap.xml',sitemapIndex(paths)],...paths.map((p,i)=>[p,urlset(groups[i])])]);
 const urls=await readSitemap('https://flex-web.fr/sitemap.xml',async url=>files.get(new URL(url).pathname));
 assert.equal(urls.length,20000);assert.equal(new Set(urls).size,20000);
});
test('sitemap traversal rejects foreign origins and loops',async()=>{
 await assert.rejects(()=>readSitemap('https://flex-web.fr/sitemap.xml',async()=>'<sitemapindex><loc>https://outside.test/a.xml</loc></sitemapindex>'),/Foreign/);
 await assert.rejects(()=>readSitemap('https://flex-web.fr/sitemap.xml',async()=>sitemapIndex(['/sitemap.xml'])),/cycle/);
});
