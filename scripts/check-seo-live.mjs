import {readSitemap} from './seo/read-sitemap.mjs';
import assert from 'node:assert/strict';
const origin = process.argv[2] || 'https://flex-web.fr';
if (!/^https:\/\/(?:flex-web\.fr|[a-z0-9-]+--flex-webb\.netlify\.app)$/.test(origin)) throw new Error('Unexpected deployment origin');
const paths=['/','/realisations/','/realisations/foot-nation/','/realisations/2savoie-immo/','/realisations/serrurier73/','/creation-site-internet/','/creation-site-internet-savoie/','/creation-site-internet-haute-savoie/','/creation-application-mobile/','/creation-application-mobile-savoie/','/creation-application-mobile-haute-savoie/','/automatisation-ia/','/automatisation-ia-savoie/','/automatisation-ia-haute-savoie/'];
for(const path of paths){
 const response=await fetch(origin+path);assert.equal(response.status,200,path);
 const html=await response.text();assert.ok(html.includes(`href="https://flex-web.fr${path}"`),`canonical ${path}`);
 if(path.includes('/realisations/') && path!== '/realisations/')assert.ok(html.includes('2026-09-30'),`date ${path}`);
 if(path==='/'||!path.startsWith('/realisations/'))assert.ok(html.includes('/realisations/'),`evidence link ${path}`);
 console.log('OK',path);
}
const sitemap=await readSitemap('https://flex-web.fr/sitemap.xml',url=>fetch(origin+new URL(url).pathname).then(r=>{assert.equal(r.status,200);return r.text()}));for(const path of paths.filter(p=>p.startsWith('/realisations/')))assert.ok(sitemap.includes('https://flex-web.fr'+path));
console.log('OK sitemap');
// Search Console still knows old product-template articles. They have no
// relevant replacement: serve Gone rather than redirecting them to the journal.
for(const slug of ['dyson-pencilvac','dyson-zone','dyson-360-vis-nav','dyson-microfan','wearable-air-purifier','supersonic-r-hair-dryer']){
 for(const suffix of ['', '/']){
  const route=`/journal/${slug}${suffix}`;
  assert(!sitemap.includes('https://flex-web.fr'+route),`Retired article in sitemap: ${route}`);
  const response=await fetch(origin+route,{redirect:'manual',signal:AbortSignal.timeout(20000)});
  assert.equal(response.status,410,`Retired article must return 410: ${route}`);
  assert.equal(response.headers.get('location'),null,`Retired article redirected: ${route}`);
  assert.match(response.headers.get('x-robots-tag')||'',/noindex/i,`Retired article robots: ${route}`);
  assert.match(await response.text(),/Cet article n’est plus disponible/,`Retired article body: ${route}`);
 }
}
console.log('OK retired product articles');
// A historical SearchAction generated this literal query. It now resolves to
// the homepage with the clean canonical; never recreate a fake search engine.
const oldSearch=await fetch(origin+'/?q=%7Bsearch_term_string%7D',{redirect:'manual',signal:AbortSignal.timeout(20000)});
assert.equal(oldSearch.status,200,'Historical search query');
const oldSearchHtml=await oldSearch.text();
assert.match(oldSearchHtml,/<link\b[^>]*rel="canonical"[^>]*href="https:\/\/flex-web\.fr\/"/,'Historical search canonical');
assert(!/SearchAction|search_term_string/.test(oldSearchHtml),'Fictitious search action restored');
console.log('OK historical search canonical');
