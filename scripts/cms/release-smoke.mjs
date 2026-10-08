import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import { chromium } from 'playwright';

const origin = process.argv[2] || 'http://127.0.0.1:4321';
const url = new URL(origin);
if (!((url.protocol === 'http:' && url.hostname === '127.0.0.1') || (url.protocol === 'https:' && /^[a-z0-9-]+--flex-webb\.netlify\.app$/.test(url.hostname)))) throw new Error('Unexpected preview origin');
const paths = ['/journal/assistant-ia-interne-entreprise/', '/about/', '/creation-site-internet-savoie/', '/creation-site-internet-haute-savoie/', '/automatisation-ia-savoie/', '/automatisation-ia-haute-savoie/', '/creation-application-mobile-savoie/', '/creation-application-mobile-haute-savoie/', '/realisations/foot-nation/', '/realisations/2savoie-immo/', '/realisations/serrurier73/', '/territoires/', '/territoires/departements/38/', '/territoires/sites/montalieu-vercieu-38247/'];
const browser = await chromium.launch({ headless: true });
await mkdir('.cms/smoke', {recursive:true});
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
      const navigationTarget = pathname === '/territoires/' ? '/territoires/departements/38/'
        : pathname === '/territoires/departements/38/' ? '/territoires/sites/montalieu-vercieu-38247/' : null;
      const action = page.locator(navigationTarget ? `a[href="${navigationTarget}"]` : 'a[href*="/demarrer/"]').first();
      assert.ok(await action.count(), `missing primary action ${pathname}`);
      if(navigationTarget)assert.ok((await response.text()).includes(`href="${navigationTarget}"`),`directory link must exist without JavaScript: ${pathname}`);
      await action.focus();
      assert.equal(await action.evaluate(element => element === document.activeElement), true, `keyboard ${pathname}`);
      if(pathname==='/territoires/'){
        await page.getByLabel('Commune, code postal ou code INSEE').fill('Montalieu-Vercieu');
        await page.getByRole('button',{name:'Rechercher les fiches',exact:true}).click();
        await page.locator('#territory-search-results a[href="/territoires/sites/montalieu-vercieu-38247/"]').waitFor();
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),true,`search overflow ${width}`);
      }
      if(pathname.startsWith('/territoires/')) await page.screenshot({path:`.cms/smoke/${pathname.split('/').filter(Boolean).join('-')}-${width}.png`,fullPage:true});
    }
    await context.close();
  }
  console.log(`EmDash preview: ${paths.length} pages × 3 widths, canonical, primary actions, territorial links/search and keyboard checks passed; external APIs blocked.`);
} finally { await browser.close(); }
