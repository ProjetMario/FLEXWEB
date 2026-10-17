import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile, mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {isProspectSlug, validProspectContext, publicProspectContext} from '../../src/lib/prospect-context.mjs';

const prospects = JSON.parse(await readFile(new URL('../../src/data/prospects.json', import.meta.url)));
const logos = JSON.parse(await readFile(new URL('../../src/data/prospect-logos.json', import.meta.url)));
const preview = new URL(process.env.FLEXWEB_TEST_URL || 'http://127.0.0.1:4321');
if (!['127.0.0.1','localhost'].includes(preview.hostname)) throw Error('Mocked tests require local preview');

test('only bounded public context is carried into quote forms', () => {
  assert.equal(isProspectSlug('../crm'),false);
  assert.equal(isProspectSlug('x?email=secret'),false);
  const p = prospects[0];
  assert.deepEqual(Object.keys(publicProspectContext({...p,phone:'secret'})).sort(),['activity','city','name','slug']);
  assert(validProspectContext(publicProspectContext(p),p.slug));
  assert.equal(validProspectContext({...publicProspectContext(p),slug:'other'},p.slug),false);
});

test('pilot mockups are readable on phone, tablet and desktop', async () => {
  const browser=await chromium.launch({headless:true, ...(process.env.FLEXWEB_CHROME_PATH ? {executablePath:process.env.FLEXWEB_CHROME_PATH} : {})});
  try {
    await mkdir('.cms/smoke',{recursive:true});
    const pilots=prospects.filter(p=>p.batch==='pilot-10');
    assert.equal(pilots.length,10);
    const longest=[...prospects].sort((a,b)=>b.name.length-a.name.length).slice(0,6);
    const samples=[...new Map([...pilots,...prospects.filter(p=>logos[p.slug].origin==='official'),...longest].map(p=>[p.slug,p])).values()];
    for (const width of [375,768,1440]) {
      const context=await browser.newContext({viewport:{width,height:920}});
      await context.route('**/*',route=>new URL(route.request().url()).origin===preview.origin ? route.continue() : route.abort());
      const page=await context.newPage();
      for (const [index,p] of samples.entries()) {
        await page.goto(new URL('/'+p.slug+'/',preview).href);
        assert.equal(await page.locator('h1').count(),1, p.slug + ': ' + (await page.locator('h1').allTextContents()).join(' | '));
        assert.match(await page.locator('body').innerText(),/maquette non officielle/);
        assert.equal(await page.locator('form').count(),0);
        const logo=logos[p.slug];
        const renderedLogo=page.locator('.brand-logo');
        assert.equal(await renderedLogo.getAttribute('src'),logo.src);
        assert(await renderedLogo.evaluate(img=>img.complete && img.naturalWidth>0),'Logo failed to load: '+p.slug);
        assert.equal(await page.locator('[data-logo-origin]').getAttribute('data-logo-origin'),logo.origin);
        if(logo.origin==='proposed') assert(await page.getByText(' · Logo proposé',{exact:true}).isVisible());
        assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'),'noindex,nofollow');
        assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),p.slug+' overflow '+width);
        for (const [label,price] of [['Standard','299'],['Medium','590'],['Premium','990']]) {
          const card=page.locator('.offer-card').filter({hasText:'PACK '+label});
          assert.match((await card.innerText()).normalize('NFKC'),new RegExp(price+'\\s*€'));
        }
        if(index===0) await page.screenshot({path:`.cms/smoke/prospect-${width}.png`,fullPage:true});
      }
      await context.close();
    }
  } finally {await browser.close();}
});

test('all three mockup offers prefill company and persist reference through mocked intake', async () => {
  const browser=await chromium.launch({headless:true, ...(process.env.FLEXWEB_CHROME_PATH ? {executablePath:process.env.FLEXWEB_CHROME_PATH} : {})}); const p=prospects.find(p=>p.batch==='pilot-10');
  try {
    for (const [service,offer,tier] of [['site','essentielle','simple'],['seo','visibilite','visibility'],['automation','crm-automation','crm']]) {
      const context=await browser.newContext({viewport:{width:375,height:900}});
      let request;
      await context.route('**/*',route=>{
        const url=new URL(route.request().url());
        if(url.origin!==preview.origin) return route.abort();
        if(url.pathname==='/api/automation/intake') {request=route.request().postDataJSON();return route.fulfill({status:201,contentType:'application/json',body:'{"projectId":"mock-prospect"}'});}
        if(url.pathname.startsWith('/api/')) return route.fulfill({status:503,contentType:'application/json',body:'{}'});
        if(url.pathname.startsWith('/espace-projet/')) return route.fulfill({status:200,contentType:'text/html',body:'<html lang="fr"><body>Simulation</body></html>'});
        return route.continue();
      });
      const page=await context.newPage();
      await page.goto(new URL(`/${p.slug}/`,preview).href);
      await page.locator(`.offer-card a[href*="offre=${offer}"]`).click();
      await page.waitForFunction(()=>document.querySelector('fieldset')&&!document.querySelector('fieldset').disabled);
      assert.equal(await page.getByLabel('Entreprise',{exact:true}).inputValue(),p.name);
      assert.equal(await page.getByLabel('Ville',{exact:true}).inputValue(),p.city);
      for(const [label,value] of [['Votre nom','Test local'],['E-mail professionnel','test@example.invalid'],['Téléphone','0600000000']]) await page.getByLabel(label,{exact:true}).fill(value);
      await page.getByLabel('Je fais cette demande pour mon activité professionnelle.').check();
      await page.getByRole('button',{name:'Continuer',exact:true}).click();
      assert(await page.locator(`input[name="planId"][value="${offer}"]`).isChecked());
      await page.getByRole('button',{name:'Continuer',exact:true}).click();
      // React keeps the prefilled textarea value in its text node; target the field by name.
      await page.locator('textarea[name="message"]').fill('Je veux adapter cette maquette à mon entreprise.');
      await page.locator('input[name="privacyConsent"]').check();
      await page.getByRole('button',{name:'Recevoir mon devis'}).click();
      await page.waitForURL('**/espace-projet/**');
      assert.equal(request.companyName,p.name);
      assert.equal(request.publicQuote.tier,tier);
      assert.deepEqual(request.publicQuote.options,[]);
      assert(request.message.includes(`https://flex-web.fr/${p.slug}/`));
      assert.equal(request.phone,'0600000000');
      await context.close();
    }
  } finally {await browser.close();}
});
