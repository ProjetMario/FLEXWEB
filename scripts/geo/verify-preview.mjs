import {allPages as applicationPages} from '../../src/data/applications/content.mjs';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {readSitemap} from '../seo/read-sitemap.mjs';
const result=JSON.parse(await readFile('.cms/geo-preview.json','utf8'));
const origin=new URL(result.deploy_url).origin;
assert.match(origin,/^https:\/\/[a-z0-9-]+--flex-webb\.netlify\.app$/);
assert.equal(result.site_id,'5f0ec4e5-fe16-4ef3-8380-9b8aff26edbb');
const paths=['/guides/preparer-projet-site-internet/','/guides/preparer-projet-application-mobile/','/creation-site-internet/','/creation-application-mobile/','/en/websites/','/en/applications/','/en/guides/website-project-brief/','/en/guides/application-project-brief/','/','/pricing/','/contact/','/about/','/automatisation-ia/','/automatisation-ia-savoie/','/automatisation-ia-haute-savoie/','/crm-automatisation-entreprise/','/en/','/en/about/','/en/pricing/','/en/contact/','/en/crm/','/en/ai-automation/','/en/guides/website-enquiries-to-crm/','/en/guides/quote-follow-up/','/en/guides/internal-ai-assistant/','/journal/connecter-demandes-crm/','/journal/assistant-ia-interne-entreprise/','/ressources/automatisation/relance-devis/','/territoires/','/territoires/sites/montalieu-vercieu-38247/'];
paths.push(...applicationPages.map(page=>page.path));
for(const path of [...paths,'/robots.txt','/llms.txt','/llms-full.txt']){
 const response=await fetch(origin+path,{redirect:'error',signal:AbortSignal.timeout(30000)});assert.equal(response.status,200,path);
 const body=await response.text();
 if(path.endsWith('/')){assert(body.includes(`href="https://flex-web.fr${path}"`),path);assert(!/<meta[^>]*name="robots"[^>]*content="[^"]*noindex/.test(body),path);}
 if(path.endsWith('.txt'))assert.match(response.headers.get('content-type'),/text\/plain/);
}
const urls=await readSitemap('https://flex-web.fr/sitemap.xml',async url=>{const response=await fetch(origin+new URL(url).pathname,{redirect:'error',signal:AbortSignal.timeout(30000)});assert.equal(response.status,200,url);assert.match(response.headers.get('content-type'),/(?:application|text)\/xml/);return response.text();});
const baseline=JSON.parse(await readFile('.cms/geo-baseline.json','utf8'));assert.deepEqual(baseline.filter(u=>!urls.includes(u)),[]);
// User-agent probes test HTTP accessibility only; they do not prove crawler visits.
for(const agent of ['OAI-SearchBot','ChatGPT-User','Claude-SearchBot','Claude-User','Googlebot','bingbot','PerplexityBot']){
 const response=await fetch(origin+'/applications/ios/',{headers:{'User-Agent':agent},signal:AbortSignal.timeout(30000)});assert.equal(response.status,200,agent);
}
// Check that primary project pages are indexable and directory pages remain noindex.
for(const route of ['/projets-sites/','/projets-sites/fr/page/1/','/projets-sites/ch/page/1/','/projets-sites/particuliers/paris-fr-75056/','/projets-sites/entreprises/paris-fr-75056/','/projets-sites/particuliers/geneve-ch-6621/','/projets-sites/entreprises/geneve-ch-6621/','/projets-sites/particuliers/zurich-ch-261/','/projets-sites/entreprises/lugano-ch-5192/']){
 const response=await fetch(origin+route,{redirect:'error',signal:AbortSignal.timeout(30000)});assert.equal(response.status,200,route);
 const body=await response.text();const noindex=/<meta[^>]*name="robots"[^>]*content="[^"]*noindex/.test(body);
 assert.equal(noindex,route==='/projets-sites/'||route.includes('/page/'),route);
 if(!noindex)assert(urls.includes('https://flex-web.fr'+route),route);
}
const before=JSON.parse(await readFile('.cms/geo-production-marker.json','utf8'));
const after=await fetch('https://flex-web.fr/.well-known/flexweb-release.json').then(r=>r.json());assert.deepEqual(after,before,'Production marker changed during preview preparation');
const report={status:'passed',deployId:result.deploy_id,preview:origin,sitemapUrls:urls.length,existingUrlsPreserved:baseline.length,newUrls:urls.length-baseline.length,strategicHttpPages:paths.length,productionCodeUnchanged:after.codeCommit};
await writeFile('.cms/geo-validation.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
