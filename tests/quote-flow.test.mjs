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

function customProject(overrides = {}) {
  return {
    id: '11111111-1111-4111-8111-111111111111', companyName: 'Projet simulation locale',
    stage: 'AWAITING_PAYMENT', paymentStatus: 'UNPAID', setupCents: 45002, monthlyCents: 4900,
    priceBasis: 'TTC', termsVersion: '2026-09-12', deliveryKind: 'custom',
    quoteReference: 'FW-11111111-R1', checkoutAvailable: true, billingAvailable: false,
    briefSubmitted: false, pages: [], tickets: [], inquiries: [],
    offer: { name: 'Application sur mesure', features: [], quoteOnly: false },
    quote: {
      id: '22222222-2222-4222-8222-222222222222', revision: 1, contentHash: 'b'.repeat(64), status: 'ISSUED',
      document: {
        reference: 'FW-11111111-R1', title: 'Application de suivi', validUntil: '2099-12-31',
        scope: 'Un tableau de suivi et une interface de saisie pour votre équipe.',
        delivery: 'Livraison après validation des écrans et des contenus.',
        lineItems: [
          { description: 'Écran de suivi', quantity: 2, unitTtcCents: 10001 },
          { description: 'Configuration de l’application', quantity: 1, unitTtcCents: 25000 },
        ],
        monthlyOptions: [{ id: 'maintenance', name: 'Maintenance', monthlyCents: 4900, description: 'Maintenance et modifications.' }],
        oneTimeCents: 45002, monthlyCents: 4900, firstPaymentCents: 49902,
        paymentTerms: 'Paiement intégral de la prestation à la commande, puis option mensuelle.',
      },
    },
    ...overrides,
  };
}

async function openedPortal(project) {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const requests = [];
  const state = { project };
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin !== preview.origin) return route.abort();
    if (url.pathname.startsWith('/api/')) {
      const action = url.pathname.split('/').at(-1);
      requests.push({ action, body: route.request().postDataJSON(), authorization: route.request().headers().authorization });
      if (action === 'status') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(state.project) });
      if (action === 'checkout') return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
      return route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"Unexpected mocked API"}' });
    }
    return route.continue();
  });
  const page = await context.newPage();
  await page.goto(new URL(`/espace-projet/#cle=${'a'.repeat(64)}`, preview).href);
  await page.getByRole('heading', { name: project.companyName, exact: true }).waitFor();
  return { context, page, state, requests };
}

test('custom portal preserves TTC cents, binds acceptance to the shown revision and fits mobile/tablet/desktop', async () => {
  const { context, page, state, requests } = await openedPortal(customProject());
  try {
    assert.equal(new URL(page.url()).hash, '');
    const proposal = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Votre proposition FW-11111111-R1', exact: true }) });
    const body = await proposal.innerText();
    assert.match(body, /100,01\s*€/);
    assert.match(body, /200,02\s*€/);
    assert.match(body, /450,02\s*€ TTC/);
    assert.match(body, /499,02\s*€ TTC/);
    assert.doesNotMatch(body, /\bHT\b/);
    const checkout = page.getByRole('button', { name: 'Accepter et accéder au paiement', exact: true });
    assert.equal(await checkout.isDisabled(), true);
    for (const width of [375, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `No page overflow at ${width}px`);
    }
    await page.getByRole('checkbox').check();
    await checkout.click();
    await page.getByRole('status').filter({ hasText: 'Votre demande a été enregistrée.' }).waitFor();
    const payments = requests.filter(request => request.action === 'checkout');
    assert.equal(payments.length, 1);
    assert.deepEqual(payments[0].body, { accepted: true, quoteId: state.project.quote.id, revision: 1, contentHash: 'b'.repeat(64) });
    assert.equal(payments[0].authorization, `Bearer ${'a'.repeat(64)}`);
    state.project = { ...state.project, quoteReference: 'FW-11111111-R2', quote: { ...state.project.quote, revision: 2, contentHash: 'c'.repeat(64) } };
    await page.getByRole('button', { name: 'Actualiser', exact: true }).click();
    await page.getByRole('heading', { name: 'Votre proposition FW-11111111-R2', exact: true }).waitFor();
    assert.equal(await page.getByRole('checkbox').isChecked(), false);
    assert.equal(await checkout.isDisabled(), true);
  } finally { await context.close(); }
});

test('historical portal preserves the stored HT basis and original checkout contract', async () => {
  const { context, page, requests } = await openedPortal(customProject({
    quote: null, quoteReference: 'FW-LEGACY', priceBasis: 'HT', termsVersion: '2026-09-09',
    deliveryKind: 'site', setupCents: 29900, monthlyCents: 0,
    offer: { name: 'Site historique', features: ['Création du site selon la proposition initiale.'], quoteOnly: false },
  }));
  try {
    assert.match(await page.locator('main').innerText(), /299\s*€ HT/);
    await page.getByRole('link', { name: 'conditions de vente du 9 septembre 2026', exact: true }).waitFor();
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Accepter et accéder au paiement', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Votre demande a été enregistrée.' }).waitFor();
    assert.deepEqual(requests.find(request => request.action === 'checkout').body, { accepted: true });
  } finally { await context.close(); }
});

test('paid custom work keeps the issued quote visible without a website brief or generator', async () => {
  for (const stage of ['IN_PROGRESS', 'DELIVERED']) {
    const { context, page, requests } = await openedPortal(customProject({ stage, paymentStatus: 'PAID', checkoutAvailable: false }));
    try {
      await page.getByRole('heading', { name: stage === 'IN_PROGRESS' ? 'Votre projet est en cours de réalisation.' : 'Votre prestation a été livrée.', exact: true }).waitFor();
      assert.match(await page.locator('main').innerText(), /Premier paiement : 499,02\s*€ TTC/);
      assert.equal(await page.getByRole('heading', { name: 'Le brief de votre site', exact: true }).count(), 0);
      assert.equal(await page.getByRole('button', { name: 'Accepter et accéder au paiement', exact: true }).count(), 0);
      assert.deepEqual(requests.map(request => request.action), ['status']);
    } finally { await context.close(); }
  }
});
