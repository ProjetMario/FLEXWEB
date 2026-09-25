import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {reviewHash,isPublishable,intentKey} from '../../src/lib/seo/editorial.mjs';
import {readSitemap} from './read-sitemap.mjs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
export function neutralize(text,terms=[]){
 let result=text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
 for(const term of [...terms].sort((a,b)=>b.length-a.length)){const value=term.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');result=result.split(value).join(' territoire ');}
 return result.replace(/\d+(?:[.,]\d+)?/g,' nombre ').replace(/\s+/g,' ').trim();
}
export function auditArticles(articles){
 const issues=[],seen=new Map(),slugSet=new Set(articles.map(a=>a.slug)),index=new Map(),sets=[];
 const checkUnique=(key,i)=>{if(seen.has(key))issues.push(`Duplicate ${key}: ${seen.get(key)} / ${i}`);else seen.set(key,i)};
 articles.forEach((a,i)=>{
  checkUnique('slug:'+a.slug,i);checkUnique('intent:'+a.intent,i);checkUnique('title:'+a.title.trim().toLowerCase(),i);
  if(!['sites','automatisation'].includes(a.axis))issues.push(`Invalid axis: ${a.slug}`);
  if(a.status!=='reviewed'){if(a.publicationSelected)issues.push(`Selected draft: ${a.slug}`);return;}
  if(!a.audience||!a.problem||!a.outcome)issues.push(`Missing intent brief: ${a.slug}`);
  checkUnique('need:'+intentKey(a),i);
  if(a.reviewHash!==reviewHash(a))issues.push(`Stale review: ${a.slug}`);
  if(!a.reviewer||!/^\d{4}-\d{2}-\d{2}$/.test(a.reviewedAt)||!Number.isFinite(Date.parse(a.reviewedAt))||Date.parse(a.reviewedAt)>Date.now())issues.push(`Missing review: ${a.slug}`);
  if(!a.sources?.length||a.sources.some(s=>!/^https:\/\//.test(s.url)||!s.checkedAt))issues.push(`Missing source: ${a.slug}`);
  for(const related of a.related??[])if(!slugSet.has(related))issues.push(`Unknown related: ${related}`);
  const text=[a.intro,...a.sections.flatMap(s=>[s.title,s.text]),a.example,a.limits].join(' ');
  const normalized=neutralize(text,a.locationTerms||[]);
  checkUnique('normalized-body:'+normalized,i);
  for(const part of [a.intro,a.example,...a.sections.map(s=>s.text)])if(part.length>=160)checkUnique('paragraph:'+neutralize(part,a.locationTerms||[]),i);
  const tokens=text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').match(/[a-z0-9]+/g)||[];
  if(tokens.length<250)issues.push(`Insufficient developed content: ${a.slug} (${tokens.length} words)`);
  if(!/illustratif|illustrative|fictif|fictive|exemple/i.test(a.example))issues.push(`Unlabelled example: ${a.slug}`);
  checkUnique('body:'+createHash('sha256').update(tokens.join(' ')).digest('hex'),i);
  const shingles=new Set(tokens.slice(0,-4).map((_,k)=>tokens.slice(k,k+5).join(' ')));sets[i]=shingles;
  // Retain representative postings even for very common fingerprints. Dropping
  // common fingerprints entirely lets the 52nd copy of a template evade review.
  // Candidate nomination is bounded per fingerprint; similarity is then exact
  // for each nominated pair, including postings saturated by earlier articles.
  const candidates=new Map();
  for(const shingle of shingles){for(const j of index.get(shingle)||[])candidates.set(j,(candidates.get(j)||0)+1);}
  for(const j of candidates.keys()){
   const prior=sets[j],smaller=shingles.size<prior.size?shingles:prior,larger=smaller===shingles?prior:shingles;
   let intersection=0;for(const shingle of smaller)if(larger.has(shingle))intersection++;
   const similarity=intersection/(shingles.size+prior.size-intersection);
   if(similarity>=.45)issues.push(`Similar bodies: ${articles[j].slug} / ${a.slug} (${similarity.toFixed(2)})`);
  }
  for(const shingle of shingles){const list=index.get(shingle)||[];if(list.length<50)list.push(i);index.set(shingle,list);}
 });
 return issues;
}
export function releaseReadiness(urlCount,issues,counts){
 const valid=['sites','automatisation'].every(axis=>Number.isInteger(counts[axis])&&counts[axis]>=0),selectedArticles=valid?counts.sites+counts.automatisation:0;
 return {ready:valid&&selectedArticles>0&&urlCount>=selectedArticles&&issues.length===0,target:20000,urlCount,reviewedArticles:selectedArticles,selectedArticles,remainingTarget:Math.max(0,20000-selectedArticles),counts,issues,mode:'reviewed-batches'};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const articles=JSON.parse(await readFile('src/data/national/articles.json','utf8'));
 const urls=await readSitemap('https://flex-web.fr/sitemap.xml',url=>readFile(path.join('dist',new URL(url).pathname),'utf8'));
 const selected=articles.filter(a=>a.publicationSelected);
 const issues=auditArticles(selected);
 const expected=selected.filter(isPublishable).map(a=>'https://flex-web.fr/ressources/'+a.axis+'/'+a.slug+'/');
 for(const u of urls)if(/^\/ressources\/(sites|automatisation)\/[^/]+\/$/.test(new URL(u).pathname)&&!expected.includes(u))issues.push('Unselected resource in sitemap: '+u);
 for(const u of expected)if(!urls.includes(u))issues.push('Selected article missing from sitemap: '+u);
 for(const a of articles.filter(a=>!isPublishable(a)))if(urls.includes('https://flex-web.fr/ressources/'+a.axis+'/'+a.slug+'/'))issues.push('Unselected article in sitemap: '+a.slug);
 if(urls.some(u=>new URL(u).pathname.startsWith('/preparation/')))issues.push('Draft catalogue in sitemap');
 const counts=Object.fromEntries(['sites','automatisation'].map(axis=>[axis,selected.filter(a=>a.axis===axis&&isPublishable(a)).length]));
 const territorialPages=urls.filter(u=>/^\/territoires\/(sites|automatisation)\/[^/]+\/$/.test(new URL(u).pathname)).length;
 const report={...releaseReadiness(urls.length,issues,counts),territorialPages,publicationMode:'reviewed-guides-and-territorial-catalogue',generatedAt:new Date().toISOString(),newArticles:counts.sites+counts.automatisation,note:'Word count and similarity are screening checks, not proof of editorial value. No claimed traffic forecast.'};
 await mkdir('outputs/seo-national-20260924',{recursive:true});await writeFile('outputs/seo-national-20260924/quality.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
 if(issues.length||(process.argv.includes('--enforce-release')&&process.env.CONTEXT==='production'&&!report.ready))process.exitCode=1;
}
