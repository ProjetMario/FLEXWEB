import assert from 'node:assert/strict';
import { test, before, after } from 'node:test';
import { chromium } from 'playwright';

const origin = new URL(process.env.FLEXWEB_TEST_URL || 'http://127.0.0.1:4321');
if (!['127.0.0.1', 'localhost'].includes(origin.hostname)) throw new Error('Local mocked quote tests only');
let browser;
before(async () => { browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) }); });
after(async () => { await browser?.close(); });

async function openQuote(consent = 'accepted') {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  // The form uses HTTP only; keep sockets mocked without forwarding hot reloads.
  await context.routeWebSocket('**/*', () => {});
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin.origin) return route.abort();
    if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"Unexpected mocked API"}' });
    if (url.pathname.startsWith('/espace-projet/')) return route.fulfill({ status: 200, contentType: 'text/html', body: '<html lang="fr"><body>Demande simulée</body></html>' });
    return route.continue();
  });
  await context.addInitScript(value => {
    if (value) localStorage.setItem('flex-web-cookie-consent', value);
    sessionStorage.setItem('test-quote-events', '[]');
  }, consent);
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  await page.goto(new URL('/demarrer/?service=site&offre=essentielle', origin).href);
  await page.waitForFunction(() => document.querySelector('fieldset') && !document.querySelector('fieldset').disabled);
  await page.evaluate(() => {
    window.gtag = (...args) => {
      if (args[0] !== 'event') return;
      const events = JSON.parse(sessionStorage.getItem('test-quote-events') || '[]');
      events.push(args);
      sessionStorage.setItem('test-quote-events', JSON.stringify(events));
    };
  });
  return { page, context };
}
const events = page => page.evaluate(() => JSON.parse(sessionStorage.getItem('test-quote-events') || '[]'));
const starts = async page => (await events(page)).filter(event => event[1] === 'form_start');

async function fillIdentity(page) {
  for (const [label, value] of [['Entreprise', 'Entreprise simulation'], ['Votre nom', 'Test local'], ['E-mail professionnel', 'test@example.invalid'], ['Téléphone', '0600000000'], ['Ville', 'Chambéry'], ['Métier / activité', 'Test']]) {
    await page.getByLabel(label, { exact: true }).fill(value);
  }
  await page.getByLabel('Je fais cette demande pour mon activité professionnelle.').check();
  await page.getByRole('button', { name: 'Continuer', exact: true }).click();
  await page.getByRole('button', { name: 'Continuer', exact: true }).click();
}

test('form start is recorded once after consent across steps, back navigation and failed submission', async () => {
  const { page, context } = await openQuote();
  try {
    await fillIdentity(page);
    assert.equal((await starts(page)).length, 1);
    await page.getByRole('button', { name: 'Retour', exact: true }).click();
    await page.getByRole('button', { name: 'Continuer', exact: true }).click();
    await page.getByLabel('Votre besoin', { exact: true }).fill('Un projet simulé pour vérifier le formulaire sans envoyer de demande réelle.');
    await page.locator('input[name="privacyConsent"]').check();
    await page.getByRole('button', { name: 'Recevoir mon devis' }).click();
    await page.getByRole('alert').filter({ hasText: 'Unexpected mocked API' }).waitFor();
    await page.locator('textarea[name="message"]').press('End');
    await page.locator('textarea[name="message"]').pressSequentially(' Complément.');
    assert.equal((await starts(page)).length, 1);
    assert.equal((await events(page)).filter(event => event[1] === 'generate_lead').length, 0);
    assert.equal((await starts(page))[0][2].service_type, 'site');
    assert.doesNotMatch(JSON.stringify(await events(page)), /example.invalid|Chambéry|Complément|requestKey|accessToken|offre=/);
  } finally { await context.close(); }
});

for (const initialConsent of [null, 'refused']) test(`initial consent ${initialConsent} does not consume form start; a later accepted input can record it once`, async () => {
  const { page, context } = await openQuote(initialConsent);
  try {
    await page.getByLabel('Entreprise', { exact: true }).fill('Avant consentement');
    assert.equal((await starts(page)).length, 0);
    await page.evaluate(() => localStorage.setItem('flex-web-cookie-consent', 'accepted'));
    await page.getByLabel('Entreprise', { exact: true }).fill('Après consentement');
    assert.equal((await starts(page)).length, 1);
    await page.evaluate(() => localStorage.setItem('flex-web-cookie-consent', 'refused'));
    await page.getByLabel('Entreprise', { exact: true }).fill('Après refus');
    assert.equal((await starts(page)).length, 1);
  } finally { await context.close(); }
});

test('a voluntary discovery answer is sent with the request even when analytics is refused', async () => {
  const { page, context } = await openQuote('refused');
  let submitted;
  await page.route('**/api/automation/intake', route => {
    submitted = route.request().postDataJSON();
    return route.fulfill({ status: 400, contentType: 'application/json', body: '{"error":"Demande simulée, aucune donnée envoyée"}' });
  });
  try {
    await fillIdentity(page);
    await page.locator('select[name="declaredSource"]').selectOption('gemini');
    await page.getByLabel('Votre besoin', { exact: true }).fill('Une présentation de mon activité et un moyen simple de me contacter.');
    await page.locator('input[name="privacyConsent"]').check();
    await page.getByRole('button', { name: 'Recevoir mon devis' }).click();
    await page.getByRole('alert').filter({ hasText: 'Demande simulée' }).waitFor();
    assert.equal(submitted.source, 'site');
    assert.match(submitted.message, /Découverte déclarée par le client : Gemini\./);
    assert.deepEqual(await events(page), []);
  } finally { await context.close(); }
});

test('declared ChatGPT discovery is optional and never replaces measured source or enters analytics', async () => {
  const { page, context } = await openQuote();
  let submitted;
  await page.route('**/api/automation/intake', route => {
    submitted = route.request().postDataJSON();
    return route.fulfill({ status: 400, contentType: 'application/json', body: '{"error":"Demande simulée enregistrée pour vérification"}' });
  });
  try {
    await page.evaluate(() => sessionStorage.setItem('flexweb-acquisition-v1', JSON.stringify({ channel: 'Google naturel', landing: '/creation-site-internet/', aiSource: 'unknown', language: 'fr' })));
    await fillIdentity(page);
    const discovery = page.locator('select[name="declaredSource"]');
    assert.equal(await discovery.getAttribute('required'), null);
    await discovery.selectOption('chatgpt');
    const need = 'Un site pour présenter mes prestations et recevoir des contacts.';
    await page.getByLabel('Votre besoin', { exact: true }).fill(need);
    await page.locator('input[name="privacyConsent"]').check();
    await page.getByRole('button', { name: 'Recevoir mon devis' }).click();
    await page.getByRole('alert').filter({ hasText: 'Demande simulée enregistrée' }).waitFor();
    assert.equal(submitted.source, 'Google naturel | /creation-site-internet/');
    assert.equal(Object.hasOwn(submitted, 'declaredSource'), false);
    assert.match(submitted.message, /Découverte déclarée par le client : ChatGPT\./);
    assert.ok(submitted.message.endsWith(need));
    assert.ok(submitted.message.length <= 3000);
    assert.doesNotMatch(JSON.stringify(await events(page)), /ChatGPT|chatgpt|prestations|Découverte/);
  } finally { await context.close(); }
});
