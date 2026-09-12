import assert from 'node:assert/strict';
import { test, before, after } from 'node:test';
import { chromium } from 'playwright';
const origin = process.env.FLEXWEB_TEST_URL || 'http://127.0.0.1:4321';
if (!['127.0.0.1', 'localhost'].includes(new URL(origin).hostname)) throw new Error('Use a local preview only');
let browser;
before(async () => { browser = await chromium.launch({headless: true}); });
after(async () => { await browser?.close(); });
async function open(path, width=375) {
  const context = await browser.newContext({viewport:{width,height:900}});
  await context.addInitScript(() => localStorage.setItem('flex-web-cookie-consent','refused'));
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    if (url.pathname.startsWith('/api/')) return route.fulfill({status:503,contentType:'application/json',body:'{"error":"No external API in tests"}'});
    return route.continue();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000); page.setDefaultNavigationTimeout(20000);
  await page.goto(origin+path);
  return {page,context};
}
async function activity(page) {
  await page.locator('fieldset:enabled').first().waitFor();
  for (const [name,value] of Object.entries({companyName:'Simulation locale',contactName:'Test local',email:'design@example.invalid',phone:'0600000000',city:'Annecy',businessType:'Artisan'})) await page.locator(`input[name="${name}"]`).fill(value);
  await page.locator('input[name="professional"]').check();
  await page.getByRole('button',{name:'Continuer',exact:true}).click();
}
test('two offers and all four option combinations submit only the selected versioned quote', async () => {
  for (const [id,tier,setup] of [['essentielle','simple',299],['achat','complete',990]]) {
    for (const options of [[],['maintenance'],['crm'],['maintenance','crm']]) {
      const {page,context} = await open(`/demarrer/?service=site&offre=${id}`);
      try {
        let body;
        await page.route('**/api/automation/intake',route => { body=route.request().postDataJSON();return route.fulfill({status:201,contentType:'application/json',body:'{"projectId":"local"}'}); });
        await page.route('**/espace-projet/**',route => route.fulfill({status:200,contentType:'text/html',body:'<p>Received locally</p>'}));
        await activity(page);
        assert.equal(await page.locator(`input[name="planId"][value="${id}"]`).isChecked(),true);
        for(const option of options) await page.locator(`input[name="${option}"]`).check();
        assert.match(await page.locator('.flow-total').innerText(),new RegExp(`${setup}.*TTC`));
        await page.getByRole('button',{name:'Continuer',exact:true}).click();
        await page.getByLabel('Votre besoin',{exact:true}).fill('Vérifier le parcours sans envoi à une entreprise réelle.');
        await page.locator('input[name="privacyConsent"]').check();
        await page.getByRole('button',{name:'Recevoir mon devis'}).click();
        await page.waitForURL('**/espace-projet/**');
        assert.deepEqual(body.publicQuote,{version:'2026-09-11-ttc',service:'site',tier,options});
        assert.doesNotMatch(body.message,/\bHT\b/);
      } finally {await context.close();}
    }
  }
});
test('service changes retain business details, site selection and optional choices',async()=>{
  const {page,context}=await open('/demarrer/?offre=achat');
  try {
    await activity(page);await page.locator('input[name="maintenance"]').check();
    await page.getByRole('button',{name:'Retour',exact:true}).click();
    await page.getByLabel('Votre projet',{exact:true}).selectOption('automation');
    assert.match(await page.locator('.flow-aside').innerText(),/Sur devis/);
    await page.getByRole('button',{name:'Continuer',exact:true}).click();
    assert.equal(await page.locator('input[name="maintenance"]').count(),0);
    await page.getByRole('button',{name:'Retour',exact:true}).click();
    await page.getByLabel('Votre projet',{exact:true}).selectOption('site');
    assert.equal(await page.locator('input[name="companyName"]').inputValue(),'Simulation locale');
    await page.getByRole('button',{name:'Continuer',exact:true}).click();
    assert.equal(await page.locator('input[value="achat"]').isChecked(),true);
    assert.equal(await page.locator('input[name="maintenance"]').isChecked(),true);
  }finally{await context.close();}
});
test('IA and application requests have no website charge or monthly options',async()=>{
 for(const service of ['automation','application']){
  const {page,context}=await open(`/demarrer/?service=${service}`);
  try{
   let body;
   await page.route('**/api/automation/intake',route=>{body=route.request().postDataJSON();return route.fulfill({status:201,contentType:'application/json',body:'{"projectId":"local"}'});});
   await page.route('**/espace-projet/**',route=>route.fulfill({status:200,contentType:'text/html',body:'OK'}));
   await activity(page);
   assert.doesNotMatch(await page.locator('.flow-aside').innerText(),/299|990|49|99/);
   await page.getByRole('button',{name:'Continuer',exact:true}).click();
   await page.getByLabel('Votre besoin',{exact:true}).fill('Nous souhaitons connecter nos outils et automatiser notre suivi.');
   await page.locator('input[name="privacyConsent"]').check();
   await page.getByRole('button',{name:'Recevoir mon devis'}).click();
   await page.waitForURL('**/espace-projet/**');
   assert.deepEqual(body.publicQuote,{version:'2026-09-11-ttc',service});
  }finally{await context.close();}
 }
});
test('responsive layouts and keyboard menu stay usable at 375, 768 and 1440px',async()=>{
 for(const width of [375,768,1440]) for(const path of ['/','/pricing/','/demarrer/?offre=achat','/automatisation-ia/','/creation-site-internet/']){
  const {page,context}=await open(path,width);
  try{
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${path} overflows at ${width}`);
   if(path==='/'){
    const previews=page.locator('.realization-preview img');
    assert.equal(await previews.count(),3);
    for(const img of await previews.all()){await img.scrollIntoViewIfNeeded();await img.evaluate(img=>img.decode());assert(await img.evaluate(img=>img.naturalWidth>0));}
    if(width<1024){
      const menu=page.getByRole('button',{name:'Ouvrir le menu'});await menu.click();
      assert.equal(await page.getByRole('button',{name:'Fermer le menu'}).getAttribute('aria-expanded'),'true');
      await page.keyboard.press('Escape');assert.equal(await menu.getAttribute('aria-expanded'),'false');
      assert.equal(await menu.evaluate(el=>el===document.activeElement),true);
    }
   }
  }finally{await context.close();}
 }
});
test('private proposal displays its stored tax basis and requires acceptance before checkout',async()=>{
 for(const ttc of [true,false]){
  const {page,context}=await open('/');
  try{
   await page.route('**/api/automation/status',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id:'local-project',companyName:'Simulation',stage:'AWAITING_PAYMENT',paymentStatus:'UNPAID',quoteReference:'FW-LOCAL',offer:{name:'Site vitrine simple',features:['Site de démonstration'],publicQuote:{version:ttc?'2026-09-11-ttc':'2026-09-11'},...(ttc?{taxBasis:'TTC'}:{})},setupCents:29900,monthlyCents:4900,checkoutAvailable:true,pages:[],tickets:[]})}));
   await page.goto(`${origin}/espace-projet/#cle=${'a'.repeat(64)}`);
   await page.getByRole('heading',{name:'Votre proposition FW-LOCAL'}).waitFor();
   assert.match(await page.locator('.flow-detail').last().innerText(),ttc?/348.*TTC/:/348.*HT/);
   const pay=page.getByRole('button',{name:'Accepter et accéder au paiement'});
   assert.equal(await pay.isDisabled(),true);
   await page.locator('input[type="checkbox"]').check();assert.equal(await pay.isEnabled(),true);
  }finally{await context.close();}
 }
});
