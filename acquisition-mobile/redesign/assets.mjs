import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {readHTTP} from '../catalogue/audit/inspect.mjs';
import {parallel} from '../catalogue/netlify.mjs';
import {sha} from '../scripts/baseline.mjs';
import {directory, save} from './manifest.mjs';

const origin = new URL(process.argv[2]).origin;
assert.match(origin, /^https:\/\/[a-f0-9]{24}--flex-webb\.netlify\.app$/);
const changed = JSON.parse(await readFile(join(directory, 'changes.json'), 'utf8'));
const assets = new Map(changed.map(file => [file.path.toLowerCase(), file]));
const userVisibleStyles = new Set();
for (const sample of ['/', '/creation-site-internet/', '/entrepreneurs/metiers/electricien/', '/projets-sites/entreprises/paris-fr-75056/']) {
  const {bytes} = await readHTTP(origin, sample);
  for (const match of bytes.toString().matchAll(/href=["']([^"'?#]+\.css)["']/gi)) {
    const ref = new URL(match[1], origin + sample);
    if (ref.origin === origin && assets.has(ref.pathname.toLowerCase())) userVisibleStyles.add(ref.pathname);
  }
}
assert.ok(userVisibleStyles.size >= 2, 'Les gabarits doivent charger les feuilles de la refonte');
const required = new Map(changed.map(file => [file.path.replace(/\/index\.html$/, '/'), file.hash]));
for (const path of userVisibleStyles) required.set(path, assets.get(path.toLowerCase()).hash);
const report = [];
await parallel([...required], 5, async ([path, hash]) => {
  const {bytes, type} = await readHTTP(origin, path);
  assert.equal(sha(bytes), hash, 'Empreinte livrée au visiteur ' + path);
  if (path.endsWith('.css')) assert.match(type, /text\/css/i, path);
  if (path.endsWith('/')) assert.match(type, /text\/html/i, path);
  if (path.endsWith('.webp')) assert.match(type, /image\/webp/i, path);
  report.push({path, hash, size: bytes.length, type});
});
await save('qa/overlay-' + new URL(origin).hostname + '.json', report.sort((a, b) => a.path.localeCompare(b.path, 'en')));
console.log(changed.length + ' fichiers de la refonte livrés avec les bonnes empreintes, ' + required.size + ' URL HTTP 200 vérifiées.');
