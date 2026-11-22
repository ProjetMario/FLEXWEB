import assert from 'node:assert/strict';
import { test, before, after } from 'node:test';
import { chromium } from 'playwright';

// Exercise the real built form without sending a lead or loading third parties.
const preview = new URL(process.env.APPLICATION_BUDGET_ORIGIN || process.env.FLEXWEB_TEST_URL || 'http://127.0.0.1:4321');
if (!['127.0.0.1', 'localhost'].includes(preview.hostname) && !(preview.protocol === 'https:' && /^[a-f0-9]{24}--flex-webb\.netlify\.app$/.test(preview.hostname))) throw new Error('Use the local preview or the immutable FLEX-WEB draft only');
const budgets = ['1 990 à 5 000 €', '5 000 à 10 000 €', 'Plus de 10 000 €'];
let browser;
before(async () => { browser = await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined}); });
after(async () => { await browser?.close(); });

async function openForm(service) {
  const context = await browser.newContext({viewport:{width:390,height:844}});
  const submitted = [];
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== preview.origin) return route.abort();
    if (url.pathname === '/api/automation/intake' && request.method() === 'POST') {
      submitted.push(request.postDataJSON());
      return route.fulfill({status:201,contentType:'application/json',body:'{"projectId":"local-test"}'});
    }
    if (url.pathname.startsWith('/api/')) return route.fulfill({status:503,contentType:'application/json',body:'{"error":"Unexpected mocked API"}'});
    if (!['GET','HEAD'].includes(request.method())) return route.abort();
    if (url.pathname.startsWith('/espace-projet/')) return route.fulfill({status:200,contentType:'text/html',body:'<html lang="fr"><body>Simulation locale</body></html>'});
    return route.continue();
  });
  await context.addInitScript(() => {
    localStorage.setItem('flex-web-cookie-consent', 'refused');
    localStorage.setItem('flex-web-openai-consent', 'refused');
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  await page.goto(new URL(`/demarrer/?service=${service}&utm_source=chatgpt.com`, preview).href);
  await page.waitForFunction(() => document.querySelector('fieldset') && !document.querySelector('fieldset').disabled);
  await page.getByRole('radio', {name:'Particulier',exact:true}).check();
  await page.getByLabel('Votre nom', {exact:true}).fill('Test local');
  await page.getByLabel('Votre e-mail', {exact:true}).fill('test@example.invalid');
  await page.getByLabel('Votre besoin', {exact:true}).fill('Demande de vérification locale sans soumission réelle.');
  if (!['application','application.','app','app.'].includes(service)) await page.locator('input[name="privacyConsent"]').check();
  return {context,page,submitted};
}

test('application shows the complete budget on its first screen and requires a choice', async () => {
  const {context,page,submitted} = await openForm('application');
  try {
    assert.equal(await page.getByText('À partir de 1 990 €', {exact:true}).isVisible(), true);
    assert.equal(await page.getByText('Le prix dépend de la complexité de l’application, des options choisies et du temps de développement.', {exact:true}).isVisible(), true);
    const group = page.getByRole('group', {name:'Votre budget (obligatoire)'});
    assert.equal(await group.isVisible(), true);
    assert.deepEqual(await group.locator('label span').allTextContents(), budgets);
    assert.equal(await group.locator('input:checked').count(), 0);
    assert.equal(await page.locator('.quote-details').count(), 0);
    assert.equal(await page.locator('form select').count(), 0);
    assert.equal(await page.locator('input[name="companyName"]').count(), 0);
    assert.equal(await page.locator('input[name="privacyConsent"]').count(), 0);
    assert.equal(await page.locator('.quote-contact-notice').isVisible(), true);
    assert.equal(await page.locator('.quote-contact-notice').innerText(), 'En envoyant votre demande, vous acceptez d’être recontacté à son sujet. Confidentialité.');
    assert.equal(await page.locator('.quote-contact-notice a').getAttribute('href'), '/privacy/');
    assert.equal(await page.locator('.quote-contact-notice').evaluate(notice => notice.nextElementSibling.matches('button[type="submit"]')), true);
    assert.equal(await page.getByRole('button', {name:/Continuer|Suivant|Étape 2/i}).count(), 0);
    assert.doesNotMatch(await page.locator('form').innerText(), /moins de 2\s?000|budget non défini/i);
    assert.equal(await page.locator('textarea[name="message"]').evaluate(input => input.closest('label').nextElementSibling.classList.contains('quote-application-budget')), true);
    await page.getByRole('button', {name:'Recevoir mon devis'}).click();
    assert.equal(await group.locator('input').first().evaluate(input => input.validity.valueMissing), true);
    assert.equal(submitted.length, 0);
    for (const width of [320,390,768,1440]) {
      await page.setViewportSize({width,height:900});
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    }
  } finally { await context.close(); }
});

test('each accepted application budget reaches the existing quote message', async () => {
  for (const label of budgets) {
    const {context,page,submitted} = await openForm('application');
    try {
      await page.getByRole('radio', {name:label,exact:true}).check();
      await page.getByRole('button', {name:'Recevoir mon devis'}).click();
      await page.waitForURL('**/espace-projet/**');
      assert.equal(submitted.length, 1);
      const request = submitted[0];
      assert.equal(request.planId, 'achat');
      assert.equal(request.privacyConsent, true);
      assert.deepEqual(request.publicQuote, {version:'2026-09-24-ttc',service:'application'});
      assert.ok(request.message.includes(`Budget prévu : ${label}.`));
      assert.ok(request.message.includes('À partir de 1 990 €.'));
      assert.ok(request.message.includes('complexité de l’application, des options choisies et du temps de développement'));
      assert.ok(request.message.endsWith('Demande de vérification locale sans soumission réelle.'));
      assert.ok(request.message.length <= 3000);
    } finally { await context.close(); }
  }
});

test('application URL aliases also open the budget directly', async () => {
  for (const service of ['application.', 'app', 'app.']) {
    const {context,page,submitted} = await openForm(service);
    try {
      assert.equal(await page.getByRole('group', {name:'Votre budget (obligatoire)'}).isVisible(), true);
      assert.equal(await page.locator('.quote-details').count(), 0);
      assert.equal(await page.locator('input[name="privacyConsent"]').count(), 0);
      assert.equal(await page.locator('.quote-contact-notice').isVisible(), true);
      assert.equal(submitted.length, 0);
    } finally { await context.close(); }
  }
});

test('site and automation requests keep their original form and quote details', async () => {
  for (const selection of [{service:'site',plan:'essentielle',tier:'simple',price:299},{service:'automation',plan:'crm-automation',tier:'crm',price:990}]) {
    const {context,page,submitted} = await openForm(selection.service);
    try {
      assert.equal(await page.locator('.quote-application-budget').count(), 0);
      assert.equal(await page.locator('.quote-details').count(), 1);
      assert.equal(await page.locator('input[name="privacyConsent"]').isChecked(), true);
      assert.equal(await page.locator('.quote-contact-notice').count(), 0);
      await page.getByRole('button', {name:'Recevoir mon devis'}).click();
      await page.waitForURL('**/espace-projet/**');
      assert.equal(submitted.length, 1);
      assert.equal(submitted[0].planId, selection.plan);
      assert.equal(submitted[0].privacyConsent, true);
      assert.deepEqual(submitted[0].publicQuote, {version:'2026-09-24-ttc',service:selection.service,tier:selection.tier,options:[]});
      assert.match(submitted[0].message.normalize('NFKC'), new RegExp(`${selection.price}\\s*€ TTC en paiement unique`));
      assert.doesNotMatch(submitted[0].message, /Budget prévu|1 990/);
    } finally { await context.close(); }
  }
});

test('changing from site to application removes details and checkbox and explains contact before submission', async () => {
  const {context,page,submitted} = await openForm('site');
  try {
    await page.locator('summary').click();
    await page.locator('select[name="service"]').selectOption('application');
    assert.equal(await page.locator('.quote-details').count(), 0);
    assert.equal(await page.locator('input[name="privacyConsent"]').count(), 0);
    assert.equal(await page.locator('.quote-contact-notice').isVisible(), true);
    assert.equal(await page.getByRole('group', {name:'Votre budget (obligatoire)'}).isVisible(), true);
    await page.getByRole('button', {name:'Recevoir mon devis'}).click();
    assert.equal(submitted.length, 0);
    await page.getByRole('radio', {name:budgets[1],exact:true}).check();
    await page.getByRole('button', {name:'Recevoir mon devis'}).click();
    await page.waitForURL('**/espace-projet/**');
    assert.equal(submitted.length, 1);
    assert.equal(submitted[0].publicQuote.service, 'application');
    assert.equal(submitted[0].planId, 'achat');
    assert.equal(submitted[0].privacyConsent, true);
    assert.ok(submitted[0].message.includes(`Budget prévu : ${budgets[1]}.`));
  } finally { await context.close(); }
});
