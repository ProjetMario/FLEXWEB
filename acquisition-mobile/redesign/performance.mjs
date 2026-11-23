import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const origin = new URL(process.argv[2]).origin;
const output = fileURLToPath(new URL('../.release/redesign/qa/', import.meta.url));
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const measures = [];
try {
  for (const path of ['/', '/creation-application-mobile/']) {
    for (let run = 1; run <= 3; run++) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 2, serviceWorkers: 'block' });
      try {
        await context.addInitScript(() => {
          localStorage.setItem('flex-web-cookie-consent', 'refused');
          window.vitals = { lcp: 0, cls: 0, element: '' };
          new PerformanceObserver(list => {
            for (const entry of list.getEntries()) {
              window.vitals.lcp = Math.round(entry.startTime);
              window.vitals.element = entry.element?.tagName || '';
            }
          }).observe({ type: 'largest-contentful-paint', buffered: true });
          let first = 0, last = 0, sum = 0;
          new PerformanceObserver(list => {
            for (const entry of list.getEntries()) {
              if (entry.hadRecentInput) continue;
              if (entry.startTime - last >= 1000 || entry.startTime - first >= 5000) {
                sum = 0;
                first = entry.startTime;
              }
              last = entry.startTime;
              sum += entry.value;
              window.vitals.cls = Math.max(window.vitals.cls, sum);
            }
          }).observe({ type: 'layout-shift', buffered: true });
        });
        const page = await context.newPage();
        const cdp = await context.newCDPSession(page);
        await cdp.send('Network.enable');
        await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
        await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 100, downloadThroughput: 200_000, uploadThroughput: 100_000 });
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
        assert.equal((await page.goto(origin + path, { waitUntil: 'load', timeout: 90000 })).status(), 200);
        await page.waitForLoadState('networkidle', { timeout: 45000 });
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(750);
        const result = await page.evaluate(() => {
          const nav = performance.getEntriesByType('navigation')[0];
          const resources = performance.getEntriesByType('resource');
          return { ...window.vitals, cls: Number(window.vitals.cls.toFixed(4)), ttfb: Math.round(nav.responseStart), bytes: nav.transferSize + resources.reduce((n, entry) => n + entry.transferSize, 0) };
        });
        assert.ok(result.lcp > 0);
        measures.push({ path, run, ...result });
        console.log(path, run, result);
      } finally { await context.close(); }
    }
  }
} finally {
  await browser.close();
  await writeFile(output + '/performance-' + new URL(origin).hostname + '.json', JSON.stringify({ origin, finishedAt: new Date().toISOString(), measures }, null, 2) + '\n');
}
