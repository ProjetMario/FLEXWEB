import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { homepageContent } from '../../scripts/geo/homepage-content.mjs';

const origin = new URL(process.env.FLEXWEB_TEST_URL || 'http://127.0.0.1:4321');
if (!['localhost','127.0.0.1'].includes(origin.hostname)) throw new Error('Local mocked tests only');
const routes = ['/creation-site-internet-pas-cher/', '/francophonie/', '/en/affordable-websites/', '/en/french-speaking-clients/'];
const browserOptions = {headless:true, ...(process.env.PLAYWRIGHT_CHANNEL ? {channel:process.env.PLAYWRIGHT_CHANNEL} : {})};

test('budget and francophonie pages have usable contacts, FAQs and translations on mobile and desktop', async () => {
  const browser = await chromium.launch(browserOptions);
  await mkdir('.cms/geo-smoke', {recursive:true});
  try {
    for (const width of [375,1440]) {
      const context = await browser.newContext({viewport:{width,height:900}});
      await context.addInitScript(() => localStorage.setItem('flex-web-cookie-consent','refused'));
      await context.route('**/*', request => new URL(request.request().url()).origin === origin.origin && !new URL(request.request().url()).pathname.startsWith('/api/') ? request.continue() : request.abort());
      const page = await context.newPage();
      for (const route of [...routes, '/contact/', '/about/', '/realisations/', '/realisations/foot-nation/', '/realisations/2savoie-immo/', '/realisations/serrurier73/']) {
        assert.equal((await page.goto(new URL(route, origin).href)).status(), 200, route);
        await page.locator('main h1').waitFor();
        assert.equal(await page.locator('h1').count(), 1, route);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${route} overflow at ${width}`);
        const main = page.locator('main');
        assert((await main.locator('a[href^="mailto:"]').count()) > 0, route);
        assert((await main.locator('a[href^="tel:"]').count()) > 0, route);
        assert.doesNotMatch(await main.innerText(), /Témoignage client à ajouter|Résultats chiffrés à confirmer|Deux fiches seront publiées/);
        if (routes.includes(route)) {
          assert.equal(await page.locator('link[rel="alternate"][hreflang="fr"]').count(), 1);
          assert.equal(await page.locator('link[rel="alternate"][hreflang="en"]').count(), 1);
          const faq = main.locator('details').first();
          await faq.locator('summary').click();
          assert.equal(await faq.getAttribute('open'), '');
          await main.locator('a[href^="mailto:"]').first().focus();
          assert(await main.locator('a[href^="mailto:"]').first().evaluate(node => document.activeElement === node));
          await page.screenshot({path:`.cms/geo-smoke/${route.split('/').filter(Boolean).join('-')}-${width}.png`, fullPage:true});
        }
      }
      await context.close();
    }
  } finally { await browser.close(); }
});

test('French and English homepages preserve all baseline content and are captured before and after', async () => {
  const baseline = JSON.parse(await readFile('.cms/geo-homepages-baseline.json', 'utf8'));
  const browser = await chromium.launch(browserOptions);
  await mkdir('.cms/geo-smoke', {recursive:true});
  try {
    for (const route of ['/', '/en/']) {
      const html = await fetch(new URL(route, origin)).then(r => r.text());
      assert.deepEqual(homepageContent(html), baseline[route], route);
      for (const width of [375,1440]) {
        const context = await browser.newContext({viewport:{width,height:900}});
        await context.addInitScript(() => localStorage.setItem('flex-web-cookie-consent','refused'));
        await context.route('**/*', request => {
          const url = new URL(request.request().url());
          return [origin.origin,'https://flex-web.fr'].includes(url.origin) && !url.pathname.startsWith('/api/') ? request.continue() : request.abort();
        });
        const page = await context.newPage();
        if (route === '/') {
          await page.goto(new URL(route, origin).href);
          assert.equal(await page.locator('.m-hero .hero-content > .m-eyebrow:first-child').evaluate(node => getComputedStyle(node).display), 'none');
        }
        const visible = [];
        for (const [version, base] of [['before','https://flex-web.fr'],['after',origin.origin]]) {
          await page.goto(base + route);
          // Stabilise the existing entrance animations without changing content.
          await page.waitForTimeout(1200);
          visible.push((await page.locator('body').innerText()).replace(/\s+/g,' ').trim());
          await page.screenshot({path:`.cms/geo-smoke/home-${route === '/' ? 'fr' : 'en'}-${version}-${width}.png`, fullPage:true});
        }
        assert.equal(visible[1], visible[0], `${route} rendered content at ${width}`);
        await context.close();
      }
    }
  } finally { await browser.close(); }
});
