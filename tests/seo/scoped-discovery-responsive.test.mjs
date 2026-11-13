import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

test('journal and creation pages retain usable guides and contacts on phone and desktop', async () => {
  const origin = process.env.TEST_ORIGIN || 'http://127.0.0.1:4321';
  const browser = await chromium.launch({ headless: true });
  await mkdir('.cms/seo-discovery-smoke', { recursive: true });
  try {
    for (const width of [390, 1366]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
      for (const [route, anchor] of [['/journal/', '#project-guides'], ['/creation-site-internet/', '#entrepreneurs-guides']]) {
        await page.goto(origin + route, { waitUntil: 'networkidle' });
        assert.equal(await page.locator('h1').count(), 1);
        const reject = page.getByRole('button', { name: /refuser/i });
        if (await reject.isVisible()) await reject.click();
        await page.locator(anchor).scrollIntoViewIfNeeded();
        assert(await page.locator(anchor).isVisible());
        assert(await page.locator('a[href="/creation-site-internet-pas-cher/"]').count() > 0);
        assert(await page.locator('a[href="/entrepreneurs/guides/budget-premier-site/"]').count() > 0);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
        await page.screenshot({ path: '.cms/seo-discovery-smoke/' + route.split('/')[1] + '-' + width + '.png' });
      }
      await page.close();
    }
  } finally { await browser.close(); }
});
