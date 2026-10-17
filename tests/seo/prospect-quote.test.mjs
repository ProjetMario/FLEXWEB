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
  assert.equal(validProspectContext({...publicProspectContext(p),name:'x'.repeat(161)},p.slug),false);
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
      const page=await context.newPage(); page.setDefaultTimeout(15000); page.setDefaultNavigationTimeout(20000);
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
        assert.equal(await page.locator('.pack-shortcuts a').count(),3);
        assert.equal(await page.locator('.pack-faq details').count(),3);
        assert.equal(await page.locator('.mobile-pack-bar').isVisible(),width<=620);
        for(const [id,label] of [['essentielle','Standard'],['visibilite','Medium'],['crm-automation','Premium']]) {
          const card=page.locator('#choisir-'+id);
          assert.equal(await card.getByRole('link',{name:'Choisir le pack '+label}).count(),1);
          assert(await card.evaluate(el=>Boolean(el.querySelector('.offer-actions').compareDocumentPosition(el.querySelector('ul')) & Node.DOCUMENT_POSITION_FOLLOWING)));
        }
        if(index===0) {
          await page.screenshot({path:`.cms/smoke/prospect-${width}.png`,fullPage:true});
          await page.locator('.offer-grid').screenshot({path:`.cms/smoke/prospect-packs-${width}.png`});
        }
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
      const page=await context.newPage(); page.setDefaultTimeout(15000); page.setDefaultNavigationTimeout(20000);
      await page.goto(new URL(`/${p.slug}/`,preview).href);
      await page.locator(`.offer-card a[href*="offre=${offer}"]`).click();
      await page.waitForFunction(()=>document.querySelector('fieldset')&&!document.querySelector('fieldset').disabled);
      await page.getByRole('button',{name:'Je refuse',exact:true}).click();
      assert.equal(await page.getByLabel('Entreprise',{exact:true}).inputValue(),p.name);
      assert.equal(await page.getByLabel('Ville',{exact:true}).inputValue(),p.city);
      assert.equal(await page.locator('.flow-steps li').count(),2);
      for(const [label,value] of [['Votre nom','Test local'],['E-mail professionnel','test@example.invalid'],['Téléphone','0600000000']]) await page.getByLabel(label,{exact:true}).fill(value);
      await page.getByLabel('Je fais cette demande pour mon activité professionnelle.').check();
      await page.getByRole('button',{name:'Continuer',exact:true}).click();
      assert(await page.locator(`input[name="planId"][value="${offer}"]`).isChecked());
      assert.equal(await page.locator('input[name="maintenance"]').isChecked(),false);
      assert.equal(await page.locator('input[name="crm"]').isChecked(),false);
      assert.equal(await page.locator('input[name="planId"]').count(),3);
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


test('short prospect flow preserves edits and options while switching packs; consent and retry remain safe', async () => {
  const browser=await chromium.launch({headless:true, ...(process.env.FLEXWEB_CHROME_PATH ? {executablePath:process.env.FLEXWEB_CHROME_PATH} : {})});
  const p=prospects.find(p=>p.batch==='pilot-10');
  try {
    for (const width of [375,768,1440]) {
      const context=await browser.newContext({viewport:{width,height:920}});
      let calls=[];
      await context.route('**/*',route=>{
        const url=new URL(route.request().url());
        if(url.origin!==preview.origin) return route.abort();
        if(url.pathname==='/api/automation/intake') {
          calls.push(route.request().postDataJSON());
          return route.fulfill({status:calls.length===1?503:201,contentType:'application/json',body:calls.length===1?'{"error":"Simulation : connexion interrompue"}':'{"projectId":"mock-pack"}'});
        }
        if(url.pathname.startsWith('/api/')) return route.fulfill({status:503,contentType:'application/json',body:'{}'});
        if(url.pathname.startsWith('/espace-projet/')) return route.fulfill({status:200,contentType:'text/html',body:'<html lang="fr"><body>Simulation</body></html>'});
        return route.continue();
      });
      const page=await context.newPage(); page.setDefaultTimeout(15000); page.setDefaultNavigationTimeout(20000);
      await page.goto(new URL(`/demarrer/?service=site&offre=essentielle&maquette=${p.slug}`,preview).href);
      await page.waitForFunction(()=>document.querySelector('fieldset')&&!document.querySelector('fieldset').disabled);
      await page.getByRole('button',{name:'Je refuse',exact:true}).click();
      await page.getByLabel('Entreprise',{exact:true}).fill('Entreprise corrigée');
      for(const [label,value] of [['Votre nom','Test local'],['E-mail professionnel','test@example.invalid'],['Téléphone','0600000000']]) await page.getByLabel(label,{exact:true}).fill(value);
      await page.getByLabel('Je fais cette demande pour mon activité professionnelle.').check();
      await page.getByRole('button',{name:'Continuer',exact:true}).click();
      await page.locator('input[name="planId"][value="crm-automation"]').check();
      await page.locator('input[name="maintenance"]').check();
      await page.locator('input[name="crm"]').check();
      await page.locator('textarea[name="message"]').fill('Personnaliser le site et le suivi client de mon entreprise.');
      assert.equal(await page.locator('input[name="privacyConsent"]').isChecked(),false);
      await page.getByRole('button',{name:'Recevoir mon devis',exact:true}).click();
      assert.equal(calls.length,0,'Consent is mandatory');
      await page.getByRole('button',{name:'Retour',exact:true}).click();
      assert.equal(await page.getByLabel('Entreprise',{exact:true}).inputValue(),'Entreprise corrigée');
      await page.getByRole('button',{name:'Continuer',exact:true}).click();
      assert(await page.locator('input[name="planId"][value="crm-automation"]').isChecked());
      assert(await page.locator('input[name="maintenance"]').isChecked());
      assert(await page.locator('input[name="crm"]').isChecked());
      await page.getByRole('button',{name:'Retour',exact:true}).click();
      await page.locator('select[name="service"]').selectOption('application');
      assert(!/49|99|148/.test(await page.locator('.flow-prospect-summary').innerText()),'Bespoke must not display fixed monthly options');
      await page.locator('select[name="service"]').selectOption('automation');
      await page.getByRole('button',{name:'Continuer',exact:true}).click();
      assert(await page.locator('input[name="crm"]').isChecked(),'Returning to the pack preserves selected options');
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Short form overflow '+width);
      await page.locator('input[name="privacyConsent"]').check();
      await page.screenshot({path:`.cms/smoke/prospect-signup-${width}.png`,fullPage:true});
      await page.getByRole('button',{name:'Recevoir mon devis',exact:true}).click();
      await page.getByRole('alert').filter({hasText:'Simulation'}).waitFor();
      await page.getByRole('button',{name:'Recevoir mon devis',exact:true}).click();
      await page.waitForURL('**/espace-projet/**');
      assert.equal(calls.length,2);
      assert.equal(calls[0].requestKey,calls[1].requestKey,'Retry must preserve idempotency');
      assert.equal(calls[0].accessToken,calls[1].accessToken);
      assert.equal(calls[1].companyName,'Entreprise corrigée');
      assert.equal(calls[1].publicQuote.service,'automation');
      assert.equal(calls[1].publicQuote.tier,'crm');
      assert.deepEqual(calls[1].publicQuote.options,['maintenance','crm']);
      assert(calls[1].message.includes(`https://flex-web.fr/${p.slug}/`));
      await context.close();
    }
  } finally {await browser.close();}
});

test('missing or invalid prospect context falls back to the regular three-step form', async () => {
  const browser=await chromium.launch({headless:true, ...(process.env.FLEXWEB_CHROME_PATH ? {executablePath:process.env.FLEXWEB_CHROME_PATH} : {})});
  const p=prospects[0];
  try {
    for(const mode of ['missing','mismatch']) {
      const context=await browser.newContext();
      await context.route('**/*',route=>{
        const url=new URL(route.request().url());
        if(url.origin!==preview.origin||url.pathname.startsWith('/api/')) return route.abort();
        if(url.pathname.startsWith('/maquettes/contexte/')) return route.fulfill({status:mode==='missing'?404:200,contentType:'application/json',body:mode==='missing'?'{}':JSON.stringify({...publicProspectContext(p),slug:'incorrect'})});
        return route.continue();
      });
      const page=await context.newPage(); page.setDefaultTimeout(15000); page.setDefaultNavigationTimeout(20000);
      await page.goto(new URL(`/demarrer/?service=seo&offre=visibilite&maquette=${p.slug}`,preview).href);
      await page.waitForFunction(()=>document.querySelector('fieldset')&&!document.querySelector('fieldset').disabled);
      await page.getByRole('button',{name:'Je refuse',exact:true}).click();
      assert.equal(await page.locator('.flow-steps li').count(),3);
      assert.equal(await page.getByLabel('Entreprise',{exact:true}).inputValue(),'');
      await context.close();
    }
  } finally {await browser.close();}
});
