import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {parse as parseToml} from 'smol-toml';
import {rawFile} from '../../catalogue/netlify.mjs';
import {sha} from '../../scripts/baseline.mjs';
import {assertFunctions, digestOf, functionPayload} from '../../scripts/deploys.mjs';
import {hasPublicMailbox, isPublicContactAsset, transformPublicContact} from '../../../scripts/contact/public-contact.mjs';
import {cataloguePrefixes} from './bundle.mjs';

const edgeDirectory = '/.netlify/internal/edge-functions/';
const edgeHTML = path => path.endsWith('.html') && cataloguePrefixes.some(prefix => path.startsWith(prefix));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

// The three high-volume families retain their certified HTML in the file store.
// The edge bundle changes the publicly served bytes on these paths only.
export async function assertServedHTML(id, files, path, route, body) {
  if (!edgeHTML(path)) {
    assert.equal(sha(body), files[path], route + ' corps différent du fichier Netlify');
    return;
  }
  const archived = await rawFile(id, path);
  assert.equal(sha(archived), files[path], path);
  const expected = transformPublicContact(path, archived.toString('utf8'));
  assert.ok(!hasPublicMailbox(expected), path);
  assert.equal(sha(body), sha(Buffer.from(expected)), route + ' transformation edge différente');
}

export function assertContactInventory(source, files, receipt, legacy) {
  assert.equal(digestOf(source), legacy.digest, 'Version de base différente du catalogue et du routage certifiés');
  assert.equal(Object.keys(source).length, legacy.files);
  assert.match(receipt.automationDigest, /^[a-f0-9]{64}$/);
  assert.deepEqual(Object.keys(receipt.edgeFunctions), ['eszip2']);
  assert.match(receipt.edgeFunctions.eszip2, /^[a-f0-9]{64}$/);
  for (const [path, digest] of Object.entries(source)) {
    assert.ok(Object.hasOwn(files, path), path + ' absent');
    if (files[path] === digest) continue;
    assert.ok(isPublicContactAsset(path) && !edgeHTML(path) && !path.endsWith('.xml') && path !== '/robots.txt',
      'Modification inattendue : ' + path);
  }
  const additions = Object.keys(files).filter(path => !Object.hasOwn(source, path)).sort();
  assert.deepEqual(additions, [
    edgeDirectory + receipt.edgeFunctions.eszip2 + '.eszip', edgeDirectory + 'manifest.json',
    '/contact-assets/contact-form.css', '/contact-assets/contact-form.mjs',
  ].sort());
}

function assertContactFunctions(base, preview, receipt) {
  assert.equal(!!base.edge_functions_present, false);
  assert.equal(preview.edge_functions_present, true);
  const proxy = preview.available_functions.find(fn => fn.n === 'automation');
  const previous = base.available_functions.find(fn => fn.n === 'automation');
  assert.equal(proxy.d, receipt.automationDigest);
  assert.equal(proxy.bd.runtimeAPIVersion, previous.bd.runtimeAPIVersion);
  const expected = {...base, edge_functions_present:true, available_functions:base.available_functions.map(fn =>
    fn.n === 'automation' ? {...fn, d:receipt.automationDigest, bd:proxy.bd} : fn)};
  assertFunctions(expected, preview);
  assert.deepEqual(functionPayload(preview), functionPayload(expected));
}

export async function inspectContactRelease({base, preview, receipt, legacy, source, files}) {
  assertContactInventory(source, files, receipt, legacy);
  assertContactFunctions(base, preview, receipt);
  assert.equal(base.title, 'Atelier Flex-Web — ' + legacy.id);
  const rules = parseToml((await rawFile(preview.id, '/netlify.toml')).toString());
  assert.equal(rules.redirects?.length, legacy.redirects);
  assert.equal(rules.headers?.length, legacy.headers);
  for (const message of base.summary.messages.filter(m => /(?:redirect|header) rules processed/i.test(m.title))) {
    assert.ok(preview.summary.messages.some(m => m.title === message.title && m.type === message.type), message.title);
  }
  const manifestPath = edgeDirectory + 'manifest.json';
  const manifestBytes = await rawFile(preview.id, manifestPath);
  assert.equal(sha(manifestBytes), files[manifestPath]);
  const manifest = JSON.parse(manifestBytes);
  const digest = receipt.edgeFunctions.eszip2;
  assert.deepEqual(manifest.bundles, [{asset:digest + '.eszip', format:'eszip2'}]);
  assert.deepEqual(manifest.routes, cataloguePrefixes.map(prefix => ({
    function:'public-contact', pattern:'^' + prefix.slice(0, -1) + '(?:/(.*))/?$',
    excluded_patterns:[], path:prefix + '*',
  })));
  assert.deepEqual(manifest.post_cache_routes, []);
  const path = edgeDirectory + manifest.bundles[0].asset;
  const edgeBytes = await rawFile(preview.id, path);
  assert.equal(sha(edgeBytes), files[path]);
  assert.equal(sha256(edgeBytes), digest);
  return edgeBytes;
}

export async function sendRequiredBundles({candidate, base, receipt, edgeBytes, sent, upload}) {
  for (const digest of new Set(candidate.required_functions || [])) {
    assert.equal(digest, receipt.automationDigest, 'Une fonction existante externe à cette publication manque chez Netlify');
    if (sent.has(digest)) continue;
    const {prepareAutomation} = await import('./automation.mjs');
    const rebuilt = await prepareAutomation(base);
    assert.equal(sha256(rebuilt.bytes), digest, 'Impossible de reproduire exactement le proxy approuvé');
    await upload(rebuilt.uploadPath, rebuilt.bytes);
    sent.add(digest);
  }
  for (const digest of new Set(candidate.required_edge_functions || [])) {
    assert.equal(digest, receipt.edgeFunctions.eszip2, 'Paquet edge non approuvé');
    if (!sent.has(digest)) {
      await upload('/edge_functions/' + digest, edgeBytes);
      sent.add(digest);
    }
  }
}
