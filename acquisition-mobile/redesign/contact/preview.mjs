import assert from 'node:assert/strict';
import {createHash, randomUUID} from 'node:crypto';
import {mkdir, readFile, readdir, rename, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {setTimeout as sleep} from 'node:timers/promises';
import {cache, site, sha} from '../../scripts/baseline.mjs';
import {digestOf, functionPayload} from '../../scripts/deploys.mjs';
import {filesOf, netJSON, parallel, rawFile, request, waitDeploy} from '../../catalogue/netlify.mjs';
import {transformPublicContact, hasPublicMailbox, isPublicContactAsset} from '../../../scripts/contact/public-contact.mjs';
import {insertContactForm} from './form.mjs';
import {prepareAutomation} from './automation.mjs';
import {gzipSync, gunzipSync} from 'node:zlib';
import {buildEdge, bundleDirectory, cataloguePrefixes} from './bundle.mjs';

const directory = join(cache, 'contact');
const base = (await netJSON('/sites/' + site)).published_deploy;
assert.equal(base.state, 'ready');
assert.ok(!base.edge_functions_present, 'Preserve the existing edge configuration before adding new routes');
const files = await filesOf(base.id);
const original = {...files};
const {expectedPaths} = await import('../../catalogue/check.mjs');
const uploads = new Map();
const edgeUploads = new Map();
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
function stage(path, bytes) {
  const digest = sha(bytes);
  if (files[path] === digest) return;
  files[path] = digest;
  uploads.set(digest, {path, bytes});
}
const protectedByEdge = path => path.endsWith('.html') && cataloguePrefixes.some(prefix => path.startsWith(prefix));
const lookup = Object.keys(original).filter(path => !protectedByEdge(path) && (isPublicContactAsset(path) || /\.(?:css|svg)$/i.test(path)));
const edge = await buildEdge();
const automation = await prepareAutomation(base);
const originals = join(directory, 'source');
await mkdir(originals, {recursive:true});
for (const name of await readdir(bundleDirectory)) {
  const bytes = await readFile(join(bundleDirectory, name));
  stage('/.netlify/internal/edge-functions/' + name, bytes);
  const asset = edge.bundles.find(bundle => bundle.asset === name);
  if (asset) edgeUploads.set(sha256(bytes), {format:asset.format, bytes});
}
let count = 0;
await parallel(lookup, 8, async path => {
  const local = join(originals, original[path] + '.gz');
  let bytes;
  try { bytes = gunzipSync(await readFile(local)); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    bytes = await rawFile(base.id, path);
    assert.equal(sha(bytes), original[path], path);
    const temporary = local + randomUUID();
    await writeFile(temporary, gzipSync(bytes));
    await rename(temporary, local);
  }
  assert.equal(sha(bytes), original[path], path);
  const before = bytes.toString('utf8');
  let after = before;
  if (path === '/contact/index.html' || path === '/en/contact/index.html') {
    after = insertContactForm(before, path.startsWith('/en/') ? 'en' : 'fr');
  }
  if (path.endsWith('.xml')) assert.ok(!hasPublicMailbox(after), path);
  else after = transformPublicContact(path, after);
  assert.ok(!hasPublicMailbox(after), path);
  if (after !== before) stage(path, Buffer.from(after));
  if (++count % 200 === 0) console.log(count + '/' + lookup.length + ' fichiers publics contrôlés');
});
for (const name of await readdir(new URL('../../../public/contact-assets/', import.meta.url))) {
  const bytes = await readFile(new URL('../../../public/contact-assets/' + name, import.meta.url));
  assert.ok(!hasPublicMailbox(bytes.toString()), name);
  stage('/contact-assets/' + name, bytes);
}
for (const path of Object.keys(original)) {
  if (path.endsWith('.xml') || path === '/netlify.toml' || protectedByEdge(path)) assert.equal(files[path], original[path], path);
}
const digest = digestOf(files);
const byFormat = Object.fromEntries([...edgeUploads].map(([hash, {format}]) => [format, hash]));
const title = 'Formulaire de contact ' + digest + ' ' + automation.digest.slice(0,12);
const list = await netJSON('/sites/' + site + '/deploys?per_page=100');
let draft = list.find(d => d.title === title && d.context === 'deploy-preview' && !['error','rejected','canceled'].includes(d.state));
if (!draft) {
  assert.equal((await netJSON('/sites/' + site)).published_deploy.id, base.id);
  draft = await netJSON('/sites/' + site + '/deploys?title=' + encodeURIComponent(title), {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
    draft:true, async:true, branch:'main', files, ...automation.payload, edge_functions:byFormat,
  })});
}
const url = 'https://' + draft.id + '--flex-webb.netlify.app';
console.log('Aperçu Netlify', url);
const sent = new Set();
const endpoint = '/deploys/' + draft.id;
async function upload(hash, bytes, path) {
  const res = await request(endpoint + path, {method:'PUT',headers:{'Content-Type':'application/octet-stream'},body:bytes});
  await res.arrayBuffer();
  sent.add(hash);
}
for (let poll = 0; poll < 360; poll++) {
  const current = await netJSON('/sites/' + site + endpoint);
  assert.equal(current.context, 'deploy-preview');
  assert.ok(!['error','rejected','canceled'].includes(current.state), current.error_message);
  if (['uploaded','processing','ready'].includes(current.state)) break;
  if (['prepared','uploading'].includes(current.state)) {
    for (const hash of current.required_functions || []) {
      assert.equal(hash, automation.digest);
      if (!sent.has(hash)) await upload(hash, automation.bytes, automation.uploadPath);
    }
    await parallel((current.required_edge_functions || []).filter(h => !sent.has(h)), 3, async hash => {
      assert.ok(edgeUploads.has(hash), hash);
      await upload(hash, edgeUploads.get(hash).bytes, '/edge_functions/' + hash);
    });
    await parallel((current.required || []).filter(h => !sent.has(h)), 8, async hash => {
      assert.ok(uploads.has(hash), 'Unexpected file requested by Netlify: ' + hash);
      const {bytes,path} = uploads.get(hash);
      await upload(hash, bytes, '/files' + path.split('/').map(encodeURIComponent).join('/'));
    });
  }
  if (poll % 12 === 0) console.log(current.state, sent.size + ' fichiers transmis');
  await sleep(4000);
}
const ready = await waitDeploy(draft.id);
assert.equal(ready.context, 'deploy-preview');
assert.equal(ready.edge_functions_present, true);
assert.deepEqual(functionPayload(ready), automation.payload);
assert.equal(ready.server, base.server);
for (const item of base.summary.messages.filter(m => /(?:redirect|header) rules processed/.test(m.title))) {
  assert.ok(ready.summary.messages.some(m => m.title === item.title), item.title);
}
const receipt = {id:ready.id, url, baseId:base.id, digest, files:Object.keys(files).length,
  routes:expectedPaths.size, sourceCatalogueId:JSON.parse(await readFile(new URL('../../catalogue/release-candidate.json', import.meta.url))).id,
  productionLocked:base.locked, edgeFunctions:byFormat, automationDigest:automation.digest, staticReviewed:lookup.length, edgeHTML:Object.keys(files).filter(protectedByEdge).length, changed:uploads.size,
  sitemaps:Object.keys(original).filter(p => /^\/sitemaps\/.*\.xml$/.test(p)).length};
await mkdir(directory, {recursive:true});
await writeFile(join(directory,'candidate.json'), JSON.stringify(receipt,null,2)+'\n');
console.log(receipt);
