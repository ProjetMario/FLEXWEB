import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const origin = process.argv[2] || 'http://127.0.0.1:4321';
const url = new URL(origin);
if (!((url.protocol === 'http:' && url.hostname === '127.0.0.1') || (url.protocol === 'https:' && /^[a-z0-9-]+--flex-webb\.netlify\.app$/.test(url.hostname)))) throw new Error('Unexpected preview origin');
const paths = ['/journal/assistant-ia-interne-entreprise/', '/about/', '/creation-site-internet-savoie/', '/creation-site-internet-haute-savoie/', '/automatisation-ia-savoie/', '/automatisation-ia-haute-savoie/', '/creation-application-mobile-savoie/', '/creation-application-mobile-haute-savoie/', '/realisations/foot-nation/', '/realisations/2savoie-immo/', '/realisations/serrurier73/'];
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [375, 768, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    await context.addInitScript(() => localStorage.setItem('flex-web-cookie-consent', 'refused'));
    await context.route('**/*', route => {
      const target = new URL(route.request().url());
      if (target.origin !== url.origin || target.pathname.startsWith('/api/')) return route.abort();
      return route.continue();
    });
    const page = await context.newPage();
    for (const pathname of paths) {
      const response = await page.goto(new URL(pathname, origin).href);
      assert.equal(response.status(), 200, `${width} ${pathname}`);
      assert.equal(await page.locator('h1').count(), 1, pathname);
      assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), `https://flex-web.fr${pathname}`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `overflow ${width} ${pathname}`);
      const quote = page.locator('a[href*="/demarrer/"]').first();
      assert.ok(await quote.count(), `missing quote CTA ${pathname}`);
      await quote.focus();
      assert.equal(await quote.evaluate(element => element === document.activeElement), true, `keyboard ${pathname}`);
    }
    await context.close();
  }
  console.log(`EmDash preview: ${paths.length} pages × 3 widths, canonical, quote CTA and keyboard checks passed; external APIs blocked.`);
} finally { await browser.close(); }
