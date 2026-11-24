import assert from 'node:assert/strict';
import {readFile, rename, stat, writeFile} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {buildLegacyRedirects} from '../../acquisition-mobile/catalogue/legacy-global.mjs';
import {readSitemap} from './read-sitemap.mjs';

const origin = 'https://flex-web.fr';
const begin = '# BEGIN Flex-Web legacy global redirects\n';
const end = '# END Flex-Web legacy global redirects\n';

export async function writeBuildRedirects(dist, pairs) {
  const filename = join(dist, '_redirects');
  const original = await readFile(filename, 'utf8');
  const start = original.indexOf(begin);
  const stop = original.indexOf(end);
  assert.equal(start === -1, stop === -1, 'Bloc de redirections générées incomplet');
  let base = original;
  if (start !== -1) {
    assert.ok(start < stop && original.lastIndexOf(begin) === start && original.lastIndexOf(end) === stop);
    base = original.slice(0, start) + original.slice(stop + end.length);
  }
  const existing = new Map();
  for (const line of base.split('\n')) {
    const [from, to, status = '301'] = line.trim().split(/\s+/);
    if (from.startsWith('/global/')) existing.set(from.replace(/\/$/, '') + '/', {to, status});
  }
  const urls = new Set(await readSitemap(origin + '/sitemap.xml',
    url => readFile(join(dist, new URL(url).pathname), 'utf8')));
  const added = [];
  for (const [from, to] of pairs) {
    if (!urls.has(origin + to) || urls.has(origin + from)) continue;
    assert.ok((await stat(join(dist, to, 'index.html'))).isFile(), 'Cible du sitemap sans fichier HTML : ' + to);
    if (existing.has(from)) {
      assert.deepEqual(existing.get(from), {to, status: '301'}, 'Règle existante incompatible : ' + from);
      continue;
    }
    added.push(from + ' ' + to + ' 301');
  }
  const block = added.length ? begin + added.sort().join('\n') + '\n' + end : '';
  const separator = block && base && !base.endsWith('\n') ? '\n' : '';
  const output = base + separator + block;
  if (output !== original) {
    const temporary = filename + '.' + process.pid;
    await writeFile(temporary, output);
    await rename(temporary, filename);
  }
  return added.length;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const {pairs} = await buildLegacyRedirects();
  console.log(await writeBuildRedirects(resolve(process.argv[2] || 'dist'), pairs),
    'anciennes adresses avec une cible anglaise dans ce build');
}
