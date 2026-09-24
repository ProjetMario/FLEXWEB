import {readSitemap} from './seo/read-sitemap.mjs';
import assert from 'node:assert/strict';
const origin = process.argv[2] || 'https://flex-web.fr';
if (!/^https:\/\/(?:flex-web\.fr|[a-z0-9-]+--flex-webb\.netlify\.app)$/.test(origin)) throw new Error('Unexpected deployment origin');
const paths=['/','/realisations/','/realisations/foot-nation/','/realisations/2savoie-immo/','/realisations/serrurier73/','/creation-site-internet/','/creation-site-internet-savoie/','/creation-site-internet-haute-savoie/','/creation-application-mobile/','/creation-application-mobile-savoie/','/creation-application-mobile-haute-savoie/','/automatisation-ia/','/automatisation-ia-savoie/','/automatisation-ia-haute-savoie/'];
for(const path of paths){
 const response=await fetch(origin+path);assert.equal(response.status,200,path);
 const html=await response.text();assert.ok(html.includes(`href="https://flex-web.fr${path}"`),`canonical ${path}`);
 if(path.includes('/realisations/') && path!== '/realisations/')assert.ok(html.includes('2026-09-15'),`date ${path}`);
 if(path==='/'||!path.startsWith('/realisations/'))assert.ok(html.includes('/realisations/'),`evidence link ${path}`);
 console.log('OK',path);
}
const sitemap=await readSitemap('https://flex-web.fr/sitemap.xml',url=>fetch(origin+new URL(url).pathname).then(r=>{assert.equal(r.status,200);return r.text()}));for(const path of paths.filter(p=>p.startsWith('/realisations/')))assert.ok(sitemap.includes('https://flex-web.fr'+path));
console.log('OK sitemap');
