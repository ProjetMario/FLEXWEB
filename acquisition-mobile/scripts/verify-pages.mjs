import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mobilePages} from '../src/data/mobile.mjs';

const input = process.argv[2];
if (!input) throw new Error('Usage: node acquisition-mobile/scripts/verify-pages.mjs https://preview.example');
const base = new URL(input).origin;
const site = 'https://flex-web.fr';
const pages = mobilePages.concat([
  {path:'/realisations/footnation/',lang:'fr',kind:'Article'},
  {path:'/en/case-studies/footnation/',lang:'en',kind:'Article'},
]);
const browser = await chromium.launch();
const titles = new Set();
const descriptions = new Set();
const internalLinks = new Set();
const publicSources = new Set();
const jsErrors = [];

async function inspectPage(page, manifest, width) {
  const response = await page.goto(base + manifest.path);
  assert.equal(response.status(), 200, manifest.path);
  const result = await page.evaluate(() => {
    const one = selector => document.querySelector(selector);
    const all = selector => [...document.querySelectorAll(selector)];
    const graph = JSON.parse(one('script[type="application/ld+json"]').textContent)['@graph'];
    const image = one('.case img');
    return {
      h1Count:all('h1').length,
      h1Visible:one('h1').getBoundingClientRect().height > 0,
      width:document.documentElement.scrollWidth,
      language:document.documentElement.lang,
      title:document.title,
      description:one('meta[name="description"]').content,
      canonical:one('link[rel="canonical"]').href,
      robots:one('meta[name="robots"]')?.content ?? '',
      faq:graph.find(node=>node['@type']==='FAQPage')?.mainEntity.map(item=>[item.name,item.acceptedAnswer.text]),
      visibleFAQ:all('.faqs details').map(el=>[el.querySelector('summary').textContent,el.querySelector('p').textContent]),
      types:graph.map(node=>node['@type']),
      links:all('a[href]').map(a=>a.getAttribute('href')),
      alternates:Object.fromEntries(all('link[hreflang]').map(link=>[link.hreflang,link.href])),
      brokenAssets:performance.getEntriesByType('resource').filter(entry=>entry.responseStatus>=400).map(entry=>entry.name),
      caseMedia:image?.getAttribute('src'),
    };
  });
  const where = manifest.path + ' at ' + width + 'px';
  assert.equal(result.h1Count,1,where);
  assert.ok(result.h1Visible && result.title.length > 10 && result.description.length > 15,where);
  assert.equal(result.width,width,where);
  assert.equal(result.canonical,site + manifest.path,where);
  assert.equal(result.language,manifest.lang,where);
  assert.doesNotMatch(result.robots,/noindex/i,where);
  assert.deepEqual(result.brokenAssets,[],where);
  for(const type of ['WebPage','BreadcrumbList',manifest.kind]) assert.ok(result.types.includes(type),where + ' missing ' + type);
  if(manifest.faq) {
    assert.deepEqual(result.faq,result.visibleFAQ,where);
    assert.deepEqual(result.faq,manifest.faq,where);
  } else {
    assert.ok(result.caseMedia?.startsWith('/images/footnation/'),where);
  }
  if(manifest.alternates) {
    for(const [lang,route] of Object.entries(manifest.alternates)) assert.equal(result.alternates[lang],site + route,where);
  }
  assert.ok(result.links.includes('/demarrer/application/'),where);
  if(width===390) {
    assert.ok(!titles.has(result.title) && !descriptions.has(result.description),where);
    titles.add(result.title);
    descriptions.add(result.description);
    for(const link of result.links) {
      if(link.startsWith('/')) internalLinks.add(link);
      if(link.startsWith('https://')) publicSources.add(link);
    }
  }
}

async function testConsentAndQuoteClick() {
  const context = await browser.newContext({viewport:{width:390,height:844}});
  const page = await context.newPage();
  let analyticsLoads = 0;
  await context.route('https://www.googletagmanager.com/**', async route => {
    analyticsLoads++;
    await route.fulfill({contentType:'text/javascript',body:''});
  });
  await page.goto(base + '/applications/ios/');
  const privacy = page.getByRole('complementary',{name:'Gestion des cookies'});
  await privacy.waitFor();
  assert.equal(analyticsLoads,0);
  await page.getByRole('button',{name:'Je refuse'}).click();
  await privacy.waitFor({state:'hidden'});
  assert.equal(analyticsLoads,0);
  await page.getByRole('button',{name:'Gérer les cookies'}).click();
  await privacy.waitFor();
  const request = page.waitForRequest(req=>req.url().startsWith('https://www.googletagmanager.com/gtag/js'));
  await page.getByRole('button',{name:'J’accepte'}).click();
  await request;
  assert.equal(analyticsLoads,1);
  await page.evaluate(()=>{
    const link = document.querySelector('[data-conversion-event="quote_click"]');
    link.addEventListener('click',e=>e.preventDefault(),{once:true});
    link.click();
  });
  const eventNames = await page.evaluate(()=>window.dataLayer.map(args=>args[1]));
  assert.ok(eventNames.includes('quote_click'));
  assert.ok(!eventNames.includes('generate_lead'));
  await context.close();
}

try {
  for(const width of [390,1440]) {
    const context = await browser.newContext({viewport:{width,height:900}});
    await context.addInitScript(()=>localStorage.setItem('flex-web-cookie-consent','refused'));
    const page = await context.newPage();
    page.on('pageerror',error=>jsErrors.push(error.message));
    for(const manifest of pages) {
      await inspectPage(page,manifest,width);
      if(width===390 && manifest.id==='hub' && manifest.lang==='fr') {
        await page.locator('.menu summary').click();
        assert.ok(await page.locator('.menu nav').isVisible());
        await page.locator('.faqs summary').first().click();
        assert.ok(await page.locator('.faqs details p').first().isVisible());
      }
    }
    await context.close();
  }
  for(const link of internalLinks) {
    const response = await fetch(base + link,{redirect:'manual',signal:AbortSignal.timeout(20000)});
    assert.equal(response.status,200,link);
    await response.body?.cancel();
  }
  for(const link of publicSources) {
    const response = await fetch(link,{signal:AbortSignal.timeout(20000)});
    assert.equal(response.status,200,link);
    await response.body?.cancel();
  }
  assert.deepEqual(jsErrors,[]);
  await testConsentAndQuoteClick();
  console.log(pages.length+' pages × 390/1440 px, '+internalLinks.size+' liens internes, '+publicSources.size+' sources publiques, navigation, FAQ, consentement et clic devis vérifiés sur '+base);
} finally {
  await browser.close();
}
