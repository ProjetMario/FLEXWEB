import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {gzipSync} from 'node:zlib';
import {extractPage,hash,baselineHash} from './content.mjs';
import {renderSnapshot} from './render.mjs';

const document=route=>`<!doctype html><title>Projet</title><meta name="description" content="Décrire"><link rel="canonical" href="https://flex-web.fr${route}"><main><h1>Votre projet</h1><p>Texte initial.</p><form><input name="email"></form></main>`;
async function fixture(){
 const root=await mkdtemp(path.join(tmpdir(),'flexweb-cms-render-'));
 const price={version:'fixture',amount:29900};const entries=['/premier/','/second/'].map(route=>{const p=extractPage(document(route),route);return {collection:'pages',sourceId:route,path:route,title:p.title,seoTitle:p.title,seoDescription:p.description,content:p.content,data:{renderHash:p.renderHash,additionalSections:[]}};});
 for(const e of entries){await mkdir(path.join(root,'dist',e.path),{recursive:true});await writeFile(path.join(root,'dist',e.path,'index.html'),document(e.path));e.baselineHash=baselineHash(e);}
 for(const folder of ['.cms','cms','dist/sitemaps','apps/saas-platform/lib/automation'])await mkdir(path.join(root,folder),{recursive:true});
 await writeFile(path.join(root,'apps/saas-platform/lib/automation/public-quotes.json'),JSON.stringify(price));
 await writeFile(path.join(root,'dist/sitemaps/pages-1.xml'),'<urlset><url><loc>https://flex-web.fr/premier/</loc><lastmod>2026-09-01</lastmod></url><url><loc>https://flex-web.fr/second/</loc></url></urlset>');
 const manifest={schemaVersion:1,pricingFingerprint:hash(price),entries:entries.map(e=>({collection:e.collection,sourceId:e.sourceId,path:e.path,renderHash:e.data.renderHash,baselineHash:e.baselineHash}))};manifest.hash=hash(manifest);
 await writeFile(path.join(root,'cms/baseline.json.gz'),gzipSync(JSON.stringify(manifest)));
 for(const e of entries){e.baseManifestHash=manifest.hash;e.revision=2;e.updatedAt='2026-09-30T08:00:00Z';}
 async function save(chosen=entries){const payload={schemaVersion:1,sourceCommit:'a'.repeat(40),pricingFingerprint:manifest.pricingFingerprint,baseManifestHash:manifest.hash,entries:chosen};await writeFile(path.join(root,'.cms/snapshot.json'),JSON.stringify({...payload,id:hash(payload),createdAt:'2026-09-30T08:00:00Z'}));}
 return {root,entries,save,cleanup:()=>rm(root,{recursive:true,force:true})};
}
test('full snapshot changes only intended content and updates sitemap lastmod',async()=>{const f=await fixture();try{f.entries[0].content[1].children[0].text='Un texte utile.';await f.save([f.entries[0]]);const r=await renderSnapshot({root:f.root});assert.equal(r.pages,1);const actual=await readFile(path.join(f.root,'dist/premier/index.html'),'utf8');assert.match(actual,/Un texte utile/);assert.match(actual,/<form><input name="email"><\/form>/);assert.equal(await readFile(path.join(f.root,'dist/second/index.html'),'utf8'),document('/second/'));assert.match(await readFile(path.join(f.root,'dist/sitemaps/pages-1.xml'),'utf8'),/<lastmod>2026-09-30<\/lastmod>/);}finally{await f.cleanup();}});
test('a later conflicting page leaves every page in the batch unchanged',async()=>{const f=await fixture();try{f.entries[0].content[1].children[0].text='Nouvelle version';await f.save();await writeFile(path.join(f.root,'dist/second/index.html'),document('/second/').replace('Texte initial.','Source plus récente.'));await assert.rejects(renderSnapshot({root:f.root}),/source modifié/);assert.equal(await readFile(path.join(f.root,'dist/premier/index.html'),'utf8'),document('/premier/'));}finally{await f.cleanup();}});
test('changed shared prices block stale CMS releases',async()=>{const f=await fixture();try{await f.save();await writeFile(path.join(f.root,'apps/saas-platform/lib/automation/public-quotes.json'),'{"amount":100}');await assert.rejects(renderSnapshot({root:f.root}),/tarifaire/);}finally{await f.cleanup();}});
