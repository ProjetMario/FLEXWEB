import assert from 'node:assert/strict';
import {mkdir, readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {chromium} from 'playwright';
import {defaultDirectory} from './inventory.mjs';
import {expectedLanguage} from '../../scripts/seo/recovery-language.mjs';

const input=process.argv[2];
if(!input)throw Error('Passer l’URL de l’aperçu Netlify ou de l’archive');
const target=new URL(input);
assert.equal(target.protocol,'https:');
const xmlOrigin='https://flex-web.fr';
const rows=(await readFile(join(defaultDirectory,'inventory.ndjson'),'utf8')).trimEnd().split('\n').map(line=>JSON.parse(line));
const paths=new Set(rows.map(r=>r.path));
const samples=new Map(), families=new Map();
for(const row of rows) {
  const family=row.sitemap.replace(/^\/sitemaps\/|-\d+\.xml$/g,'');
  if(!families.has(family)) families.set(family,[]);
  if(row.source==='archive') families.get(family).push(row.path);
}
for(const [family,group] of families) {
  assert.ok(group.length, family);
  samples.set(group[Math.floor(group.length/2)],family);
}
assert.equal(families.size,19);
for (const path of ['/entrepreneurs/guides/choisir-premier-site/','/entrepreneurs/metiers/electricien/','/de/anwendungen/ios/','/it/applicazioni/ios/']){
  assert.ok(paths.has(path));
  if(!samples.has(path)) samples.set(path,path.split('/')[1]);
}
const design = process.argv.includes('--design');
const viewports = design ? [390,768,1440] : [390,1440];
const reports=[],errors=[];
const browser=await chromium.launch();
const queue=[...samples].flatMap(([path,label])=>viewports.map(width=>({path,label,width})));
let next=0;
async function inspect({path,label,width}) {
  const context=await browser.newContext({viewport:{width,height:width===390?844:900},reducedMotion:'reduce',serviceWorkers:'block'});
  await context.route('**/*',route=>{
    const req=route.request(),u=new URL(req.url());
    if(!['GET','HEAD'].includes(req.method()) || /(^|\.)(google-analytics\.com|googletagmanager\.com|analytics\.google\.com|clarity\.ms|doubleclick\.net)$/.test(u.hostname)) return route.abort();
    return route.continue();
  });
  const page=await context.newPage();
  page.setDefaultTimeout(15000);
  const broken=new Set(), clientErrors=new Set();
  page.on('response',response=>{
    const url=new URL(response.url());
    if(url.origin===target.origin && response.status()>=400)broken.add(response.status()+' '+url.pathname);
  });
  page.on('pageerror',e=>clientErrors.add(e.message));
  try{
    const resp=await page.goto(target.origin+path,{waitUntil:'load',timeout:45000});
    assert.equal(resp.status(),200);
    assert.equal(new URL(page.url()).pathname,path);
    const report=await page.evaluate(async ()=>{
      await document.fonts.ready;
      const main=document.querySelector('main')||document.body;
      const heading=document.querySelector('h1');
      const visible=el=>el.getClientRects().length>0 && getComputedStyle(el).visibility!=='hidden';
      const links=[...main.querySelectorAll('a[href]')].filter(a=>{
        const href=a.getAttribute('href');
        return visible(a) && href.startsWith('/') && !href.startsWith('//') && !href.includes('#') && !href.includes('?');
      }).map(a=>a.getAttribute('href'));
      const missingImages=[...document.images].filter(img=>img.src && visible(img) && img.getBoundingClientRect().top<innerHeight && img.complete && !img.naturalWidth).map(img=>img.src);
      return {studio:getComputedStyle(document.documentElement).getPropertyValue('--flex-studio-release').trim(),h1:heading?.textContent.trim(),h1Count:document.querySelectorAll('h1').length,h1Visible:heading&&visible(heading),
        title:document.title,description:document.querySelector('meta[name="description"]')?.content,
        lang:document.documentElement.lang,canonical:document.querySelector('link[rel="canonical"]')?.href,
        robots:document.querySelector('meta[name="robots"]')?.content||'',
        bodyText:main.innerText.trim().length,scrollWidth:document.documentElement.scrollWidth,links,missingImages};
    });
    if (design) assert.equal(report.studio,'atelier-1',path);
    assert.equal(report.h1Count,1); assert.ok(report.h1&&report.h1Visible);
    assert.ok(report.bodyText>=50 && report.title?.trim() && report.description?.trim(),'Texte ou métadonnées manquantes');
    assert.equal(report.canonical,xmlOrigin+path); assert.equal(report.lang,expectedLanguage(path));
    assert.doesNotMatch(report.robots,/\b(?:noindex|none)\b/i);
    assert.ok(report.scrollWidth<=width+1, 'Débordement horizontal : '+report.scrollWidth+' pour '+width);
    assert.deepEqual(report.missingImages,[]);
    const link=report.links.find(v=>v!=='/'&& v!=='/en/' && v!==path && paths.has(v));
    assert.ok(link,'Lien visible vers le catalogue absent');
    // Exercise a real navigation without interacting with any lead form.
    const destination=target.origin+link;
    const [navigated]=await Promise.all([
      page.waitForNavigation({waitUntil:'load',timeout:30000}),
      page.evaluate(href=>[...document.querySelectorAll('main a[href], body a[href]')].find(a=>a.getAttribute('href')===href&&a.getClientRects().length).click(),link),
    ]);
    assert.equal(navigated?.status(),200,destination); assert.equal(new URL(page.url()).pathname,link);
    assert.ok(await page.locator('h1').first().isVisible(),destination);
    assert.deepEqual([...broken],[]); assert.deepEqual([...clientErrors],[]);
    reports.push({path,family:label,width,lang:report.lang,title:report.title,navigation:link});
  }catch(err){
    errors.push({path,family:label,width,message:err.message,resources:[...broken],jsErrors:[...clientErrors]});
  }finally{await context.close();}
}
try{
  await Promise.all(Array.from({length:3},async()=>{while(next<queue.length)await inspect(queue[next++]);}));
}finally{await browser.close();}
const langs=[...new Set(reports.map(r=>r.lang))].sort();
const id=target.hostname.split('--')[0];
const summary={origin:target.origin,finishedAt:new Date().toISOString(),families:families.size,pages:samples.size,viewports,languages:langs,passed:reports.length,reports,errors};
const output = design ? join(defaultDirectory,'..','redesign','qa','families') : join(defaultDirectory,'browser');
await mkdir(output,{recursive:true});
await writeFile(join(output,id+'.json'),JSON.stringify(summary,null,2)+'\n');
console.log(target.origin, '—', reports.length+'/'+queue.length, 'affichages et navigations réussis pour',families.size,'familles ; langues :',langs.join(', '));
if(errors.length)console.error(JSON.stringify(errors.slice(0,12)));
assert.equal(errors.length,0);
assert.deepEqual(langs,['de','en','fr','it']);
