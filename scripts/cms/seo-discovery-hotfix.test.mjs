import test from 'node:test';
import assert from 'node:assert/strict';
import { assertScopedManifest, assertSitemapScope, TARGETS, MARKER, SITEMAP } from './seo-discovery-hotfix.mjs';
const file = (path, sha256 = 'old') => ({ path, sha256, size: 10 });
const before = { files: [...TARGETS, MARKER, SITEMAP, 'index.html', '_astro/shared.js'].map(path => file(path)) };
test('scoped publication allows only the two pages, their metadata and new referenced assets', () => {
  const after = { files: before.files.map(f => TARGETS.includes(f.path) ? file(f.path, 'new') : f).concat(file('_astro/new.js', 'new')) };
  assert.equal(assertScopedManifest(before, after, ['_astro/new.js']).length, 3);
});
test('scoped publication rejects deletion, unrelated HTML and overwritten shared assets', () => {
  assert.throws(() => assertScopedManifest(before, { files: before.files.slice(1) }, []), /PUBLISHED_FILE_REMOVED/);
  for (const [target, expected] of [['index.html', /UNRELATED_FILE_CHANGED/], ['_astro/shared.js', /EXISTING_SHARED_ASSET_CHANGED/]]) {
    const after = { files: before.files.map(f => f.path === target ? file(f.path, 'new') : f) };
    assert.throws(() => assertScopedManifest(before, after, ['_astro/shared.js']), expected);
  }
});
test('sitemap dates may change only for the two edited pages; URL inventory is immutable', () => {
  const item = (route, date) => '<url><loc>https://flex-web.fr/' + route + '</loc><lastmod>' + date + '</lastmod></url>';
  const old = item('journal/', '2026-11-03') + item('pricing/', '2026-10-01');
  assert.doesNotThrow(() => assertSitemapScope(old, old.replace('2026-11-03', '2026-11-13')));
  assert.throws(() => assertSitemapScope(old, old.replace('2026-10-01', '2026-11-13')), /UNRELATED_SITEMAP_ENTRY_CHANGED/);
  assert.throws(() => assertSitemapScope(old, old.replace('pricing/', 'contact/')), /SITEMAP_URLS_CHANGED/);
  assert.throws(() => assertSitemapScope(old, old + item('journal/', '2026-11-13')), /DUPLICATE_SITEMAP_URL/);
});
