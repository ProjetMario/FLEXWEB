import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {slugify} from '../../src/lib/seo/territorial-drafts.mjs';
import {englishPath} from '../../src/lib/seo/english.mjs';
import {expectedPaths} from './check.mjs';

// The first two variants of 0deddbd's globalEntries() covered every commune
// in this exact snapshot. Its third variant covered a different search intent.
const snapshot = new URL('../../src/data/national/communes-france.json', import.meta.url);
const snapshotDigest = '899ac865b0e288fcacf8507f986e913a1db3a34e520491a0d1b14214b8d39447';
const families = new Map([['websites-en', 'sites'], ['ai-automation-en', 'automatisation']]);

export async function buildLegacyRedirects() {
  const source = await readFile(snapshot);
  assert.equal(createHash('sha256').update(source).digest('hex'), snapshotDigest,
    'Les anciennes adresses doivent être dérivées du fichier communal de 0deddbd.');
  const {communes} = JSON.parse(source);
  const pairs = new Map();
  const unmatched = {};
  for (const [family, axis] of families) {
    unmatched[family] = 0;
    for (const commune of communes) {
      const slug = slugify(commune.name) + '-' + commune.code.toLowerCase();
      const from = '/global/' + family + '/' + slug + '/';
      const to = englishPath(axis, commune);
      if (!expectedPaths.has(to)) {
        unmatched[family]++;
        continue;
      }
      assert.ok(!expectedPaths.has(from), 'La source est déjà une page canonique : ' + from);
      assert.ok(!pairs.has(from), 'Ancienne adresse en double : ' + from);
      pairs.set(from, to);
    }
  }
  // Netlify normalizes trailing slashes in _redirects. Literal paths leave
  // unlisted communes and unrelated /global/ requests to the normal 404.
  const lines = [...pairs.keys()].sort().map(from => from + ' ' + pairs.get(from) + ' 301');
  const bytes = Buffer.from(lines.join('\n') + '\n', 'utf8');
  return {bytes, pairs, unmatched};
}
