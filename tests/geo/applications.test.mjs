import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const origin=new URL(process.env.FLEXWEB_TEST_URL||'http://127.0.0.1:4321');
if(!['localhost','127.0.0.1'].includes(origin.hostname))throw new Error('Local preview required');
const routes=[['/applications/ios/','fr'],['/en/applications/android/','en'],['/de/anwendungen/privatpersonen/','de'],['/it/applicazioni/aziende/','it']];
test('application pages remain usable on mobile and desktop in four languages',async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.FLEXWEB_CHROME_PATH?{executablePath:process.env.FLEXWEB_CHROME_PATH}:{})});
 try {for(const width of [375,1440]){
  const context=await browser.newContext({viewport:{width,height:900}});
  await context.addInitScript(()=>localStorage.setItem('flex-web-cookie-consent','refused'));
  await context.route('**/*',route=>new URL(route.request().url()).origin===origin.origin?route.continue():route.abort());
  const page=await context.newPage();
  for(const [path,lang] of routes){
   const response=await page.goto(new URL(path,origin).href);assert.equal(response.status(),200,path);
   assert.equal(await page.locator('html').getAttribute('lang'),lang);
   assert.equal(await page.locator('main h1').count(),1);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,path+' '+width);
   assert.equal(await page.locator('main nav.app-languages a').count(),4);
   assert((await page.locator('main a[href^="mailto:"]').count())>0);
   assert((await page.locator('main a[href^="tel:"]').count())>0);
   const faq=page.locator('main details').first();await faq.locator('summary').click();assert.equal(await faq.getAttribute('open'),'');
  }
  await context.close();
 }}finally{await browser.close();}
});
test('email and phone clicks are separate consented events, not confirmed leads',async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.FLEXWEB_CHROME_PATH?{executablePath:process.env.FLEXWEB_CHROME_PATH}:{})});const context=await browser.newContext();
 try {
  await context.route('**/*',route=>new URL(route.request().url()).origin===origin.origin?route.continue():route.abort());
  await context.addInitScript(()=>{localStorage.setItem('flex-web-cookie-consent','accepted');document.addEventListener('click',e=>{if(e.target instanceof Element&&e.target.closest('a[href^="mailto:"],a[href^="tel:"]'))e.preventDefault();});});
  const page=await context.newPage();await page.goto(new URL('/de/anwendungen/privatpersonen/?utm_source=chatgpt.com',origin).href);
  await page.waitForFunction(()=>!!sessionStorage.getItem('flexweb-acquisition-v1'));
  const attribution=JSON.parse(await page.evaluate(()=>sessionStorage.getItem('flexweb-acquisition-v1')));
  assert.equal(attribution.language,'de');assert.equal(attribution.aiSource,'chatgpt');
  await page.locator('main a[data-conversion-event="email_click"]').first().click();
  await page.locator('main a[data-conversion-event="phone_click"]').first().click();
  const events=await page.evaluate(()=>Array.from(window.dataLayer||[]).map(x=>Array.from(x)));
  assert(events.some(x=>x[1]==='email_click'));assert(events.some(x=>x[1]==='phone_click'));assert(!events.some(x=>x[1]==='generate_lead'));
 }finally{await context.close();await browser.close();}
});
