import assert from 'node:assert/strict';
import {test} from 'node:test';
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
const origin=new URL(process.env.FLEXWEB_TEST_URL || 'http://127.0.0.1:4321');
if(!['127.0.0.1','localhost'].includes(origin.hostname))throw Error('Local preview required');
const cases=[
 ['/projets-sites/particuliers/paris-fr-75056/','mailto:'],
 ['/projets-sites/entreprises/paris-fr-75056/','/demarrer/?service=site'],
 ['/projets-sites/particuliers/geneve-ch-6621/','mailto:'],
 ['/projets-sites/entreprises/geneve-ch-6621/','mailto:'],
 ['/projets-sites/entreprises/montalieu-vercieu-fr-38247/','/demarrer/?service=site'],
 ['/projets-sites/particuliers/zurich-ch-261/','mailto:','de'],
 ['/projets-sites/entreprises/lugano-ch-5192/','mailto:','it'],
 ['/projets-sites/suisse/fr/particuliers/zurich-ch-261/','mailto:','fr'],
 ['/projets-sites/suisse/it/particuliers/zurich-ch-261/','mailto:','it'],
 ['/projets-sites/suisse/de/entreprises/geneve-ch-6621/','mailto:','de'],
];
test('France and Switzerland project drafts are readable and use the correct request path', {skip:process.env.FLEXWEB_FR_CH_EXPANSION!=='1'}, async()=>{
 const browser=await chromium.launch({headless:true});await mkdir('.cms/geo-smoke',{recursive:true});
 try{
  for(const width of [375,1440]){
   const context=await browser.newContext({viewport:{width,height:900}});
   await context.addInitScript(()=>localStorage.setItem('flex-web-cookie-consent','refused'));
   await context.route('**/*',r=>new URL(r.request().url()).origin===origin.origin&&!new URL(r.request().url()).pathname.startsWith('/api/')?r.continue():r.abort());
   const page=await context.newPage();
   for(const [route,expected,language="fr"] of cases){
    const response=await page.goto(new URL(route,origin).href);assert.equal(response.status(),200,route);
    assert.equal(await page.locator('h1').count(),1,route);
    assert.equal(await page.locator('html').getAttribute('lang'),language,route);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,`${route} ${width}`);
    assert.match(await page.locator('meta[name="robots"]').getAttribute('content'),/noindex/);
    const cta=page.locator('main a.action').first();assert((await cta.getAttribute('href')).startsWith(expected),route);
    await cta.focus();assert.equal(await cta.evaluate(e=>e===document.activeElement),true,route);
    if(route.includes('montalieu')){assert.match(await page.locator('main').innerText(),/38390 correspond à 7 communes/);assert(await page.locator('a[href="/territoires/sites/montalieu-vercieu-38247/"]').count());}
    if(route.includes('-ch-')){
      assert.equal(await page.locator('main nav.swiss-languages a').count(),3);
      const text=await page.locator('main').innerText();assert.match(text,language==='de'?/Französisch und Englisch/:language==='it'?/francese e inglese/:/français et en anglais/);
      if(route.includes('geneve')&&language==='de')assert.equal(await page.locator('main li').filter({hasText:'Sprachregion laut Quelle'}).innerText(),'Sprachregion laut Quelle : Französisch');
      if(route.includes('zurich')&&language==='it')assert.equal(await page.locator('main li').filter({hasText:'Regione linguistica secondo la fonte'}).innerText(),'Regione linguistica secondo la fonte : Tedesco');
    }
    const faq=page.locator('details').first();await faq.locator('summary').click();assert.equal(await faq.getAttribute('open'),'');
    if(route.includes('particuliers/geneve'))await page.screenshot({path:`.cms/geo-smoke/fr-ch-geneve-particulier-${width}.png`,fullPage:true});
   }
   if(width===375){
    await page.goto(new URL('/projets-sites/particuliers/zurich-ch-261/',origin).href);
    await page.getByRole('button',{name:'Menü öffnen',exact:true}).click();
    const menu=page.locator('#mobile-navigation');await menu.waitFor({state:'visible'});
    assert((await menu.getByRole('link',{name:'Offerte anfragen ↗'}).getAttribute('href')).startsWith('mailto:'));
    await page.keyboard.press('Escape');assert.equal(await page.getByRole('button',{name:'Menü öffnen',exact:true}).getAttribute('aria-expanded'),'false');
   }
   await page.goto(new URL('/projets-sites/particuliers/geneve-ch-6621/',origin).href);
   await page.locator('main nav.swiss-languages a[lang="de"]').click();assert.equal(await page.locator('html').getAttribute('lang'),'de');
   await page.locator('main nav.swiss-languages a[lang="it"]').click();assert.equal(await page.locator('html').getAttribute('lang'),'it');
   await page.locator('main nav.swiss-languages a[lang="fr"]').click();assert.equal(new URL(page.url()).pathname,'/projets-sites/particuliers/geneve-ch-6621/');
   for(const route of ['/projets-sites/','/projets-sites/fr/page/1/','/projets-sites/ch/page/1/'])assert.equal((await page.goto(new URL(route,origin).href)).status(),200,route);
   await context.close();
  }
 } finally {await browser.close();}
});

test('consented AI attribution stores only territory code and email click is not a confirmed lead', {skip:process.env.FLEXWEB_FR_CH_EXPANSION!=='1'}, async()=>{
 const browser=await chromium.launch({headless:true});const context=await browser.newContext();
 try{
  await context.route('**/*',r=>new URL(r.request().url()).origin===origin.origin?r.continue():r.abort());
  await context.addInitScript(()=>document.addEventListener('click',event=>{if(event.target instanceof Element&&event.target.closest('a[href^="mailto:"]'))event.preventDefault();},true));
  const page=await context.newPage();
  await page.goto(new URL('/projets-sites/particuliers/zurich-ch-261/?utm_source=chatgpt&secret=do-not-store',origin).href);
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('flexweb-acquisition-v1')),null);
  await page.getByRole('button',{name:'Akzeptieren',exact:true}).click();
  await page.waitForFunction(()=>sessionStorage.getItem('flexweb-acquisition-v1'));
  const raw=await page.evaluate(()=>sessionStorage.getItem('flexweb-acquisition-v1'));
  const saved=JSON.parse(raw);assert.equal(saved.landing,'territoire:CH:261:particuliers');assert.equal(saved.language,'de');assert.equal(saved.aiSource,'chatgpt');assert.doesNotMatch(raw,/zurich|secret|utm_source/);
  await page.waitForLoadState('networkidle');await page.locator('main a.action').first().click();
  await page.waitForFunction(()=>Array.from(window.dataLayer||[]).some(e=>e[0]==='event'&&e[1]==='quote_click'));
  const events=await page.evaluate(()=>Array.from(window.dataLayer||[]).map(e=>Array.from(e)));
  const click=events.find(e=>e[0]==='event'&&e[1]==='quote_click');assert.equal(click[2].service_type,'site');assert.equal(click[2].ai_source,'chatgpt');assert.equal(click[2].landing_language,'de');
  assert(!events.some(e=>e[0]==='event'&&e[1]==='generate_lead'));assert.doesNotMatch(JSON.stringify(events),/do-not-store|utm_source|secret/);
  await page.getByRole('button',{name:'Cookie-Einstellungen',exact:true}).click();await page.getByRole('button',{name:'Ablehnen',exact:true}).click();
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('flexweb-acquisition-v1')),null);
 }finally{await context.close();await browser.close();}
});
