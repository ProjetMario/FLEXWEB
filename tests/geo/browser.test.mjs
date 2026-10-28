import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const preview = new URL(process.env.FLEXWEB_TEST_URL || 'http://127.0.0.1:4321');
if (!['127.0.0.1','localhost'].includes(preview.hostname)) throw new Error('Local mocked browser tests only');
const routes = ['/creation-site-internet/','/creation-application-mobile/','/en/websites/','/en/applications/','/en/guides/website-project-brief/','/en/guides/application-project-brief/','/crm-automatisation-entreprise/','/automatisation-ia/','/en/','/en/crm/','/en/ai-automation/','/en/pricing/','/en/contact/','/en/about/','/en/guides/website-enquiries-to-crm/','/en/guides/quote-follow-up/','/en/guides/internal-ai-assistant/'];
const launch = () => chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL ? {channel:process.env.PLAYWRIGHT_CHANNEL} : {})});
const blockExternal = context => context.route('**/*',route=>new URL(route.request().url()).origin===preview.origin&&!new URL(route.request().url()).pathname.startsWith('/api/') ? route.continue():route.abort());

test('CRM and English pages remain readable on mobile, tablet and desktop',async()=>{
 const browser=await launch();
 await mkdir('.cms/geo-smoke',{recursive:true});
 try {
  for(const width of [375,768,1440]){
   const context=await browser.newContext({viewport:{width,height:900}});
   await blockExternal(context);
   await context.addInitScript(()=>localStorage.setItem('flex-web-cookie-consent','refused'));
   const page=await context.newPage();
   for(const route of routes){
    const response=await page.goto(new URL(route,preview).href);
    assert.equal(response.status(),200,route);
    assert.equal(await page.locator('h1').count(),1,route);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,`${width} ${route}`);
    assert.equal(await page.locator('html').getAttribute('lang'),route.startsWith('/en/')?'en':'fr');
    assert.equal(await page.locator('link[rel=canonical]').getAttribute('href'),'https://flex-web.fr'+route);
    const cta=page.locator('a[data-conversion-event="quote_click"]').first();
    if(route==='/en/websites/' || route==='/en/guides/website-project-brief/') assert.equal(await cta.getAttribute('data-conversion-service'),'site');
    if(route==='/en/applications/' || route==='/en/guides/application-project-brief/') assert.equal(await cta.getAttribute('data-conversion-service'),'application');
    if(route==='/en/contact/') assert.equal(await cta.getAttribute('data-conversion-service'),'unknown');
    await cta.focus();assert.equal(await cta.evaluate(e=>e===document.activeElement),true);
    const faq=page.locator('details').first();if(await faq.count()){await faq.locator('summary').click();assert.equal(await faq.getAttribute('open'),'');}
    if(['/en/crm/','/crm-automatisation-entreprise/'].includes(route))await page.screenshot({path:`.cms/geo-smoke/${route.split('/').filter(Boolean).join('-')}-${width}.png`,fullPage:true});
   }
   if(width===375){
    await page.goto(new URL('/en/crm/',preview).href);
    await page.getByRole('button',{name:'Open menu'}).click();
    await page.locator('#mobile-navigation').waitFor({state:'visible'});
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('button',{name:'Open menu'}).getAttribute('aria-expanded'),'false');
   }
   await context.close();
  }
 } finally {await browser.close();}
});

test('AI attribution starts only after consent, survives navigation and is removed on refusal',async()=>{
 const browser=await launch();const context=await browser.newContext();await blockExternal(context);
 try{
  const page=await context.newPage();
  await page.goto(new URL('/en/crm/?utm_source=chatgpt.com&secret=not-recorded',preview).href);
  await page.getByRole('button',{name:'Accept',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('flexweb-acquisition-v1')),null);
  assert.equal(await page.locator('script[src*="googletagmanager"]').count(),0);
  await page.getByRole('button',{name:'Accept',exact:true}).click();
  await page.waitForFunction(()=>sessionStorage.getItem('flexweb-acquisition-v1'));
  let attribution=JSON.parse(await page.evaluate(()=>sessionStorage.getItem('flexweb-acquisition-v1')));
  assert.equal(attribution.aiSource,'chatgpt');assert.equal(attribution.landing,'/en/crm/');assert.doesNotMatch(JSON.stringify(attribution),/secret|utm_source|not-recorded/);
  await page.getByRole('link',{name:'Discuss your project ↗',exact:true}).first().click();
  await page.waitForURL('**/en/contact/');
  attribution=JSON.parse(await page.evaluate(()=>sessionStorage.getItem('flexweb-acquisition-v1')));assert.equal(attribution.landing,'/en/crm/');
  await page.getByRole('button',{name:'Cookie settings'}).click();
  await page.getByRole('button',{name:'Decline',exact:true}).click();
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('flexweb-acquisition-v1')),null);
  const recorded=await page.evaluate(()=>Array.from(window.dataLayer||[]).map(x=>Array.from(x)));
  assert.doesNotMatch(JSON.stringify(recorded),/not-recorded|utm_source|secret/);
 }finally{await context.close();await browser.close();}
});
