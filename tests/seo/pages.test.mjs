import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
test('new realization pages fit mobile, tablet and desktop with usable links', async()=>{
 const browser=await chromium.launch();
 try {
 for(const width of [375,768,1440]) {
 const context=await browser.newContext({viewport:{width,height:900}});
 await context.addInitScript(()=>localStorage.setItem('flex-web-cookie-consent','refused'));
 await context.route('**/*',r=>new URL(r.request().url()).origin === 'http://127.0.0.1:4321' ? r.continue() : r.abort());
 const page=await context.newPage();
 for(const path of ['realisations/','realisations/foot-nation/','realisations/2savoie-immo/','realisations/serrurier73/']) {
 await page.goto('http://127.0.0.1:4321/'+path);await page.locator('h1').waitFor();
 assert.equal(await page.locator('h1').count(),1);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth),true,`${path} ${width}: overflow`);
 const link=page.getByRole('link',{name:'Demander un devis',exact:true}).last();await link.focus();assert.equal(await link.evaluate(e=>e===document.activeElement),true);
 await page.screenshot({path:`outputs/seo-2026-09/${path.replaceAll('/','-')}${width}.png`,fullPage:true});
 }
 await context.close();
 }
 } finally {await browser.close();}
});
