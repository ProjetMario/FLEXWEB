import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {formOrigin,previewFormOrigin} from './markup.mjs';
export async function checkFormBridge(origin=formOrigin) {
  const {sha256}=JSON.parse(await readFile(new URL('./form-release.json',import.meta.url)));
  await Promise.all(Object.entries(sha256).map(async([path,expected])=>{
    const r=await fetch(origin+'/'+path,{redirect:'error',signal:AbortSignal.timeout(25000)});
    assert.equal(r.status,200);
    assert.equal(createHash('sha256').update(Buffer.from(await r.arrayBuffer())).digest('hex'),expected,'Version du formulaire '+path);
  }));
}
export async function checkReadingPages(origin) {
  const draft=/^https:\/\/[0-9a-f]{24}--flex-webb\.netlify\.app$/.test(origin);
  for (const path of ['/','/en/','/creation-site-internet/','/en/websites/','/demarrer/application/','/de/anwendungen/','/it/applicazioni/','/contact/','/en/contact/','/entrepreneurs/metiers/artisan-batiment/','/mentions-legales/','/en/faq/','/projets-sites/entreprises/bern-ch-351/']){
    const response=await fetch(origin+path,{redirect:'error',signal:AbortSignal.timeout(25000)});
    assert.equal(response.status,200,path);
    const html=await response.text();assert.equal((html.match(/src="\/language-assets\/reader\.mjs"/g)||[]).length,1,path);
    assert.ok(!html.includes('mailto:contact@flex-web.fr'),path);
    if(path==='/contact/' || path==='/en/contact/') assert.ok(html.includes('src="'+(draft?previewFormOrigin:formOrigin)+(path.startsWith('/en/')?'/en/':'/')+'"'));
    if(['/','/en/','/entrepreneurs/metiers/artisan-batiment/'].includes(path))assert.ok(html.includes('href="https://flex-web.fr'+path+'"'),path);
  }
  for (const path of ['/sitemap.xml','/robots.txt','/llms.txt','/espace-projet/']){
    const response=await fetch(origin+path);assert.ok(!(await response.text()).includes('/language-assets/reader.mjs'),path);
  }
  const r=await fetch(origin+'/api/langue/',{redirect:'error'});assert.equal(r.status,200);assert.match(r.headers.get('cache-control')??'',/no-store/);
  const decision=await r.json();assert.deepEqual(Object.keys(decision),['language']);assert.ok(['fr','en'].includes(decision.language));
  console.log('HTTP et langue par défaut vérifiés',origin,decision.language);
}
if(process.argv[1]===fileURLToPath(import.meta.url))await checkReadingPages(process.argv[2]);
