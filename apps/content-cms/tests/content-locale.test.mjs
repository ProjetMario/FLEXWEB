import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import config from '../astro.config.mjs';
import { onRequest } from '../src/middleware.js';
import { AstroConfigSchema } from '../node_modules/astro/dist/core/config/schemas/base.js';
// These native modules are pinned by the EmDash 1.0.1 lockfile. Exercise the
// installed normalization/default rules instead of copying them into the test.
import { c as normalizeAstroI18n } from '../node_modules/emdash/dist/manifest-builder-8jsSLR7s.mjs';
import {
  c as setI18nConfig,
  r as getI18nConfig,
  i as isI18nEnabled,
  o as resolveConfiguredLocale,
  s as resolveContentCreateLocale,
} from '../node_modules/emdash/dist/config-CvmjJcVw.mjs';

test('CMS declares French for new native content without enabling locale routing or filtering existing languages', () => {
  const seed = JSON.parse(readFileSync(new URL('../seed/seed.json', import.meta.url)));
  const accepted = AstroConfigSchema.shape.i18n.parse(config.i18n);
  assert.equal(accepted.defaultLocale, seed.defaultLocale);
  assert.equal(accepted.defaultLocale, 'fr');
  assert.deepEqual(accepted.locales, ['fr']);
  assert.equal(accepted.routing, 'manual');

  const normalized = normalizeAstroI18n(accepted);
  assert.equal(normalized.prefixDefaultLocale, false);
  const previous = getI18nConfig();
  try {
    setI18nConfig(normalized);
    // Native CREATE defaults to the runtime locale, including when the
    // single-locale UI omits locale from its payload.
    assert.equal(getI18nConfig().defaultLocale, 'fr');
    assert.equal(resolveContentCreateLocale(undefined), 'fr');
    assert.equal(resolveContentCreateLocale('fr'), 'fr');
    assert.equal(resolveConfiguredLocale('FR'), 'fr');
    // A single locale does not enable the manifest's multilingual list filter.
    // Lookup of an existing entry in another locale does not relabel it.
    assert.equal(isI18nEnabled(), false);
    assert.equal(resolveConfiguredLocale('en'), 'en');
  } finally {
    setI18nConfig(previous);
  }
});

test('manual locale middleware preserves CMS routes and downstream authentication responses', async () => {
  for (const path of ['/_emdash/admin/login', '/_emdash/api/content/pages', '/api/flexweb/snapshots']) {
    const context = { url: new URL(path, 'https://cms.example.test'), request: new Request(`https://cms.example.test${path}`) };
    const response = new Response('authentication required', { status: 401, headers: { 'Cache-Control': 'private, no-store' } });
    let calls = 0;
    const result = await onRequest(context, () => { calls++; return response; });
    assert.equal(calls, 1);
    assert.equal(result, response);
    assert.equal(context.url.pathname, path);
    assert.equal(context.request.url, `https://cms.example.test${path}`);
    assert.equal(result.headers.get('Location'), null);
    assert.equal(result.status, 401);
    assert.equal(result.headers.get('Cache-Control'), 'private, no-store');
  }
});
