import assert from 'node:assert/strict';
import test from 'node:test';
import {withPostalFooter} from './postal-footer.mjs';

test('restores the office address once and preserves home footer links', () => {
  const footer = '<footer class="studio-foot"><div><span>© Flex-Web</span><a href="/cgv/">CGV</a></div></footer>';
  const out = withPostalFooter(footer);
  assert.match(out, /<address [^>]*><strong>Flex Web by Flex Immo<\/strong><br>93 chemin de la Combe<br>73420 Voglans, France<\/address>/);
  assert.ok(out.includes('<a href="/cgv/">CGV</a>'));
  assert.equal(withPostalFooter(out),out);
});

test('leaves client demo footers alone and keeps the English directory contact links', () => {
  const demo = '<footer>Example shop</footer>';
  assert.equal(withPostalFooter(demo),demo);
  const links = '<a href="mailto:contact@flex-web.fr">contact@flex-web.fr</a> · <a href="tel:+33757830262">Call</a>';
  const footer = '<footer><nav><button id="english-cookie-settings">Cookies</button></nav><p>Flex-Web · Fleximmo · 93 chemin de la Combe, 73420 Voglans, France · '+links+'</p></footer>';
  const out = withPostalFooter(footer);
  assert.equal(out.split('93 chemin de la Combe').length,2);
  assert.ok(out.includes(links));
});

test('restores the React footer as static HTML and retains its consent event', () => {
  const input = '<astro-island component-url="/_astro/Footer.abc.js"><footer><div><a href="/"><img src="/logo.png"></a></div><button type="button">Choix des cookies</button></footer></astro-island>';
  const out = withPostalFooter(input,'de');
  assert.match(out,/73420 Voglans, Frankreich/);
  assert.doesNotMatch(out,/<astro-island\b/);
  assert.match(out,/type="button" data-flexweb-footer-cookies/);
  assert.match(out,/new Event\("flexweb-cookie-settings"\)/);
});
