import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const origin=process.argv[2];assert.match(origin,/^https:\/\/[0-9a-f]{24}--flex-webb\.netlify\.app$/);
const browser=await chromium.launch({headless:true});
const report=[];
async function run(name,opts,fn) {
  const ctx=await browser.newContext({viewport:opts.mobile?{width:390,height:844}:{width:1440,height:900},isMobile:!!opts.mobile,hasTouch:!!opts.mobile,...(opts.agent?{userAgent:opts.agent}:{})});
  const page=await ctx.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await ctx.route('**/*',async req=>{
    const u=new URL(req.request().url());
    if(u.pathname==='/api/langue/'&&u.origin===origin && opts.language)return req.fulfill({json:{language:opts.language},headers:{'Cache-Control':'private,no-store'}});
    // No real enquiry, personal data, advertising or analytics event leaves the test.
    if (req.request().method()==='POST'||(!u.hostname.endsWith('netlify.app')&&!['flex-web.fr','www.flex-web.fr'].includes(u.hostname)))return req.abort();
    return req.continue();
  });
  try {
    await fn(page,ctx);
    assert.ok(!errors.some(e=>/reader|dictionary|hydration|Minified React error/i.test(e)),errors.join('\n'));
    report.push(name);console.log('OK',name);
  } catch(e){console.error(name,page.url(),await page.locator('html').getAttribute('lang'),errors);throw e;}
  finally {await ctx.close();}
}
const lang=(page,code)=>page.waitForFunction(x=>document.documentElement.lang.split('-')[0]===x,code,{timeout:20000});
const choose=async(page,code)=>{
  const link=page.locator('[data-fw-language="'+code+'"]:visible').first();
  await link.waitFor({timeout:15000});await link.focus();await link.press('Enter');
};
const go=async(page,path)=>{await page.goto(origin+path,{waitUntil:'domcontentloaded'});};
const readable=page=>page.locator('[data-fw-language]').first().waitFor({state:'attached',timeout:15000});
const sourcePhone='tel:+33757830262';
try {
  for(const mobile of [false,true]){
    const size=mobile?'mobile':'ordinateur';
    await run(size+' — page artisan, choix mémorisé, retour au français',{mobile,language:'en'},async (p,ctx)=>{
      const path='/entrepreneurs/metiers/artisan-batiment/';
      await go(p,path);await lang(p,'en');
      assert.equal(new URL(p.url()).pathname,path);
      assert.equal(await p.locator('h1').textContent(),'Creating a website for your building trade');
      assert.equal(await p.locator('link[rel="canonical"]').getAttribute('href'),'https://flex-web.fr'+path);
      const text=await p.locator('main').innerText();assert.ok(/website/i.test(text));
      await choose(p,'fr');await lang(p,'fr');assert.match(await p.locator('h1').innerText(),/artisan du bâtiment/i);
      assert.ok((await ctx.cookies()).some(c=>c.name==='fw_reading_language' && c.value==='fr' && c.expires>Date.now()/1000+150*86400));
      await p.reload({waitUntil:'domcontentloaded'});await readable(p);assert.equal(await p.locator('html').getAttribute('lang'),'fr');
      assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
    });
    await run(size+' — le formulaire conserve toutes les données',{mobile,language:'fr'},async p=>{
      await go(p,'/contact/');await readable(p);
      const f=p.frameLocator('#flexweb-contact-frame');
      await f.locator('input[name=name]').fill('Test local');
      await f.locator('input[name=email]').fill('test@example.invalid');
      await f.locator('[name=topic]').selectOption('quote');
      await f.locator('[name=message]').fill('Brouillon de contrôle conservé.');
      await f.locator('[name=consent]').check();
      await choose(p,'en');await lang(p,'en');
      await f.locator('html[lang=en]').waitFor({state:'attached',timeout:15000});
      assert.equal(await f.locator('label[for=fw-contact-topic]').innerText(),'Subject');
      for(const [key,value] of Object.entries({name:'Test local',email:'test@example.invalid',topic:'quote',message:'Brouillon de contrôle conservé.'}))assert.equal(await f.locator('[name="'+key+'"]').inputValue(),value);
      assert.equal(await f.locator('[name=consent]').isChecked(),true);
      assert.equal(await f.locator('a[href^="tel:"]').getAttribute('href'),sourcePhone);
      await choose(p,'fr');await f.locator('html[lang=fr]').waitFor({state:'attached'});assert.equal(await f.locator('[name=message]').inputValue(),'Brouillon de contrôle conservé.');
    });
  }
  await run('offre native avec paramètres et ancre',{language:'en'},async p=>{
    await go(p,'/creation-site-internet/?source=test#contact');
    await p.waitForURL('**/en/websites/?source=test#contact',{timeout:20000});await lang(p,'en');
  });
  await run('adresse anglaise explicite depuis la France',{language:'fr'},async p=>{
    await go(p,'/en/applications/ios/');await readable(p);await lang(p,'en');assert.ok(p.url().endsWith('/en/applications/ios/'));
  });
  await run('langue allemande explicite depuis l’étranger',{language:'en'},async p=>{
    await go(p,'/de/anwendungen/');await readable(p);await lang(p,'de');assert.ok(p.url().endsWith('/de/anwendungen/'));
  });
  await run('langue italienne explicite depuis l’étranger',{language:'en'},async p=>{
    await go(p,'/it/applicazioni/');await readable(p);await lang(p,'it');
  });
  await run('version anglaise seule, lecture française sur la même page',{language:'en'},async p=>{
    await go(p,'/en/faq/');await choose(p,'fr');await lang(p,'fr');assert.ok(p.url().endsWith('/en/faq/'));
  });
  await run('devis application dynamique et tarif',{language:'en',mobile:true},async p=>{
    await go(p,'/demarrer/application/');await lang(p,'en');
    await p.waitForFunction(()=>document.querySelector('h1')?.textContent.includes('Your custom'));
    const form=p.locator('form.flow-card');
    await form.locator('[name=message]').fill('My local test draft, never submitted');
    await form.locator('select[name=applicationTier]').selectOption('business');
    assert.ok((await form.innerText()).replace(/\s/g,'').includes('1990€'));
    await form.locator('a[href="'+sourcePhone+'"]').first().waitFor({state:'visible',timeout:15000});
    await choose(p,'fr');await lang(p,'fr');assert.equal(await form.locator('[name=message]').inputValue(),'My local test draft, never submitted');
    assert.equal(await form.locator('select[name=applicationTier]').inputValue(),'business');
  });
  await run('fiche nationale sans page anglaise, commune préservée',{language:'en'},async p=>{
    const path='/projets-sites/entreprises/chambery-fr-73065/';await go(p,path);await lang(p,'en');
    const h=await p.locator('h1').innerText();assert.ok(/Chambéry/.test(h));assert.ok(/website|web design|site for/i.test(h),h);
    assert.equal(new URL(p.url()).pathname,path);
  });
  await run('catalogue local avec équivalent anglais exact',{language:'en'},async p=>{
    await go(p,'/territoires/sites/annecy-74010/');await p.waitForURL('**/en/locations/websites/annecy-74010/',{timeout:15000});
    await lang(p,'en');assert.match(await p.locator('h1').innerText(),/Annecy/i);
  });
  await run('visiteur étranger sur une fiche suisse de langue allemande',{language:'en'},async p=>{
    await go(p,'/projets-sites/entreprises/bern-ch-351/');await p.waitForURL('**/projets-sites/suisse/fr/entreprises/bern-ch-351/',{timeout:15000});
    await lang(p,'en');assert.match(await p.locator('h1').innerText(),/Bern/i);
    await choose(p,'fr');await lang(p,'fr');
  });
  await run('le robot lit le français canonique indépendamment de son pays',{language:'en',agent:'Googlebot'},async p=>{
    let decisions=0;p.on('request',r=>{if(new URL(r.url()).pathname==='/api/langue/')decisions++;});
    await go(p,'/creation-site-internet/');await readable(p);await lang(p,'fr');assert.equal(decisions,0);
  });
  await run('le devis termine son initialisation avant la traduction',{language:'en'},async p=>{
    let unblock;
    const hold=new Promise(resolve=>{unblock=resolve;});
    await p.route('**/StartApplication.*.js',async r=>{await hold;await r.continue();});
    try {
      await go(p,'/demarrer/application/');await lang(p,'en');
      const form=p.locator('form.flow-card');
      assert.ok(await form.locator('fieldset').first().isDisabled());
      assert.match(await p.locator('h1').innerText(),/Votre application/);
      unblock();
      await p.waitForFunction(()=>document.querySelector('h1')?.textContent.includes('Your custom'));
      assert.ok(await form.locator('fieldset').first().isEnabled());
    } finally {unblock();}
  });
  console.log(report.length,'parcours validés');
} finally {await browser.close();}
