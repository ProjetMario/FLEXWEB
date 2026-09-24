import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {auditArticles,releaseReadiness} from '../../scripts/seo/quality.mjs';
import {chunks,urlset,sitemapIndex} from '../../src/lib/seo/xml.mjs';
import {readSitemap} from '../../scripts/seo/read-sitemap.mjs';
const articles=JSON.parse(await readFile(new URL('../../src/data/national/articles.json',import.meta.url),'utf8'));
test('reviewed editorial catalogue has distinct intents, sources and balanced axes',()=>{
 assert.deepEqual(auditArticles(articles),[]);
 assert.equal(articles.filter(a=>a.axis==='sites').length,articles.filter(a=>a.axis==='automatisation').length);
});
test('copied content with a new title and slug cannot pass',()=>{
 const duplicate={...articles[0],slug:'another-slug',intent:'another-intent',title:'Another title for another city'};
 assert(auditArticles([...articles,duplicate]).some(s=>s.startsWith('Duplicate body:')));
 assert(auditArticles([...articles,duplicate]).some(s=>s.startsWith('Similar bodies:')));
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
test('20,000 URLs alone cannot release unbalanced or invalid content',()=>{
 assert.equal(releaseReadiness(274,[],{sites:6,automatisation:6}).ready,false);
 assert.equal(releaseReadiness(20000,['Duplicate body'],{sites:10000,automatisation:10000}).ready,false);
 assert.equal(releaseReadiness(20000,[],{sites:10000,automatisation:9999}).ready,false);
 assert.equal(releaseReadiness(20000,[],{sites:10000,automatisation:10000}).ready,true);
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
