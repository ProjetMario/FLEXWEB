import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const preview=new URL(process.env.FLEXWEB_TEST_URL||'http://127.0.0.1:4321');
if(!['127.0.0.1','localhost'].includes(preview.hostname))throw Error('Use a local preview only');
const routes=[
 ['/territoires/automatisation/locronan-29134/','fr'],
 ['/territoires/sites/brailly-cornehotte-80133/','fr'],
 ['/territoires/applications/beuvry-la-foret-59080/','fr'],
 ['/territoires/crm/lezennes-59346/','fr'],
 ['/en/locations/crm/grenoble-38185/','en'],
 ['/en/locations/ai-automation/brezins-38058/','en'],
 ['/communes-france/','fr'],
 ['/application-metier-sur-mesure/','fr'],
];
test('recovered routes render accessible metadata and complete HTML on mobile and desktop',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const width of [390,1440]){
   const context=await browser.newContext({viewport:{width,height:850}});
   await context.route('**/*',request=>{const url=new URL(request.request().url());if(url.origin!==preview.origin||url.pathname.startsWith('/api/'))return request.abort();return request.continue();});
   for(const [route,language] of routes){
    const page=await context.newPage();const response=await page.goto(new URL(route,preview).href,{waitUntil:'domcontentloaded'});
    assert.equal(response.status(),200,route);assert.equal(await page.locator('h1').count(),1,route);
    assert.equal(await page.locator('html').getAttribute('lang'),language,route);
    assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'),'https://flex-web.fr'+route,route);
    assert(!/noindex/i.test(await page.locator('meta[name="robots"]').getAttribute('content')),route);
    assert(await page.locator('main').count(),route+': missing main');
    assert(await page.locator('body').evaluate(el=>el.innerHTML.includes('cookie')||el.innerText.length>100),route);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),route+' overflows at '+width+'px');
    await page.close();
   }
   await context.close();
  }
 }finally{await browser.close();}
});

test('contact clicks on a recovered English page stay distinct from a received enquiry and respect consent',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const consent of ['accepted','rejected']){
   const context=await browser.newContext({viewport:{width:390,height:850}});
   await context.route('**/*',request=>new URL(request.request().url()).origin===preview.origin?request.continue():request.abort());
   await context.addInitScript(value=>{localStorage.setItem('flex-web-cookie-consent',value);document.addEventListener('click',event=>event.preventDefault(),true);},consent);
   const page=await context.newPage();await page.goto(new URL('/en/locations/crm/grenoble-38185/',preview).href,{waitUntil:'load'});
   await page.locator('a[data-conversion-event="email_click"]').dispatchEvent('click');
   await page.locator('a[data-conversion-event="phone_click"]').dispatchEvent('click');
   const names=await page.evaluate(()=>Array.from(window.dataLayer||[]).map(event=>event[1]));
   if(consent==='accepted'){assert(names.includes('email_click'));assert(names.includes('phone_click'));}
   else {assert(!names.includes('email_click'));assert(!names.includes('phone_click'));}
   assert(!names.includes('generate_lead'),'A click must never count as a received enquiry');
   await context.close();
  }
 }finally{await browser.close();}
});
