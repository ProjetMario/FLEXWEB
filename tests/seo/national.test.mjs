import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
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
test('20,000 URLs alone cannot release unbalanced or invalid content',()=>{
 assert.equal(releaseReadiness(274,[],{sites:6,automatisation:6}).ready,false);
 const twelveReviewed=releaseReadiness(20000,[],{sites:6,automatisation:6});
 assert.equal(twelveReviewed.ready,false);
 assert.equal(twelveReviewed.reviewedArticles,12);
 assert.equal(twelveReviewed.missing,19988);
 assert.equal(twelveReviewed.missingUrls,0);
 assert.equal(releaseReadiness(25000,[],{sites:0,automatisation:0}).ready,false);
 assert.equal(releaseReadiness(20000,[],{sites:NaN,automatisation:NaN}).ready,false);
 assert.equal(releaseReadiness(20000,[],{sites:10000.5,automatisation:10000.5}).ready,false);
 assert.equal(releaseReadiness(20000,['Duplicate body'],{sites:10000,automatisation:10000}).ready,false);
 assert.equal(releaseReadiness(20000,[],{sites:10000,automatisation:9999}).ready,false);
 assert.equal(releaseReadiness(20000,[],{sites:10000,automatisation:10000}).ready,true);
});
test('a 12-article catalogue with 20,000 sitemap URLs remains previewable but blocks production',async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'flexweb-quality-gate-'));
 try{
  await mkdir(path.join(directory,'src/data/national'),{recursive:true});
  await mkdir(path.join(directory,'dist'),{recursive:true});
  await writeFile(path.join(directory,'src/data/national/articles.json'),JSON.stringify(articles));
  await writeFile(path.join(directory,'dist/sitemap.xml'),urlset(Array.from({length:20000},(_,i)=>({url:`/legacy-or-navigation-${i}/`,lastmod:'2026-09-24'}))));
  const script=fileURLToPath(new URL('../../scripts/seo/quality.mjs',import.meta.url));
  for(const [context,exitCode] of [['deploy-preview',0],['production',1]]){
   const result=spawnSync(process.execPath,[script,'--enforce-release'],{cwd:directory,encoding:'utf8',env:{...process.env,CONTEXT:context}});
   assert.equal(result.status,exitCode,result.stderr);
   const report=JSON.parse(result.stdout);
   assert.equal(report.ready,false);assert.equal(report.reviewedArticles,12);assert.equal(report.missing,19988);
  }
 }finally{await rm(directory,{recursive:true,force:true});}
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
