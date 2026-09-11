import assert from 'node:assert/strict';
import { test, before, after } from 'node:test';
import { chromium } from 'playwright';

// All requests are restricted to a loopback preview, and every API is mocked.
const preview = new URL(process.env.FLEXWEB_TEST_URL || 'http://127.0.0.1:4321');
if (!['127.0.0.1', 'localhost'].includes(preview.hostname)) throw new Error('Use a local preview only');
let browser;
before(async () => { browser = await chromium.launch({headless: true}); });
after(async () => { await browser?.close(); });

async function filledQuote(consent = 'accepted') {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin !== preview.origin) return route.abort();
    if (url.pathname.startsWith('/api/')) return route.fulfill({status: 503, contentType:'application/json', body:'{"error":"Unexpected mocked API"}'});
    if (url.pathname.startsWith('/espace-projet/')) return route.fulfill({status: 200, contentType:'text/html', body:'<html lang="fr"><body>Projet reçu en simulation locale</body></html>'});
    return route.continue();
  });
  await context.addInitScript(value => localStorage.setItem('flex-web-cookie-consent', value), consent);
  const page = await context.newPage();
  page.setDefaultTimeout(15000); page.setDefaultNavigationTimeout(20000);
  await page.goto(new URL('/demarrer/?service=site&offre=essentielle', preview).href);
  await page.waitForFunction(() => document.querySelector('fieldset') && !document.querySelector('fieldset').disabled);
  for (const [label, value] of [['Entreprise', 'Entreprise simulation'], ['Votre nom', 'Test local'], ['E-mail professionnel', 'test@example.invalid'], ['Téléphone', '0600000000'], ['Ville', 'Chambéry'], ['Métier / activité', 'Test']]) {
    await page.getByLabel(label, {exact: true}).fill(value);
  }
  await page.getByLabel('Je fais cette demande pour mon activité professionnelle.').check();
  await page.getByRole('button', {name:'Continuer', exact:true}).click();
  assert.equal(await page.locator('input[name="maintenance"]').isChecked(), false);
  assert.equal(await page.locator('input[name="crm"]').isChecked(), false);
  await page.getByRole('button', {name:'Continuer', exact:true}).click();
  await page.getByLabel('Votre besoin', {exact:true}).fill('Demande locale de vérification sans soumission réelle.');
  await page.locator('input[name="privacyConsent"]').check();
  // Persist event calls across the mocked private-page navigation.
  await page.evaluate(() => {
    sessionStorage.setItem('test-lead-events', '[]');
    window.gtag = (...args) => {
      if (args[0] === 'event' && args[1] === 'generate_lead') {
        const events = JSON.parse(sessionStorage.getItem('test-lead-events'));
        events.push(args);
        sessionStorage.setItem('test-lead-events', JSON.stringify(events));
      }
    };
  });
  return {page, context};
}

const recordedEvents = page => page.evaluate(() => JSON.parse(sessionStorage.getItem('test-lead-events')));

test('successful double click records one mocked request and one conversion', async () => {
  const {page, context} = await filledQuote();
  const records = new Map();
  let attempts = 0, body, release;
  const pending = new Promise(resolve => { release = resolve; });
  await page.route('**/api/automation/intake', async route => {
    attempts++;
    body = route.request().postDataJSON();
    records.set(body.requestKey, body);
    await pending;
    return route.fulfill({status:201,contentType:'application/json',body:'{"projectId":"local-test"}'});
  });
  try {
    await page.getByRole('button', {name:'Recevoir mon devis'}).dblclick({force: true});
    await page.waitForFunction(() => document.querySelector('form').getAttribute('aria-busy') === 'true');
    assert.equal(attempts, 1);
    assert.equal(records.size, 1);
    assert.deepEqual(body.publicQuote, {version:'2026-09-11-ttc', service:'site', tier:'simple', options:[]});
    assert.deepEqual(await recordedEvents(page), []);
    release();
    await page.waitForURL('**/espace-projet/**');
    const events = await recordedEvents(page);
    assert.equal(events.length, 1);
    assert.equal(events[0][2].page_location, `${preview.origin}/demarrer/`);
    assert.doesNotMatch(JSON.stringify(events), /example.invalid|requestKey|accessToken|cle=/);
    assert.equal(await page.evaluate(() => sessionStorage.getItem('flexweb-intake-v2')), null);
  } finally { release(); await context.close(); }
});

test('rejected request emits no conversion; retry reuses its identity and records once', async () => {
  const {page, context} = await filledQuote();
  const requests = [], records = new Map();
  let reject = true;
  await page.route('**/api/automation/intake', route => {
    const body = route.request().postDataJSON();
    requests.push(body);
    if (reject) return route.fulfill({status:503,contentType:'application/json',body:'{"error":"Erreur simulée"}'});
    records.set(body.requestKey, body);
    return route.fulfill({status:201,contentType:'application/json',body:'{"projectId":"local-test"}'});
  });
  try {
    await page.getByRole('button', {name:'Recevoir mon devis'}).click();
    await page.getByRole('alert').filter({hasText:'Erreur simulée'}).waitFor();
    assert.equal(records.size, 0);
    assert.deepEqual(await recordedEvents(page), []);
    reject = false;
    await page.getByRole('button', {name:'Recevoir mon devis'}).click();
    await page.waitForURL('**/espace-projet/**');
    assert.equal(requests.length, 2);
    assert.equal(records.size, 1);
    assert.equal(requests[0].requestKey, requests[1].requestKey);
    assert.equal(requests[0].accessToken, requests[1].accessToken);
    assert.equal((await recordedEvents(page)).length, 1);
  } finally { await context.close(); }
});

test('successful request without analytics consent records the request but no conversion', async () => {
  const {page, context} = await filledQuote('refused');
  let records = 0;
  await page.route('**/api/automation/intake', route => {
    records++;
    return route.fulfill({status:201,contentType:'application/json',body:'{"projectId":"local-test"}'});
  });
  try {
    await page.getByRole('button', {name:'Recevoir mon devis'}).click();
    await page.waitForURL('**/espace-projet/**');
    assert.equal(records, 1);
    assert.deepEqual(await recordedEvents(page), []);
  } finally { await context.close(); }
});
