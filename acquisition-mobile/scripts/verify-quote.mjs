import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const normalize = text => text.replace(/\s+/g, ' ').trim();

export async function verifyQuote(baseURL) {
  const origin = new URL(baseURL).origin;
  for (const route of ['/demarrer/application/', '/demarrer/?service=application']) {
    const response = await fetch(new URL(route, origin));
    assert.equal(response.status, 200, route);
    const html = normalize(await response.text());
    assert.match(html, /<h1>Votre application sur mesure\./);
    assert.match(html, /<p class="flow-price">À partir de 1 990 € TTC<\/p>/);
    assert.match(html, /<meta name="robots" content="noindex/);
  }
  const browser = await chromium.launch(process.env.CHROME_BIN ? { executablePath: process.env.CHROME_BIN } : {});
  try {
    const general = await browser.newPage();
    await general.route('**/*', route => {
      const request = route.request();
      return new URL(request.url()).origin === origin && request.method() === 'GET' ? route.continue() : route.abort();
    });
    for (const [query, heading] of [['', 'Votre site internet.'], ['?service=site&offre=business', 'Votre site internet.'], ['?service=seo&utm_medium=test', 'Automatisons votre activité.']]) {
      await general.goto(origin + '/demarrer/' + query);
      await general.waitForSelector('astro-island:not([ssr]) fieldset:not([disabled])');
      assert.ok((await general.locator('h1').innerText()).startsWith(heading));
      assert.equal(new URL(general.url()).pathname, '/demarrer/');
      if (query.includes('offre=')) assert.equal(await general.locator('select[name=planId]').inputValue(), 'business');
    }
    await general.close();
    for (const [width, profile, tier, price, consent, path] of [
      [375, 'particulier', 'essentielle', '1 990', false, '/demarrer/application/?utm_source=qa'],
      [1440, 'pro', 'business', '4 990', true, '/demarrer/?service=app&utm_source=qa'],
      [375, 'pro', 'premium', '9 990', true, '/demarrer/?service=application&utm_source=qa&custom_tracking=keep#contact'],
      [1440, 'particulier', 'business', '4 990', false, '/demarrer/application/?utm_source=qa'],
    ]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      try {
        const page = await context.newPage();
        const browserErrors = [];
        page.on('pageerror', error => browserErrors.push(error.message));
        await page.addInitScript(allowed => {
          localStorage.setItem('flex-web-cookie-consent', allowed ? 'accepted' : 'rejected');
          window.oaiq = (method, event) => {
            if (method === 'measure' && event === 'lead_created') sessionStorage.setItem('qa-lead', 'yes');
          };
        }, consent);
        const submissions = [];
        await context.route('**/*', async route => {
          const url = new URL(route.request().url());
          if (url.origin !== origin) return route.abort();
          if (url.pathname === '/api/automation/intake') {
            assert.equal(route.request().method(), 'POST');
            submissions.push(route.request().postDataJSON());
            const first = submissions.length === 1;
            return route.fulfill({ status: first ? 422 : 200, json: first ? { error: 'Erreur simulée' } : { ok: true } });
          }
          if (url.pathname === '/espace-projet/') return route.fulfill({ contentType: 'text/html', body: '<title>Espace simulé</title>' });
          if (!['GET', 'HEAD'].includes(route.request().method()) || url.pathname.startsWith('/api/')) return route.abort();
          return route.continue();
        });
        await page.goto(origin + path);
        await page.waitForSelector('astro-island:not([ssr]) select[name="applicationTier"]');
        assert.equal(await page.locator('select[name="applicationTier"]').inputValue(), 'essentielle');
        assert.equal(normalize(await page.locator('.flow-price').innerText()), 'À partir de 1 990 € TTC');
        if (path.includes('custom_tracking')) {
          const final = new URL(page.url());
          assert.equal(final.searchParams.get('custom_tracking'), 'keep');
          assert.equal(final.hash, '#contact');
        }
        await page.selectOption('[name=clientType]', profile);
        await page.selectOption('[name=applicationTier]', tier);
        assert.equal(normalize(await page.locator('.flow-price').innerText()), 'À partir de ' + price + ' € TTC');
        await page.fill('[name=contactName]', 'Exemple Test');
        await page.fill('[name=email]', 'fixture@example.invalid');
        await page.fill('[name=phone]', '0100000000');
        await page.fill('[name=message]', 'Vérification simulée du parcours pour une application.');
        const submit = page.getByRole('button', { name: 'Recevoir mon devis' });
        await submit.click();
        await page.getByText('Erreur simulée').waitFor();
        assert.equal(await page.evaluate(() => sessionStorage.getItem('qa-lead')), null);
        await submit.click();
        await page.waitForURL(url => url.pathname === '/espace-projet/');
        assert.equal(submissions.length, 2);
        for (const data of submissions) {
          assert.equal(data.publicQuote.service, 'application');
          assert.equal(data.applicationTier, tier);
          assert.equal(data.clientType, profile);
          assert.equal(data.professional, profile === 'pro');
          assert.equal(data.source, 'qa');
          assert.match(normalize(data.message), new RegExp(price + ' € TTC'));
        }
        assert.equal(submissions[0].requestKey, submissions[1].requestKey);
        assert.equal(await page.evaluate(() => sessionStorage.getItem('qa-lead')), consent ? 'yes' : null);
        assert.deepEqual(browserErrors, []);
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.argv[2]) throw new Error('Indiquer l’origine HTTP de l’aperçu à vérifier');
  await verifyQuote(process.argv[2]);
  console.log('Devis mobile vérifié : HTML initial, hydratation, quatre parcours, deux profils, attribution, erreur et réussite simulées, consentement.');
}
