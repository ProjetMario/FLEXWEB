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
];
test('France and Switzerland project drafts are readable and use the correct request path', {skip:process.env.FLEXWEB_FR_CH_EXPANSION!=='1'}, async()=>{
 const browser=await chromium.launch({headless:true});await mkdir('.cms/geo-smoke',{recursive:true});
 try{
  for(const width of [375,1440]){
   const context=await browser.newContext({viewport:{width,height:900}});
   await context.addInitScript(()=>localStorage.setItem('flex-web-cookie-consent','refused'));
   await context.route('**/*',r=>new URL(r.request().url()).origin===origin.origin&&!new URL(r.request().url()).pathname.startsWith('/api/')?r.continue():r.abort());
   const page=await context.newPage();
   for(const [route,expected] of cases){
    const response=await page.goto(new URL(route,origin).href);assert.equal(response.status(),200,route);
    assert.equal(await page.locator('h1').count(),1,route);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,`${route} ${width}`);
    assert.match(await page.locator('meta[name="robots"]').getAttribute('content'),/noindex/);
    const cta=page.locator('main a.action').first();assert((await cta.getAttribute('href')).startsWith(expected),route);
    await cta.focus();assert.equal(await cta.evaluate(e=>e===document.activeElement),true,route);
    const faq=page.locator('details').first();await faq.locator('summary').click();assert.equal(await faq.getAttribute('open'),'');
    if(route.includes('particuliers/geneve'))await page.screenshot({path:`.cms/geo-smoke/fr-ch-geneve-particulier-${width}.png`,fullPage:true});
   }
   for(const route of ['/projets-sites/','/projets-sites/fr/page/1/','/projets-sites/ch/page/1/'])assert.equal((await page.goto(new URL(route,origin).href)).status(),200,route);
   await context.close();
  }
 } finally {await browser.close();}
});
