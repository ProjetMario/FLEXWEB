import assert from 'node:assert/strict';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from 'smol-toml';
import { api, baseId, cache, filePath, linkPages, output, sha, site, snapshot } from './baseline.mjs';
import { pages } from './assemble.mjs';
import { assertFunctions, digestOf, functionPayload, manifestOf, waitReady } from './deploys.mjs';

const rawHeaders = { 'Content-Type': 'application/vnd.bitballoon.v1.raw' };
const jsonHeaders = { 'Content-Type': 'application/json' };
const allowHTML = new Set([...pages.map(p => p.path), ...linkPages, '/demarrer/', '/demarrer/application/'].map(filePath));
const allowText = new Set(['/llms.txt', '/llms-full.txt', '/ai-overview.txt', '/sitemap.xml']);

async function *walk(directory, prefix = '') {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = prefix + '/' + entry.name;
    if (entry.isDirectory()) yield *walk(join(directory, entry.name), path);
    else {
      assert.ok(entry.isFile(), 'Fichier normal attendu : ' + path);
      yield path;
    }
  }
}

async function routing(manifest) {
  const original = await api('/sites/' + site + '/files/netlify.toml', { headers: rawHeaders }, true);
  assert.equal(sha(original), manifest['/netlify.toml'], 'Configuration Netlify en production');
  const config = parse(original.toString());
  assert.equal(config.redirects.length, 444);
  assert.equal(config.headers.length, 1);
  const archive = await readFile(join(cache, 'baseline/_redirects'), 'utf8');
  const built = await readFile(join(output, '_redirects'), 'utf8');
  assert.ok(built.endsWith(archive), 'Toutes les anciennes règles doivent être conservées');
  const rules = built.slice(0, -archive.length).trim().split('\n').map(line => {
    const tokens = line.trim().split(/\s+/);
    assert.equal(tokens.shift(), '/demarrer/');
    assert.equal(tokens.pop(), '200!');
    assert.equal(tokens.pop(), '/demarrer/application/');
    const query = Object.fromEntries(tokens.map(token => token.split('=')));
    assert.ok(['application', 'app'].includes(query.service));
    assert.ok(Object.keys(query).every(k => ['service', 'offre', 'utm_source'].includes(k)));
    return { from: '/demarrer/', to: '/demarrer/application/', force: true, status: 200, query };
  });
  assert.equal(rules.length, 8);
  const additions = rules.map(rule =>
    '[[redirects]]\nfrom = "/demarrer/"\nto = "/demarrer/application/"\nstatus = 200\nforce = true\n[redirects.query]\n' +
      Object.entries(rule.query).map(([key, value]) => key + ' = ' + JSON.stringify(value)).join('\n') + '\n\n'
  ).join('');
  const text = original.toString().replace('[[redirects]]', additions + '[[redirects]]');
  const result = parse(text);
  assert.deepEqual(result.redirects.slice(0, rules.length), rules);
  assert.deepEqual({ ...result, redirects: result.redirects.slice(rules.length) }, config);
  return { bytes: Buffer.from(text), config: result };
}

const { deploy: current, manifest } = await snapshot();
const base = await api('/deploys/' + baseId);
assert.equal(base.site_id, site);
assert.ok(!base.edge_functions_present);
assert.ok(!base.server);
assert.equal(base.available_functions.length, 2);
const files = { ...manifest };
const routingConfig = await routing(manifest);
const uploads = new Map();
function add(path, bytes) {
  const key = path.toLowerCase();
  const hash = sha(bytes);
  if (files[key] === hash) return;
  files[key] = hash;
  uploads.set(hash, { path, bytes });
}
add('/netlify.toml', routingConfig.bytes);
for await (const path of walk(output)) {
  if (path === '/_redirects') continue; // Netlify consumes the compiled configuration above.
  assert.ok(allowHTML.has(path) || allowText.has(path) ||
    /^\/(?:_astro\/StartApplication\.[a-f0-9]+\.js|mobile-assets\/[\w.-]+\.js|images\/footnation\/(?:fr|en)-iphone-[12]\.jpg)$/.test(path),
    'Fichier imprévu : ' + path);
  add(path, await readFile(join(output, path)));
}
assert.equal(files['/index.html'], manifest['/index.html']);
assert.ok(Object.keys(manifest).every(key => Object.hasOwn(files, key)));
const { functions, functions_config } = functionPayload(base);
const digest = digestOf(files);
const pending = join(cache, 'preview-pending.json');
let id;
let required;
try {
  const previous = JSON.parse(await readFile(pending, 'utf8'));
  if (previous.digest === digest) {
    id = previous.id;
    required = previous.required;
  }
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
if (!id) {
  const created = await api('/sites/' + site + '/deploys?title=' + encodeURIComponent('Aperçu — Applications mobiles France et francophonie'), {
    method: 'POST', headers: jsonHeaders,
    body: JSON.stringify({ draft: true, branch: base.branch, files, functions, functions_config, function_schedules: base.function_schedules }),
  });
  id = created.id;
  required = created.required || [];
  assert.ok(id);
  await writeFile(pending, JSON.stringify({ id, digest, required }));
  console.log('Aperçu Netlify créé', id);
}
let deploy = await api('/deploys/' + id);
assert.equal(deploy.site_id, site);
assert.notEqual(id, baseId);
assert.deepEqual(deploy.required_functions || [], []);
assert.deepEqual(deploy.required_edge_functions || [], []);
if (!['ready', 'processing', 'processed'].includes(deploy.state)) {
  // The create response reports missing digests. A subsequent GET can report [] while uploads are pending.
  for (const hash of new Set(required || uploads.keys())) {
    const source = uploads.get(hash);
    assert.ok(source, 'Données manquantes pour ' + hash);
    const path = source.path.split('/').map(encodeURIComponent).join('/');
    await api('/deploys/' + id + '/files' + path, { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body: source.bytes }, true);
  }
}
deploy = await waitReady(id);
assertFunctions(base, deploy);
const messages = deploy.summary.messages;
for (const title of [routingConfig.config.redirects.length + ' redirect rules processed', '1 header rule processed', '2 functions deployed']) {
  assert.ok(messages.some(m => m.title === title && m.type === 'info'), title);
}
assert.ok(messages.every(m => m.type === 'info'), 'Avertissement Netlify lors de l’aperçu');
const published = (await api('/sites/' + site)).published_deploy;
assert.equal(published.id, baseId);
assert.equal(published.locked, current.locked);
assert.equal(deploy.name, base.name);
assert.match(id, /^[a-f\d]{24}$/);
const url = 'https://' + id + '--' + base.name + '.netlify.app';
assert.deepEqual(await manifestOf(id, Object.keys(files).length), files, 'Inventaire complet de l’aperçu');
const configFile = await api('/deploys/' + id + '/files/netlify.toml', { headers: rawHeaders }, true);
assert.equal(sha(configFile), sha(routingConfig.bytes), 'Configuration Netlify déployée');
const home = await fetch(url + '/');
assert.equal(home.status, 200);
assert.equal(sha(Buffer.from(await home.arrayBuffer())), manifest['/index.html']);
for (const [key, value] of Object.entries(routingConfig.config.headers[0].values)) assert.equal(home.headers.get(key), value);
const redirects = routingConfig.config.redirects;
for (const rule of [redirects[8], redirects[223], redirects[449]]) {
  const response = await fetch(url + rule.from, { redirect: 'manual' });
  assert.equal(response.status, rule.status, rule.from);
  assert.equal(new URL(response.headers.get('location'), url).pathname, rule.to);
}
const receipt = { id, url, baseId, digest, files: Object.keys(files).length,
  redirects: redirects.length, headers: routingConfig.config.headers.length,
  functions: Object.keys(functions), schedules: deploy.function_schedules, productionLocked: published.locked };
await writeFile(join(cache, 'preview.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt, null, 2));
