import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {readSitemap} from './read-sitemap.mjs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
export function auditArticles(articles){
 const issues=[],seen=new Map(),slugSet=new Set(articles.map(a=>a.slug)),index=new Map(),sets=[];
 const checkUnique=(key,i)=>{if(seen.has(key))issues.push(`Duplicate ${key}: ${seen.get(key)} / ${i}`);else seen.set(key,i)};
 articles.forEach((a,i)=>{
  checkUnique('slug:'+a.slug,i);checkUnique('intent:'+a.intent,i);checkUnique('title:'+a.title.trim().toLowerCase(),i);
  if(!['sites','automatisation'].includes(a.axis))issues.push(`Invalid axis: ${a.slug}`);
  if(a.status!=='reviewed')return;
  if(!a.reviewer||!/^\d{4}-\d{2}-\d{2}$/.test(a.reviewedAt)||!Number.isFinite(Date.parse(a.reviewedAt))||Date.parse(a.reviewedAt)>Date.now())issues.push(`Missing review: ${a.slug}`);
  if(!a.sources?.length||a.sources.some(s=>!/^https:\/\//.test(s.url)||!s.checkedAt))issues.push(`Missing source: ${a.slug}`);
  for(const related of a.related??[])if(!slugSet.has(related))issues.push(`Unknown related: ${related}`);
  const text=[a.intro,...a.sections.flatMap(s=>[s.title,s.text]),a.example,a.limits].join(' ');
  const tokens=text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').match(/[a-z0-9]+/g)||[];
  if(tokens.length<250)issues.push(`Insufficient developed content: ${a.slug} (${tokens.length} words)`);
  if(!/illustratif|illustrative|fictif|fictive|exemple/i.test(a.example))issues.push(`Unlabelled example: ${a.slug}`);
  checkUnique('body:'+createHash('sha256').update(tokens.join(' ')).digest('hex'),i);
  const shingles=new Set(tokens.slice(0,-4).map((_,k)=>tokens.slice(k,k+5).join(' ')));sets[i]=shingles;
  // Inverted fingerprints avoid all-pairs comparison at national scale.
  const candidates=new Map();
  for(const shingle of shingles){const prior=index.get(shingle)||[];if(prior.length>50)continue;for(const j of prior)candidates.set(j,(candidates.get(j)||0)+1);}
  for(const [j,intersection] of candidates){const similarity=intersection/(shingles.size+sets[j].size-intersection);if(similarity>=.45)issues.push(`Similar bodies: ${articles[j].slug} / ${a.slug} (${similarity.toFixed(2)})`);}
  for(const shingle of shingles){const list=index.get(shingle)||[];if(list.length<=50)list.push(i);index.set(shingle,list);}
 });
 return issues;
}
export function releaseReadiness(urlCount,issues,counts){return {ready:urlCount>=20000&&issues.length===0&&counts.sites===counts.automatisation,target:20000,urlCount,missing:Math.max(0,20000-urlCount),counts,issues};}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const articles=JSON.parse(await readFile('src/data/national/articles.json','utf8'));
 const urls=await readSitemap('https://flex-web.fr/sitemap.xml',url=>readFile(path.join('dist',new URL(url).pathname),'utf8'));
 const issues=auditArticles(articles);
 const counts=Object.fromEntries(['sites','automatisation'].map(axis=>[axis,articles.filter(a=>a.axis===axis&&a.status==='reviewed').length]));
 const report={...releaseReadiness(urls.length,issues,counts),generatedAt:new Date().toISOString(),newArticles:counts.sites+counts.automatisation,note:'Word count and similarity are screening checks, not proof of editorial value. No claimed traffic forecast.'};
 await mkdir('outputs/seo-national-20260924',{recursive:true});await writeFile('outputs/seo-national-20260924/quality.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
 if(issues.length||(process.argv.includes('--enforce-release')&&process.env.CONTEXT==='production'&&!report.ready))process.exitCode=1;
}
