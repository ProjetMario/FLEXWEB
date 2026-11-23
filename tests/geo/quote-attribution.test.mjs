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
    if (!['GET', 'HEAD'].includes(route.request().method())) return route.abort();
    return route.continue();
  });
  await context.addInitScript(value => {
    if (value) {
      localStorage.setItem('flex-web-cookie-consent', value);
      localStorage.setItem('flex-web-openai-consent', value);
    }
    sessionStorage.setItem('test-quote-events', '[]');
  }, consent);
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  await page.goto(new URL('/demarrer/?service=site&offre=essentielle', origin).href);
  await page.locator('astro-island:not([ssr]) form > fieldset:enabled').waitFor();
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
  await page.getByRole('radio', { name: 'Pro', exact: true }).check();
  await page.getByLabel('Votre nom', { exact: true }).fill('Test local');
  await page.getByLabel('Votre e-mail', { exact: true }).fill('test@example.invalid');
  await page.locator('input[name="phone"]').fill('0600000000');
}

async function discoveryField(page) {
  const field = page.locator('form select[name="declaredSource"]');
  assert.equal(await field.count(), 1, 'The quote form must offer the optional discovery question separately from measured acquisition.');
  return field;
}

test('a single-page quote records one form start across edits, offer changes and a failed submission', async () => {
  const { page, context } = await openQuote();
  try {
    await fillIdentity(page);
    assert.equal((await starts(page)).length, 1);
    const details = page.locator('form details').filter({ has: page.locator('select[name="planId"]') });
    const summary = details.locator('summary');
    await summary.click();
    await details.locator('input[name="companyName"]').fill('Entreprise de Chambéry');
    const plan = details.locator('select[name="planId"]');
    const initialPlan = await plan.inputValue();
    const alternative = await plan.locator('option').evaluateAll((options, previous) =>
      options.find(option => option.value && option.value !== previous)?.value, initialPlan);
    assert.ok(alternative, 'A second offer is available');
    await plan.selectOption(alternative);
    await summary.click();
    await summary.click();
    await plan.selectOption(initialPlan);
    await summary.click();
    await page.getByLabel('Votre besoin', { exact: true }).fill('Un projet simulé pour vérifier le formulaire sans envoyer de demande réelle.');
    await page.locator('input[name="privacyConsent"]').check();
    await page.getByRole('button', { name: 'Recevoir mon devis' }).click();
    await page.getByRole('alert').filter({ hasText: 'Unexpected mocked API' }).waitFor();
    await page.locator('textarea[name="message"]').press('End');
    await page.locator('textarea[name="message"]').pressSequentially(' Complément.');
    assert.equal((await starts(page)).length, 1);
    assert.equal((await events(page)).filter(event => event[1] === 'generate_lead').length, 0);
    assert.equal((await starts(page))[0][2].service_type, 'site');
    assert.doesNotMatch(JSON.stringify(await events(page)), /example.invalid|Test local|0600000000|Chambéry|Complément|requestKey|accessToken|offre=/);
  } finally { await context.close(); }
});

for (const initialConsent of [null, 'refused']) test(`initial consent ${initialConsent} does not consume form start; a later accepted input can record it once`, async () => {
  const { page, context } = await openQuote(initialConsent);
  try {
    await page.getByLabel('Votre nom', { exact: true }).fill('Avant consentement');
    assert.equal((await starts(page)).length, 0);
    await page.evaluate(() => localStorage.setItem('flex-web-cookie-consent', 'accepted'));
    await page.getByLabel('Votre nom', { exact: true }).fill('Après consentement');
    assert.equal((await starts(page)).length, 1);
    await page.evaluate(() => localStorage.setItem('flex-web-cookie-consent', 'refused'));
    await page.getByLabel('Votre nom', { exact: true }).fill('Après refus');
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
    await (await discoveryField(page)).selectOption('gemini');
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
    const discovery = await discoveryField(page);
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
