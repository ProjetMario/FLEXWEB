import {readFile,writeFile,readdir,mkdir,mkdtemp,copyFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {applyPage,hash,renderBlockBody,escapeHtml,extractPage} from './content.mjs';
import {applyImages} from './images.mjs';
import {readManifest,validateSnapshot} from './snapshot.mjs';
import {readSnapshot} from './snapshot-io.mjs';
import {draftPath} from '../../src/lib/seo/territorial-drafts.mjs';

function addCommuneNotes(html,entry,commune){
 if(entry.title!==commune.name||hash(entry.data.facts)!==hash(commune))throw Error('Les identifiants et faits territoriaux demandent une mise à jour sourcée du référentiel');
 if(!Array.isArray(entry.content)||entry.content.length>30)throw Error('Notes territoriales invalides');
 const parts=entry.content.map(b=>{if(!['normal','h2','h3',undefined].includes(b.style))throw Error('Titre territorial invalide');const tag=b.style==='h2'||b.style==='h3'?b.style:'p';return `<${tag}>${renderBlockBody(b)}</${tag}>`;});
 for(const s of entry.data.additionalSections??[])parts.push(`<h2>${escapeHtml(s.title)}</h2><p>${escapeHtml(s.text)}</p>`);
 if(!parts.length)return html;
 const mainEnd=html.lastIndexOf('</main>');if(mainEnd<0)throw Error('Contenu territorial absent');
 return html.slice(0,mainEnd)+`<aside data-cms-generated class="cms-local-context" style="max-width:960px;margin:32px auto;padding:24px" aria-label="Informations complémentaires sur le territoire">${parts.join('')}</aside>`+html.slice(mainEnd);
}
export async function renderSnapshot({root=process.cwd(),dist=path.join(root,'dist'),snapshotFile=path.join(root,'.cms/snapshot.json')}={}){
 let snapshot;try{snapshot=await readSnapshot(snapshotFile);}catch(e){if(e.code==='ENOENT')return {active:false,pages:0};throw e;}
 const manifest=await readManifest(root);validateSnapshot(snapshot,manifest,{sourceCommit:process.env.CMS_SOURCE_COMMIT});
 const pricing=JSON.parse(await readFile(path.join(root,'apps/saas-platform/lib/automation/public-quotes.json'),'utf8'));
 if(hash(pricing)!==snapshot.pricingFingerprint)throw Error('Le catalogue tarifaire a changé : rebaser le CMS avant publication');
 const changes=new Map();const touched=new Map();
 await mkdir(path.join(root,'.cms'),{recursive:true});const stage=await mkdtemp(path.join(root,'.cms/render-stage-'));
 try{
 const stageFile=route=>path.join(stage,hash(route)+'.html');
 const pageFile=route=>path.join(dist,route,'index.html');
 const markTouched=(route,date)=>{const previous=touched.get(route);if(!previous||Date.parse(date)>Date.parse(previous))touched.set(route,date);};
 for(const entry of snapshot.entries.filter(e=>e.collection!=='communes')){
  const html=await readFile(pageFile(entry.path),'utf8');let result=applyPage(html,entry);
  if(entry.data.images)result=applyImages(result,entry.data.images,{mediaOrigin:process.env.EMDASH_URL});
  // Parse the result again: malformed edits cannot remove canonical/meta/main.
  extractPage(result,entry.path);
  if(result!==html){await writeFile(stageFile(entry.path),result);changes.set(entry.path,stageFile(entry.path));markTouched(entry.path,entry.updatedAt);}
 }
 const communeEntries=snapshot.entries.filter(e=>e.collection==='communes');
 if(communeEntries.length){
  const original=JSON.parse(await readFile(path.join(root,'src/data/national/territorial-drafts.json'),'utf8'));const communes=new Map(original.communes.map(c=>[c.code,c]));
  for(const entry of communeEntries){const commune=communes.get(entry.sourceId);if(!commune)throw Error('Commune inconnue');
   for(const axis of ['sites','automatisation']){const route=draftPath(axis,commune),html=await readFile(changes.get(route)??pageFile(route),'utf8'),result=addCommuneNotes(html,entry,commune);
    if(result!==html){await writeFile(stageFile(route),result);changes.set(route,stageFile(route));markTouched(route,entry.updatedAt);}
   }
  }
 }
 // Validate the entire batch before writing any rendered file.
 for(const [route,filename]of changes)await copyFile(filename,pageFile(route));
 let sitemapFiles=[];try{sitemapFiles=await readdir(path.join(dist,'sitemaps'));}catch(e){if(e.code!=='ENOENT')throw e;}
 // Source content can be newer than the last CMS revision. Never move its
 // sitemap date backwards, or refresh unchanged pages just for a re-publication.
 for(const name of sitemapFiles.filter(n=>n.endsWith('.xml'))){const filename=path.join(dist,'sitemaps',name);const xml=await readFile(filename,'utf8');const updated=xml.replace(/<url>([\s\S]*?)<\/url>/g,(whole,body)=>{const loc=body.match(/<loc>([^<]+)<\/loc>/)?.[1];if(!loc)return whole;const date=touched.get(new URL(loc).pathname);if(!date)return whole;const day=new Date(date).toISOString().slice(0,10),previous=body.match(/<lastmod>([^<]*)<\/lastmod>/)?.[1];if(previous&&Date.parse(previous)>=Date.parse(day))return whole;return `<url>${/<lastmod>/.test(body)?body.replace(/<lastmod>[^<]*<\/lastmod>/,`<lastmod>${day}</lastmod>`):body+`<lastmod>${day}</lastmod>`}</url>`;});if(updated!==xml)await writeFile(filename,updated);}
 const report={active:true,id:snapshot.id,pages:changes.size,changedRoutes:[...changes.keys()]};await writeFile(path.join(root,'.cms/render-report.json'),JSON.stringify(report,null,2)+'\n',{mode:0o600});return report;
 }finally{await rm(stage,{recursive:true,force:true});}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))renderSnapshot().then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(e.message);process.exitCode=1;});
