import assert from 'node:assert/strict';
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {draftData,draftEntries,draftGroups,draftPath,draftHubPath} from '../../src/lib/seo/territorial-drafts.mjs';
import {territoryDepartments} from '../../src/lib/seo/territorial-directory.mjs';
import {readSitemap} from './read-sitemap.mjs';

const root=path.resolve('dist'),origin='https://flex-web.fr';
const htmlAt=route=>readFile(path.join(root,route,'index.html'),'utf8');
const decode=value=>value.replaceAll('&amp;','&').replaceAll('&#39;',"'").replaceAll('&quot;','"').replace(/&#(x[0-9a-f]+|\d+);/gi,(_,n)=>String.fromCodePoint(n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n)));
const anchors=html=>[...html.matchAll(/<a\b([^>]*?)href="([^"]+)"([^>]*)>/g)].map(match=>({href:decode(match[2]),follow:!/\brel="[^"]*\bnofollow\b/.test(match[1]+match[3])}));
const localLinks=(html,route)=>anchors(html).filter(a=>a.follow).map(a=>new URL(a.href,origin+route)).filter(u=>u.origin===origin).map(u=>u.pathname);
function assertIndexable(html,route){
 const robots=[...html.matchAll(/<meta\b[^>]*name="robots"[^>]*content="([^"]+)"/g)].map(m=>m[1]);
 assert(robots.length===1&&/\bindex\b/.test(robots[0])&&!/\bnoindex\b/.test(robots[0]),`Public robots: ${route}`);
 assert.deepEqual([...html.matchAll(/<link\b[^>]*rel="canonical"[^>]*href="([^"]+)"/g)].map(m=>m[1]),[origin+route],`Self canonical: ${route}`);
 assert.equal([...html.matchAll(/<h1(?:\s|>)/g)].length,1,`Single h1: ${route}`);
}

const entries=draftEntries(),departments=territoryDepartments(),groups=draftGroups();
assert.equal(entries.length,19988,'The authorized territorial catalogue must retain all 19,988 pages');
assert.equal(draftData().communes.length,9994);
const expected=new Set(entries.map(e=>draftPath(e.axis,e.commune)));
assert.equal(expected.size,entries.length,'Unique axis / INSEE paths');
const sitemap=await readSitemap(origin+'/sitemap.xml',url=>readFile(path.join(root,new URL(url).pathname),'utf8'));
const sitemapRoutes=new Set(sitemap.map(url=>new URL(url).pathname));
assert.equal(sitemap.length,sitemapRoutes.size,'Duplicate sitemap entries');
assert(!sitemap.some(url=>new URL(url).pathname.startsWith('/preparation/')),'Preparation URL in public sitemap');
const actual=sitemap.filter(url=>/^\/territoires\/(sites|automatisation)\/[^/]+\/$/.test(new URL(url).pathname)).map(url=>new URL(url).pathname);
assert.deepEqual([...actual].sort(),[...expected].sort(),'Exact territorial sitemap membership');

// Prove a static HTML route from the homepage through navigation to every leaf.
// This is independent of search JavaScript, sitemap discovery and API calls.
const navigation=new Map(),navigationRoutes=['/','/territoires/',...groups.map(g=>draftHubPath(g.axis,g.page)),...departments.map(d=>`/territoires/departements/${d.code.toLowerCase()}/`)];
for(const route of navigationRoutes){
 const html=await htmlAt(route);assertIndexable(html,route);
 if(route!=='/')assert(sitemapRoutes.has(route),`Navigation missing from sitemap: ${route}`);
 navigation.set(route,new Set(localLinks(html,route)));
}
const reached=new Set(['/']),queue=['/'];
for(let i=0;i<queue.length;i++)for(const route of navigation.get(queue[i])??[]){
 if((navigation.has(route)||expected.has(route))&&!reached.has(route)){reached.add(route);queue.push(route);}
}
for(const route of expected)assert(reached.has(route),`Territorial page unreachable through HTML navigation: ${route}`);

const prices=JSON.parse(await readFile('apps/saas-platform/lib/automation/public-quotes.json','utf8'));
let checkedLinks=0,peakRss=process.memoryUsage().rss;
for(const {axis,commune} of entries){
 const route=draftPath(axis,commune),html=await htmlAt(route);assertIndexable(html,route);
 for(const marker of ['<territory-planner','<project-guides','<territorial-brief','id="implementation-dossier"',`territory:${axis}:${commune.code}`])assert(html.includes(marker),`Missing ${marker}: ${route}`);
 assert(html.includes(`https://geo.api.gouv.fr/communes/${commune.code}`),`Missing official source: ${route}`);
 assert(!html.includes('href="/preparation/'),`Old preparation link on ${route}`);
 const text=decode(html.replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ');
 for(const offer of axis==='sites'?prices.websiteOffers:prices.automationOffers){
  const amount=String(offer.setupCents/100);assert(new RegExp(`\\b${amount}\\s*€\\s*TTC`).test(text),`Missing TTC offer ${amount}: ${route}`);
 }
 const hrefs=anchors(html).map(a=>new URL(a.href,origin+route));
 const requestedService=axis==='sites'?'site':'automation';
 assert(hrefs.some(u=>u.origin===origin&&u.pathname==='/demarrer/'&&u.searchParams.get('service')===requestedService),`Missing correctly selected ${requestedService} quote CTA: ${route}`);
 const backLinks=new Set(hrefs.filter(u=>u.origin===origin).map(u=>u.pathname));
 assert(backLinks.has(draftHubPath(axis)),`Missing axis breadcrumb: ${route}`);
 assert(backLinks.has(`/territoires/departements/${commune.departmentCode.toLowerCase()}/`),`Missing department breadcrumb: ${route}`);
 assert(backLinks.has(draftPath(axis==='sites'?'automatisation':'sites',commune)),`Missing alternate service link: ${route}`);
 checkedLinks+=hrefs.length;peakRss=Math.max(peakRss,process.memoryUsage().rss);
}

// Flat historic location pages keep their addresses; no broad redirect or
// migration into /territoires/ is implied by the new nested namespace.
const oldFiles=await readdir('src/content/locations'),historical=[];
for(const file of oldFiles.filter(f=>f.endsWith('.md'))){
 const body=await readFile(path.join('src/content/locations',file),'utf8');if(/^isDraft:\s*true\s*$/m.test(body))continue;
 const slug=body.match(/^slug:\s*["']?([^"'\r\n]+)/m)?.[1]?.trim();assert(slug,`Missing historic slug: ${file}`);
 const route=`/${slug}/`;assert(!expected.has(route),`Historic path collision: ${route}`);assert(sitemapRoutes.has(route),`Lost historical location: ${route}`);assertIndexable(await htmlAt(route),route);historical.push(route);
}
const robots=await readFile(path.join(root,'robots.txt'),'utf8');
assert(!/^Disallow:\s*\/(?:\s*$|territoires(?:\/|\*|\s*$))/im.test(robots),'robots.txt blocks territorial paths');
const report={generatedAt:new Date().toISOString(),territorialPages:entries.length,territorialPerAxis:Object.fromEntries(['sites','automatisation'].map(axis=>[axis,entries.filter(e=>e.axis===axis).length])),indexablePagesChecked:entries.length,historicalLocationsPreserved:historical.length,navigationPagesChecked:navigation.size,htmlReachableTerritorialPages:entries.length,sitemapUrls:sitemap.length,checkedLinks,peakRssBytes:peakRss,status:'passed',scope:'Static emitted files, canonical/meta robots, exact sitemap membership, HTML navigation, historic locations, official sources, tools and quote-selection contracts. Does not claim live HTTP status or search-engine indexation.'};
await mkdir('outputs/seo-national-20260924',{recursive:true});await writeFile('outputs/seo-national-20260924/territorial-publication-audit.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
