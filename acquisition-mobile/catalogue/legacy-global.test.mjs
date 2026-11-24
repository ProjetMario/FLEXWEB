import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {urlset} from '../../src/lib/seo/xml.mjs';
import {writeBuildRedirects} from '../../scripts/seo/build-legacy-global-redirects.mjs';
import {expectedPaths} from './check.mjs';
import {buildLegacyRedirects} from './legacy-global.mjs';

const {bytes, pairs, unmatched} = await buildLegacyRedirects();

test('chaque 301 relie la même intention anglaise à la même commune du sitemap', () => {
  const rules = bytes.toString().trimEnd().split('\n');
  assert.equal(rules.length, 9998);
  assert.equal(new Set(rules).size, pairs.size);
  assert.equal(new Set(pairs.values()).size, pairs.size);
  for (const rule of rules) {
    const [from, to, status] = rule.split(' ');
    const [, family, slug] = from.match(/^\/global\/(websites|ai-automation)-en\/([a-z0-9-]+-[a-z0-9]{5})\/$/);
    assert.equal(status, '301');
    assert.equal(to, '/en/locations/' + family + '/' + slug + '/');
    assert.equal(pairs.get(from), to);
    assert.ok(expectedPaths.has(to));
    assert.ok(!expectedPaths.has(from));
  }
  assert.deepEqual(unmatched, {'websites-en': 29961, 'ai-automation-en': 29961});
  for (const slug of ['paris-75056', 'ajaccio-2a004', 'l-hay-les-roses-94038']) {
    assert.ok(pairs.has('/global/websites-en/' + slug + '/'));
    assert.ok(pairs.has('/global/ai-automation-en/' + slug + '/'));
  }
});

test('une commune sans cible, une cible sans ancienne source et une intention différente restent libres', () => {
  assert.ok(expectedPaths.has('/territoires/sites/l-abergement-clemenciat-01001/'));
  assert.ok(expectedPaths.has('/en/locations/websites/uvea-98613/'));
  for (const path of [
    '/global/websites-en/l-abergement-clemenciat-01001/', '/global/websites-en/uvea-98613/',
    '/global/seo-geo-audit/paris-75056/', '/global/websites-en/paris-00000/',
    '/global/ai-automation-en/page/2/', '/global/websites-en/',
  ]) assert.ok(!pairs.has(path), path);
});

test('le build normal préserve les règles existantes et suit le sitemap effectivement rendu', async t => {
  const dist = await mkdtemp(join(tmpdir(), 'flex-web-global-'));
  t.after(() => rm(dist, {recursive: true, force: true}));
  const paris = '/global/websites-en/paris-75056/';
  const ajaccio = '/global/websites-en/ajaccio-2a004/';
  const toParis = pairs.get(paris);
  const toAjaccio = pairs.get(ajaccio);
  const candidates = new Map([[paris, toParis], [ajaccio, toAjaccio]]);
  const redirects = join(dist, '_redirects');
  const baseline = '/old/ /new/ 301\n';
  await writeFile(redirects, baseline);
  const sitemap = paths => writeFile(join(dist, 'sitemap.xml'), urlset(paths.map(url => ({url}))));
  await mkdir(join(dist, toParis), {recursive: true});
  await writeFile(join(dist, toParis, 'index.html'), '<h1>Paris</h1>');
  await sitemap([toParis]);
  assert.equal(await writeBuildRedirects(dist, candidates), 1);
  const result = await readFile(redirects, 'utf8');
  assert.ok(result.startsWith(baseline));
  assert.ok(result.includes(paris + ' ' + toParis + ' 301\n'));
  assert.ok(!result.includes(ajaccio));
  assert.equal(await writeBuildRedirects(dist, candidates), 1);
  assert.equal(await readFile(redirects, 'utf8'), result);
  await sitemap([toParis, toAjaccio]);
  await assert.rejects(writeBuildRedirects(dist, candidates), {code: 'ENOENT'});
  assert.equal(await readFile(redirects, 'utf8'), result);
  await sitemap([toParis, paris]);
  assert.equal(await writeBuildRedirects(dist, candidates), 0);
  assert.equal(await readFile(redirects, 'utf8'), baseline);
  await sitemap([toParis]);
  const existing = baseline + paris.slice(0, -1) + ' ' + toParis + ' 301\n';
  await writeFile(redirects, existing);
  assert.equal(await writeBuildRedirects(dist, candidates), 0);
  assert.equal(await readFile(redirects, 'utf8'), existing);
});
