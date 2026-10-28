import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'parse5';
import { readSitemap } from '../seo/read-sitemap.mjs';
const root = path.resolve('dist'), origin = 'https://flex-web.fr';
const pairs = [
  ['/guides/preparer-projet-site-internet/', '/en/guides/website-project-brief/'], ['/guides/preparer-projet-application-mobile/', '/en/guides/application-project-brief/'],
  ['/creation-site-internet/', '/en/websites/'], ['/creation-application-mobile/', '/en/applications/'],
  ['/', '/en/'], ['/about/', '/en/about/'], ['/automatisation-ia/', '/en/ai-automation/'],
  ['/crm-automatisation-entreprise/', '/en/crm/'], ['/pricing/', '/en/pricing/'], ['/contact/', '/en/contact/'],
  ['/journal/connecter-demandes-crm/', '/en/guides/website-enquiries-to-crm/'],
  ['/ressources/automatisation/relance-devis/', '/en/guides/quote-follow-up/'],
  ['/journal/assistant-ia-interne-entreprise/', '/en/guides/internal-ai-assistant/'],
];
const newFrenchGuides = ['/guides/preparer-projet-site-internet/','/guides/preparer-projet-application-mobile/'];
const newRoutes = ['/crm-automatisation-entreprise/', ...pairs.map(pair=>pair[1]), ...newFrenchGuides];
const attribute = (node, name) => node.attrs?.find(a=>a.name===name)?.value;
function nodes(node) { return [node,...(node.childNodes||[]).flatMap(nodes)]; }
function plain(node) { return node.nodeName==='#text' ? node.value : ['script','style'].includes(node.tagName) ? '' : (node.childNodes||[]).map(plain).join(' '); }
const normalize = text => text.replace(/\s+/g,' ').trim();
const htmlPath = route => path.join(root, route, 'index.html');
const titles = new Set(), descriptions = new Set();
for (const pair of pairs) for (const route of pair) {
  const html = await readFile(htmlPath(route),'utf8'), document = parse(html), all = nodes(document);
  assert.equal(all.filter(n=>n.tagName==='h1').length,1,`${route}: H1`);
  const canonical = all.filter(n=>n.tagName==='link'&&attribute(n,'rel')==='canonical');
  assert.deepEqual(canonical.map(n=>attribute(n,'href')),[origin+route],`${route}: canonical`);
  const alternates = all.filter(n=>n.tagName==='link'&&attribute(n,'hreflang'));
  const expected = {fr:origin+pair[0],en:origin+pair[1],...(pair[0]==='/creation-application-mobile/'?{de:origin+'/de/anwendungen/',it:origin+'/it/applicazioni/'}:{}),'x-default':origin+pair[0]};
  assert.deepEqual(Object.fromEntries(alternates.map(n=>[attribute(n,'hreflang'),attribute(n,'href')])),expected,`${route}: reciprocal alternates`);
  assert.equal(attribute(all.find(n=>n.tagName==='html'),'lang'),route.startsWith('/en/')?'en':'fr');
  assert(!/noindex/.test(attribute(all.find(n=>n.tagName==='meta'&&attribute(n,'name')==='robots'),'content')||''));
  for (const name of ['og:title','og:description','og:url','og:image','og:image:alt','twitter:card','twitter:title','twitter:description','twitter:image']) {
    assert(all.some(n=>n.tagName==='meta'&&(attribute(n,'property')===name||attribute(n,'name')===name)&&attribute(n,'content')),`${route}: ${name}`);
  }
  const schemas = all.filter(n=>n.tagName==='script'&&attribute(n,'type')==='application/ld+json').flatMap(n=>{const data=JSON.parse(n.childNodes.map(x=>x.value||'').join('')); return data['@graph']||[data];});
  assert(schemas.some(s=>s['@type']==='ProfessionalService'),`${route}: identity`);
  assert(schemas.some(s=>s['@type']==='WebSite'),`${route}: website`);
  const bodyText = normalize(plain(all.find(n=>n.tagName==='main')));
  for (const schema of schemas.filter(s=>s['@type']==='FAQPage')) for (const question of schema.mainEntity) {
    assert(bodyText.includes(normalize(question.name)),`${route}: visible FAQ question`);
    assert(bodyText.includes(normalize(question.acceptedAnswer.text)),`${route}: visible FAQ answer`);
  }
  if (newRoutes.includes(route)) {
    const title = normalize(plain(all.find(n=>n.tagName==='title')));
    const description = attribute(all.find(n=>n.tagName==='meta'&&attribute(n,'name')==='description'),'content');
    assert(!titles.has(title),`${route}: unique title`); titles.add(title);
    assert(description&&!descriptions.has(description),`${route}: unique description`); descriptions.add(description);
    assert(all.filter(n=>n.tagName==='h2').length>=3,`${route}: useful headings`);
    for (const link of all.filter(n=>n.tagName==='a'&&attribute(n,'href'))) {
      const url=new URL(attribute(link,'href'),origin+route);
      if(url.origin!==origin)continue;
      await access(htmlPath(url.pathname)).catch(()=>assert.fail(`${route}: missing internal target ${url.pathname}`));
    }
    if(route.includes('/guides/'))assert(schemas.some(s=>s['@type']==='Article'),`${route}: article`);
    if(['/en/crm/','/en/ai-automation/','/crm-automatisation-entreprise/','/en/websites/','/en/applications/'].includes(route))assert(schemas.some(s=>s['@type']==='Service'),`${route}: service`);
  }
}
const urls = await readSitemap(origin+'/sitemap.xml',url=>readFile(path.join(root,new URL(url).pathname),'utf8'));
assert.equal(new Set(urls).size,urls.length,'Duplicate sitemap URL');
for(const route of newRoutes)assert(urls.includes(origin+route),`Missing ${route} from sitemap`);
for(const url of urls)assert(!/\/(?:api|admin|espace-projet|demarrer)\/|\.xml$|^\/404(?:\.html|\/|$)/.test(new URL(url).pathname),`Private or non-content sitemap entry: ${url}`);
if(process.env.GEO_BASELINE_FILE){
  const baseline=JSON.parse(await readFile(process.env.GEO_BASELINE_FILE,'utf8'));
  assert(Array.isArray(baseline));
  assert.deepEqual(baseline.filter(url=>!urls.includes(url)),[],'Existing sitemap URLs removed');
  console.log(JSON.stringify({baselineUrls:baseline.length,preserved:baseline.length,added:urls.filter(url=>!baseline.includes(url)).length}));
}
for(const file of ['llms.txt','llms-full.txt']) {
  const summary=await readFile(path.join(root,file),'utf8');
  for(const text of ['Fleximmo','Voglans','contact@flex-web.fr','2026-10-28','/en/crm/','/crm-automatisation-entreprise/'])assert(summary.includes(text),`${file}: ${text}`);
  for(const match of summary.matchAll(/https:\/\/flex-web\.fr([^\s)]+)/g))await access(htmlPath(new URL(match[0]).pathname));
}
const robots=await readFile(path.join(root,'robots.txt'),'utf8');
assert.match(robots,/User-agent: \*\s+Allow: \/\s+Disallow: \/api\//);
assert.match(robots,/Sitemap: https:\/\/flex-web.fr\/sitemap.xml/);
assert(!/^Disallow:\s*\/$/m.test(robots));
console.log(JSON.stringify({status:'passed',pairedPages:pairs.length*2,newPages:newRoutes.length,sitemapUrls:urls.length}));
