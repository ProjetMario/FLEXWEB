import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { footerBrand, postalAddress } from '../../src/data/business.ts';

const origin = new URL(process.argv[2]).origin;
const directory = fileURLToPath(new URL('../.release/redesign/qa/' + new URL(origin).hostname + '/', import.meta.url));
const widths = [390, 768, 1440];
const missing = '/page-introuvable-verification-atelier-flexweb/';
const noindexSample = '/projets-sites/suisse/it/particuliers/liedertswil-ch-2890/';
const routes = ['/', '/en/', '/creation-site-internet/', '/automatisation-ia/', '/creation-application-mobile/', '/pricing/', '/realisations/footnation/', '/demarrer/', '/demarrer/application/', '/communes-france/', '/privacy/', noindexSample, missing];
const screenshots = new Map([['/', 'accueil-fr'], ['/en/', 'accueil-en'], ['/pricing/', 'tarifs'], ['/creation-application-mobile/', 'applications'], ['/demarrer/application/', 'devis']]);
await mkdir(directory, { recursive: true });
const browser = await chromium.launch();
const results = [], errors = [];

async function check(page, path, width) {
  const response = await page.goto(origin + path, { waitUntil: 'load', timeout: 45000 });
  assert.equal(response.status(), path === missing ? 404 : 200);
  assert.equal(new URL(page.url()).pathname, path);
  const h1 = page.locator('h1');
  assert.equal(await h1.count(), 1);
  assert.ok(await h1.isVisible());
  const layout = await page.evaluate(async () => {
    await document.fonts.ready;
    return {
      marker: getComputedStyle(document.documentElement).getPropertyValue('--flex-studio-release').trim(),
      width: document.documentElement.scrollWidth,
      language: document.documentElement.lang,
      hasTitle: !!document.title.trim(),
      canonical: document.querySelector('link[rel="canonical"]')?.href,
      robots: document.querySelector('meta[name="robots"]')?.content || ''
    };
  });
  assert.equal(layout.marker, 'atelier-1');
  assert.ok(layout.width <= width + 1, 'Débordement horizontal ' + layout.width);
  assert.ok(layout.hasTitle && layout.language);
  if (!['/demarrer/', '/demarrer/application/', noindexSample, missing].includes(path)) {
    assert.equal(layout.canonical, 'https://flex-web.fr' + path);
    assert.doesNotMatch(layout.robots, /noindex/i);
  }
  if (path === noindexSample) assert.match(layout.robots, /noindex/i);
  if (path !== missing && path !== noindexSample) {
    const address = page.locator('footer address[data-flexweb-postal-address]');
    await address.waitFor({state:'visible', timeout:10000});
    assert.equal(await address.count(), 1, path);
    const text = await address.innerText();
    for (const line of [footerBrand, postalAddress.streetAddress, postalAddress.postalCode+' '+postalAddress.addressLocality]) {
      assert.ok(text.includes(line), path+' — '+line);
    }
  }
  if (path === '/' || path === '/en/') {
    const french = path === '/';
    const text = (await h1.innerText()).replace(/\s+/g, '');
    assert.equal(text, french ? 'Votresiteinternet.Votreapplication.' : 'Yourwebsite.Yourapp.');
    const hero = page.locator('.atelier-hero');
    await page.keyboard.press('Tab');
    const skip = page.locator('.atelier-skip');
    assert.ok(await skip.evaluate(el => el === document.activeElement), 'Le premier arrêt clavier doit permettre d’atteindre le contenu');
    await page.keyboard.press('Enter');
    assert.equal(new URL(page.url()).hash, '#studio-title');
    const toggle = page.locator('.studio-menu-toggle');
    if (await toggle.isVisible()) {
      const menu = page.locator('#studio-navigation');
      await toggle.focus();
      await page.keyboard.press('Enter');
      assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
      assert.ok(await menu.isVisible());
      await page.keyboard.press('Space');
      assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
    }
    for (const device of ['desktop', 'phone']) {
      const frame = hero.locator('[data-device="' + device + '"]');
      assert.ok(await frame.isVisible(), device);
      const images = await frame.evaluate(block => [...(block.matches('img') ? [block] : block.querySelectorAll('img'))].map(img => ({ src: img.currentSrc, width: img.naturalWidth, height: img.naturalHeight })));
      assert.ok(images.some(img => img.width > 100 && img.height > 100), device + ' sans capture chargée');
    }
    for (const target of ['#contact', '#avantages']) {
      const link = hero.locator('a[href="' + target + '"]');
      assert.equal(await link.count(), 1);
      assert.ok(await link.isVisible());
      const contrast = await link.evaluate(el => {
        function luminance(rgb) {
          const [r,g,b] = rgb.map(n => n / 255).map(n => n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4);
          return r * 0.2126 + g * 0.7152 + b * 0.0722;
        }
        const rgb = color => color.match(/[\d.]+/g)?.map(Number);
        const foreground = rgb(getComputedStyle(el).color);
        let background = [255,255,255];
        for (let node = el; node; node = node.parentElement) {
          const style = getComputedStyle(node);
          const color = rgb(style.backgroundColor);
          if (color && (color.length === 3 || color[3] === 1)) { background = color.slice(0, 3); break; }
          if (style.backgroundImage !== 'none') return null;
        }
        const lum = [luminance(foreground), luminance(background)].sort((a,b) => b-a);
        return (lum[0] + 0.05) / (lum[1] + 0.05);
      });
      if (contrast !== null) assert.ok(contrast >= 4.5, 'Contraste insuffisant pour ' + target + ' : ' + contrast);

      await link.focus();
      assert.ok(await link.evaluate(el => el === document.activeElement));
      await page.keyboard.press('Enter');
      await page.waitForFunction(hash => location.hash === hash, target);
      assert.ok(await page.locator(target).isVisible());
    }
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  }
  if (path === '/creation-application-mobile/') {
    assert.match(await page.locator('main').innerText(), /1\s?990\s?€/);
  }
  if (path === '/demarrer/' || path === '/demarrer/application/') assert.ok(await page.locator('form').first().isVisible());
  if (screenshots.has(path)) {
    await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo({ top: 0, behavior: 'instant' }); });
    await page.screenshot({ path: directory + '/' + screenshots.get(path) + '-' + width + '.png', animations: 'disabled' });
  }
  return { path, width, status: response.status(), language: layout.language };
}

try {
  await Promise.all(widths.map(async width => {
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
    await context.addInitScript(() => localStorage.setItem('flex-web-cookie-consent', 'refused'));
    await context.route('**/*', route => {
      const request = route.request(), host = new URL(request.url()).hostname;
      return !['GET', 'HEAD'].includes(request.method()) || /(?:googletagmanager|google-analytics|clarity\.ms)/.test(host) ? route.abort() : route.continue();
    });
    for (const path of routes) {
      const page = await context.newPage();
      const pageErrors = [];
      page.on('pageerror', error => pageErrors.push(error.message));
      page.on('response', response => {
        const url = new URL(response.url());
        if (url.origin === origin && response.status() >= 400 && url.pathname !== missing) pageErrors.push(response.status() + ' ' + url.pathname);
      });
      try {
        const result = await check(page, path, width);
        assert.deepEqual(pageErrors, []);
        results.push(result);
      } catch (e) { errors.push({ path, width, message: e.message, pageErrors }); }
      finally { await page.close(); }
    }
    await context.close();
  }));
} finally { await browser.close(); }
await writeFile(directory + '/navigation.json', JSON.stringify({ origin, results, errors }, null, 2) + '\n');
console.log(results.length, 'affichages contrôlés pour', origin);
assert.deepEqual(errors, []);
