import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {setTimeout as sleep} from 'node:timers/promises';
import {filesOf, netJSON, parallel, rawFile, request, waitDeploy} from '../catalogue/netlify.mjs';
import {sha, site} from '../scripts/baseline.mjs';
import {assertFunctions, digestOf, functionPayload} from '../scripts/deploys.mjs';
import {directory, prepare, save} from './manifest.mjs';

const routingOnly = process.argv.includes('--legacy-global');
const {files, uploads, immutable, facts} = routingOnly
  ? await (await import('../catalogue/legacy-release.mjs')).prepareLegacyRelease()
  : await prepare();
const {digest} = facts;
const title = (routingOnly ? 'Redirections Flex-Web ' : 'Aperçu design Flex-Web ') + digest;
const checkpoint = 'pending-' + digest + '.json';
const failed = new Set(['error', 'rejected', 'canceled']);
let deploy;
try {
  const cached = JSON.parse(await readFile(join(directory, checkpoint), 'utf8'));
  assert.equal(cached.digest, digest);
  assert.match(cached.id, /^[a-f0-9]{24}$/);
  deploy = await netJSON('/sites/' + site + '/deploys/' + cached.id);
} catch (e) {
  if (e.code !== 'ENOENT') throw e;
}
if (!deploy || failed.has(deploy.state)) {
  const recent = await netJSON('/sites/' + site + '/deploys?per_page=100');
  deploy = recent.find(d => d.title === title && d.context === 'deploy-preview' && !failed.has(d.state));
  if (!deploy) {
    deploy = await netJSON('/sites/' + site + '/deploys?title=' + encodeURIComponent(title), {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({draft: true, async: true, branch: 'main', files, ...functionPayload(immutable)}),
    });
  }
  await save(checkpoint, {id: deploy.id, digest});
}
const {id} = deploy;
const url = 'https://' + id + '--flex-webb.netlify.app';
const endpoint = '/sites/' + site + '/deploys/' + id;
console.log('Aperçu', url);
const byHash = new Map(Object.entries(files).map(([path, hash]) => [hash, path]));
const sent = new Set();
let transferred = false;
let emptyResponses = 0;
for (let attempt = 0; attempt < 480; attempt++) {
  const state = await netJSON(endpoint);
  assert.equal(state.site_id, site);
  assert.equal(state.context, 'deploy-preview');
  assert.ok(!state.published_at);
  assert.ok(!failed.has(state.state), state.error_message || state.state);
  assert.deepEqual(state.required_functions || [], []);
  assert.deepEqual(state.required_edge_functions || [], []);
  if (['uploaded', 'processing', 'ready'].includes(state.state)) {
    transferred = true;
    break;
  }
  if (['prepared', 'uploading'].includes(state.state)) {
    const required = new Set(state.required || []);
    emptyResponses = required.size ? 0 : emptyResponses + 1;
    // Some asynchronous deployments briefly report no requested files during upload.
    if (emptyResponses === 3 && !sent.size) for (const hash of uploads.keys()) required.add(hash);
    const missing = [...required].filter(hash => !sent.has(hash));
    if (missing.length) console.log('Fichiers à transmettre', missing.length);
    await parallel(missing, 5, async hash => {
      let source = uploads.get(hash);
      if (!source) {
        const path = byHash.get(hash);
        assert.ok(path, hash);
        source = {path, bytes: await rawFile(immutable.id, path)};
      }
      assert.equal(sha(source.bytes), hash);
      const path = source.path.split('/').map(encodeURIComponent).join('/');
      const response = await request('/deploys/' + id + '/files' + path, {
        method: 'PUT', headers: {'Content-Type': 'application/octet-stream'}, body: source.bytes,
      });
      await response.arrayBuffer();
      sent.add(hash);
    });
  }
  if (attempt % 12 === 0) console.log('Netlify', state.state, sent.size, 'empreintes transmises');
  await sleep(4000);
}
assert.ok(transferred, 'Reprendre le brouillon avec le même reçu');
const ready = await waitDeploy(id);
assert.equal(ready.context, 'deploy-preview');
assert.equal(ready.site_id, site);
assert.equal(ready.branch, 'main');
assert.ok(!ready.published_at);
assertFunctions(immutable, ready);
const messages = ready.summary.messages;
for (const expected of [facts.redirects + ' redirect rules processed', facts.headers + ' header rules processed', facts.functions.length + ' functions deployed']) {
  assert.ok(messages.some(m => m.type === 'info' && m.title === expected), expected);
}
assert.ok(messages.every(m => m.type === 'info'), JSON.stringify(messages));
const result = {...facts, id, url};
await save('preview-ready.json', result);
console.log('Aperçu prêt, vérification exhaustive de ses fichiers', url);
const actual = await filesOf(id);
assert.equal(Object.keys(actual).length, facts.files);
assert.equal(digestOf(actual), digest);
const current = (await netJSON('/sites/' + site)).published_deploy;
assert.equal(current.id, facts.baseId);
assert.equal(current.locked, facts.productionLocked);
await save('candidate.json', result);
console.log(result);
