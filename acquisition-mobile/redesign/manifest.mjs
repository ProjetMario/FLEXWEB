import assert from 'node:assert/strict';
import {mkdir, readFile, readdir, rename, writeFile} from 'node:fs/promises';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {expectedPaths} from '../catalogue/check.mjs';
import {assetReferences, inspectHTML} from '../catalogue/audit/inspect.mjs';
import {filesOf, netJSON} from '../catalogue/netlify.mjs';
import {cache, filePath, root, sha, site} from '../scripts/baseline.mjs';
import {assertFunctions, digestOf} from '../scripts/deploys.mjs';

export const directory = join(cache, 'redesign');
export const catalogue = JSON.parse(await readFile(join(root, 'catalogue/release-candidate.json'), 'utf8'));

export async function save(name, data) {
  const dest = join(directory, name);
  await mkdir(dirname(dest), {recursive: true});
  const temp = dest + '.' + process.pid;
  await writeFile(temp, JSON.stringify(data, null, 2) + '\n');
  await rename(temp, dest);
}

async function readTree(directory, prefix = '') {
  const items = [];
  for (const entry of await readdir(directory, {withFileTypes: true})) {
    if (entry.name === '.DS_Store') continue;
    assert.match(entry.name, /^[a-zA-Z0-9_@.-]+$/, 'Nom de fichier inattendu');
    const path = prefix + '/' + entry.name;
    const local = join(directory, entry.name);
    if (entry.isDirectory()) items.push(...await readTree(local, path));
    else {
      assert.ok(entry.isFile(), 'Fichier régulier attendu ' + path);
      items.push({path, bytes: await readFile(local)});
    }
  }
  return items;
}

function changedSet(paths) {
  assert.ok(Array.isArray(paths));
  return new Set(paths.map(path => path.toLowerCase()));
}

export function assemble(original, sources, report) {
  const files = {...original};
  const uploads = new Map(), changes = new Map();
  const html = changedSet(report.changedHTML), styles = changedSet(report.changedStylesheets);
  assert.ok(html.size > 0 && styles.size > 0, 'Rapport des pages et styles absent');
  const home = new Set(['/index.html', '/en/index.html']);
  for (const [owner, items] of Object.entries(sources)) {
    assert.ok(['home', 'shared'].includes(owner));
    for (const {path, bytes} of items) {
      const key = path.toLowerCase();
      const hash = sha(bytes);
      assert.ok(!changes.has(key), 'Deux composants écrivent ' + path);
      const asset = /^\/studio-redesign\/[a-z0-9_.@/-]+\.(?:css|js|mjs|webp|avif|jpe?g|png|svg|woff2?|mp4|webm)$/.test(key);
      const page = owner === 'home' ? home.has(key) : html.has(key) && key.endsWith('.html') && !home.has(key);
      const style = owner === 'shared' && styles.has(key) && /^\/_astro\/[\w.@-]+\.css$/.test(key);
      assert.ok(page || style || asset, 'Modification hors du périmètre visuel ' + path);
      if (page || style) assert.ok(Object.hasOwn(original, key), 'Page ou feuille absente du catalogue ' + key);
      assert.notEqual(hash, original[key], 'Fichier identique annoncé modifié ' + path);
      assert.ok(bytes.byteLength > 0, 'Fichier vide ' + path);
      changes.set(key, {path, hash, owner, added: !Object.hasOwn(original, key)});
      uploads.set(hash, {path, bytes});
      files[key] = hash;
    }
  }
  for (const key of home) assert.equal(changes.get(key)?.owner, 'home', key);
  for (const key of [...html, ...styles]) assert.equal(changes.get(key)?.owner, 'shared', key);
  return {files, uploads, changes};
}

export async function prepare() {
  const [original, immutable, current, report, home, shared] = await Promise.all([
    filesOf(catalogue.id), netJSON('/deploys/' + catalogue.id), netJSON('/sites/' + site),
    readFile(join(directory, 'shared-report.json'), 'utf8').then(JSON.parse),
    readTree(join(directory, 'home')), readTree(join(directory, 'shared')),
  ]);
  assert.equal(immutable.site_id, site);
  assert.equal(immutable.state, 'ready');
  assert.equal(Object.keys(original).length, catalogue.files);
  assert.equal(digestOf(original), catalogue.digest);
  const live = current.published_deploy;
  assert.equal(live.id, catalogue.baseId, 'Production modifiée depuis le catalogue, réconcilier le nouvel inventaire');
  assert.equal(live.locked, catalogue.productionLocked);
  assertFunctions(live, immutable);
  const {files, uploads, changes} = assemble(original, {home, shared}, report);
  for (const route of expectedPaths) assert.ok(Object.hasOwn(files, filePath(route).toLowerCase()), route);
  assert.equal(expectedPaths.size, catalogue.routes);
  const preservedMaps = Object.keys(original).filter(path => path === '/sitemap.xml' || /^\/sitemaps\/[^/]+\.xml$/.test(path));
  assert.equal(preservedMaps.length, catalogue.sitemaps + 1);
  for (const key of [...preservedMaps, '/robots.txt', '/netlify.toml']) assert.equal(files[key], original[key], key);
  const references = new Set();
  for (const {path, bytes} of [...home, ...shared]) {
    if (path.endsWith('.css')) for (const asset of assetReferences(bytes, path)) references.add(asset);
    if (path.endsWith('index.html')) {
      const route = path.slice(0, -'index.html'.length);
      if (expectedPaths.has(route)) {
        const checked = inspectHTML(bytes, route);
        for (const asset of checked.assets) references.add(asset);
      }
    }
  }
  for (const asset of references) assert.ok(Object.hasOwn(files, asset.toLowerCase()), 'Ressource absente du manifeste ' + asset);
  const added = [...changes.values()].filter(file => file.added);
  assert.equal(Object.keys(files).length, catalogue.files + added.length);
  const facts = {
    ...catalogue, sourceCatalogueId: catalogue.id, digest: digestOf(files), files: Object.keys(files).length,
    originalFiles: catalogue.files, addedAssets: added.length, redesignedHTML: report.changedHTML.length + 2,
    redesignedStylesheets: report.changedStylesheets.length,
  };
  delete facts.id;
  delete facts.url;
  await save('changes.json', [...changes.values()].sort((a, b) => a.path.localeCompare(b.path, 'en')));
  return {files, uploads, immutable, facts};
}

if (process.argv[1] === fileURLToPath(import.meta.url)) console.log((await prepare()).facts);
