import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import handler, { config } from '../../netlify/functions/retired-content.mts';

test('only the retired product articles return 410, with and without a trailing slash', async () => {
  assert.equal((config.path as string[]).length, 12);
  for (const route of config.path as string[]) {
    const response = await handler(new Request(`https://flex-web.fr${route}?utm_source=archive`));
    assert.equal(response.status, 410, route);
    assert.equal(response.headers.get('location'), null);
    assert.equal(response.headers.get('x-robots-tag'), 'noindex, follow');
    const body = await response.text();
    assert.match(body, /<h1>Cet article n’est plus disponible/);
    assert.match(body, /href="\/journal\/"/);
    assert.doesNotMatch(body, /rel="canonical"/);
    const head = await handler(new Request(`https://flex-web.fr${route}`, {method:'HEAD'}));
    assert.equal(head.status, 410);
    assert.equal(await head.text(), '');
  }
});

test('retirement is not a journal wildcard and no obsolete 301 can win before the function', async () => {
  for (const route of ['/journal/', '/journal/taches-automatiser-pme/', '/demarrer/', '/espace-projet/']) {
    assert.equal((config.path as string[]).includes(route), false);
    assert.equal((await handler(new Request(`https://flex-web.fr${route}`))).status, 404);
  }
  const redirects = await readFile(new URL('../../public/_redirects', import.meta.url), 'utf8');
  assert.doesNotMatch(redirects, /^\/journal\/(?:dyson-microfan|supersonic-r-hair-dryer)/m);
});

test('mutation requests cannot be mistaken for a successful page response', async () => {
  const response = await handler(new Request(`https://flex-web.fr${(config.path as string[])[0]}`, {method:'POST'}));
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('allow'), 'GET, HEAD');
});
