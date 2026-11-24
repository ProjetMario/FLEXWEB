import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {test} from 'node:test';
import {chromium} from 'playwright';
import {insertContactForm} from './form.mjs';
import {transformPublicContact} from '../../../scripts/contact/public-contact.mjs';

async function contactPage(lang) {
  const path = lang === 'fr' ? '/contact/' : '/en/contact/';
  const snapshots = process.env.FLEXWEB_CONTACT_SNAPSHOTS;
  const link = '<a href="mailto:contact@flex-web.fr">Email Flex-Web ↗</a>';
  const heading = '<header><h1>Contact Flex-Web</h1>' + link + '</header>';
  const body = lang === 'fr'
    ? heading + '<div class="contact-options" style="display:grid"><section><dl><dt>E-mail</dt><dd>' + link + '</dd></dl></section><section class="contact-quote"><h2>Devis</h2></section></div>'
    : '<article>' + heading + '<section>Businesses and individuals can write their initial request in French or English by email.</section></article>';
  const source = snapshots
    ? await readFile(snapshots + '-' + lang + '-source.html', 'utf8')
    : '<!doctype html><html lang="' + lang + '"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="canonical" href="https://flex-web.fr' + path + '"></head><body><main>' + body
      + '<a href="tel:+33757830262">Téléphone</a><address>93 chemin de la Combe, 73420 Voglans</address><a href="/demarrer/">Devis</a></main></body></html>';
  const html = insertContactForm(transformPublicContact(path + 'index.html',source),lang);
  assert.equal(insertContactForm(html,lang), html);
  return html;
}

test('Contact can send general messages in French and English, with and without JavaScript', async t => {
  const requests = [];
  let responseMode = 'success';
  const pages = {'/contact/': await contactPage('fr'), '/en/contact/': await contactPage('en')};
  const assets = new Map();
  for (const ext of ['css','mjs']) {
    const path = '/contact-assets/contact-form.' + ext;
    assets.set(path, await readFile(new URL('../../../public' + path, import.meta.url)));
  }
  const server = createServer(async (req,res) => {
    const path = req.url;
    if (req.method === 'POST' && pages[path]) {
      const data = [];
      for await (const chunk of req) data.push(chunk);
      requests.push({path, data: Object.fromEntries(new URLSearchParams(Buffer.concat(data).toString())), type:req.headers['content-type']});
      res.writeHead(responseMode === 'failed' ? 503 : 200, {'Content-Type':'text/html; charset=utf-8'});
      res.end(responseMode === 'success' ? '<html><title>Message received</title><h1>Thank you</h1></html>' : pages[path]);
      return;
    }
    if (pages[path]) { res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'}); res.end(pages[path]); return; }
    if (assets.has(path)) { res.writeHead(200, {'Content-Type':path.endsWith('.css') ? 'text/css' : 'text/javascript'}); res.end(assets.get(path)); return; }
    res.writeHead(404); res.end();
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch();
  t.after(() => browser.close());
  for (const [path,html] of Object.entries(pages)) {
    const lang = path.startsWith('/en/') ? 'en' : 'fr';
    const parsedMain = html.match(/<main\b[\s\S]*?<\/main>/i)[0];
    assert.doesNotMatch(parsedMain, /<dt[^>]*>E-mail|mailto:contact@|by email|>Email Flex-Web/i);
    for (const [width,script] of [[320,true],[1440,true],[390,false]]) {
      await t.test(lang + ' ' + width + (script ? ' JS' : ' native'), async t => {
        const context = await browser.newContext({viewport:{width,height:900},javaScriptEnabled:script});
        t.after(() => context.close());
        await context.route('**/*', route => {
          const url = new URL(route.request().url());
          if (url.origin === origin && (pages[url.pathname] || assets.has(url.pathname))) return route.continue();
          return route.abort();
        });
        const page = await context.newPage();
        await page.goto(origin + path);
        const main = page.locator('main');
        assert.equal(await main.locator('h1').count(),1);
        assert.equal(await main.locator('form').count(),1);
        assert.ok(await main.locator('a[href="tel:+33757830262"]').first().isVisible());
        assert.match(await main.textContent(),/73420 Voglans/);
        const form = page.locator('form[name="flexweb-contact"]');
        assert.equal(await form.getAttribute('action'),null);
        assert.equal(await form.getAttribute('method'),'post');
        assert.equal(await form.locator('[type="tel"],[name="budget"]').count(),0);
        const bounds = await form.boundingBox();
        assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width+1);
        if (lang === 'fr' && width < 500) {
          const telephone = await main.locator('a[href="tel:+33757830262"]').first().boundingBox();
          assert.ok(bounds.y < telephone.y, 'The form appears before the telephone link on mobile');
        }
        assert.ok(await form.locator('a[href="/privacy/"]').isVisible());
        assert.ok(await main.locator('a[href="/demarrer/"]').first().isVisible());
        const message = 'A fictional example for a local form test only.';
        const submit = form.locator('button[type=submit]');
        await form.locator('[name=email]').fill('person@example.invalid');
        await form.locator('[name=message]').fill(message);
        await form.locator('[name=topic]').selectOption('privacy');
        const start = requests.length;
        await submit.click();
        assert.equal(await form.locator('[name=consent]').evaluate(e=>e.validity.valueMissing),true);
        assert.equal(requests.length,start);
        await form.locator('[name=consent]').check();
        if (script) {
          const status = page.locator('[data-contact-status]');
          for (const mode of ['failed','unhandled']) {
            responseMode = mode;
            await Promise.all([page.waitForResponse(r=>r.request().method()==='POST'), submit.click()]);
            await page.waitForFunction(()=>document.querySelector('[data-contact-status]').hasAttribute('data-error') && !document.querySelector('form[data-flexweb-contact]').hasAttribute('aria-busy'));
            assert.equal(await form.locator('[name=message]').inputValue(),message);
            assert.ok(await form.isVisible());
            assert.ok(await submit.isEnabled());
          }
          responseMode = 'success';
          await submit.click();
          await form.waitFor({state:'hidden'});
          assert.ok(await status.isVisible());
          assert.ok(await status.evaluate(e=>e===document.activeElement));
          assert.equal(await status.textContent(), await form.getAttribute('data-success'));
          assert.equal(requests.length,start+3);
        } else {
          responseMode = 'success';
          const [navigation] = await Promise.all([page.waitForNavigation(),submit.click()]);
          assert.equal(navigation.request().method(),'POST');
          assert.equal(await page.title(),'Message received');
          assert.equal(requests.length,start+1);
        }
        const sent=requests.at(-1);
        assert.equal(sent.path,path);
        assert.match(sent.type,/^application\/x-www-form-urlencoded/);
        assert.deepEqual(sent.data, {'form-name':'flexweb-contact', language:lang, 'bot-field':'', name:'', email:'person@example.invalid', topic:'privacy', message, consent:'yes'});
      });
    }
  }
});
