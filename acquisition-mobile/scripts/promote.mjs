import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { api, baseId, baseline, cache, put, root, sha, site } from './baseline.mjs';
import { assertFunctions, digestOf, functionPayload, manifestOf, waitReady } from './deploys.mjs';

const run = promisify(execFile);
const [mode, approvedId] = process.argv.slice(2);
assert.ok(['--check', '--publish'].includes(mode), 'Indiquer --check ou --publish et l’identifiant approuvé');
const receipt = JSON.parse(await readFile(join(root, 'release-candidate.json'), 'utf8'));
assert.equal(approvedId, receipt.id, 'Identifiant différent de l’aperçu contrôlé sur cette révision Git');
assert.equal(baseId, receipt.baseId);
const current = async () => (await api('/sites/' + site)).published_deploy;
const fetchDeploy = id => api('/deploys/' + id);
const post = path => api(path, { method: 'POST' }, true);
const rawFile = (id, path) => api('/deploys/' + id + '/files' + path.split('/').map(encodeURIComponent).join('/'),
  { headers: { 'Content-Type': 'application/vnd.bitballoon.v1.raw' } }, true);
const [base, preview, live] = await Promise.all([fetchDeploy(baseId), fetchDeploy(approvedId), current()]);
for (const deploy of [base, preview, live]) assert.equal(deploy.site_id, site);
assert.equal(preview.context, 'deploy-preview');
assert.equal(preview.state, 'ready');
assert.equal(preview.summary.status, 'ready');
assert.equal(preview.branch, 'main');
const files = await manifestOf(approvedId, receipt.files);
assert.equal(digestOf(files), receipt.digest, 'Inventaire différent de l’aperçu validé');
assertFunctions(base, preview);
const title = 'Applications mobiles — aperçu validé ' + approvedId;
assert.ok(live.id === baseId || live.title === title, 'Une autre version a été publiée. Réintégrer ses modifications avant de publier.');
const baseSitemap = await rawFile(baseId, '/sitemap.xml');
await put(baseline, 'sitemap.xml', baseSitemap);

async function verifyCopy(candidate) {
  assert.equal(candidate.site_id, site);
  assert.equal(candidate.context, 'production');
  assert.equal(candidate.branch, 'main');
  assert.equal(candidate.state, 'ready');
  assertFunctions(preview, candidate);
  assert.deepEqual(await manifestOf(candidate.id, receipt.files), files);
  const rules = deployment => deployment.summary.messages.filter(m => /redirect rules|header rule|functions deployed/.test(m.title)).map(m => [m.title, m.type]).sort();
  assert.deepEqual(rules(candidate), rules(preview));
}
if (live.id !== baseId) await verifyCopy(live);
if (mode === '--check') {
  console.log('Promotion vérifiable :', approvedId, receipt.files, 'fichiers et fonctions validés. Production :', live.id);
  process.exit(0);
}
assert.equal(process.env.GITHUB_ACTIONS, 'true');
assert.equal(process.env.GITHUB_EVENT_NAME, 'workflow_dispatch');
assert.equal(process.env.GITHUB_REF, 'refs/heads/main');
assert.equal(process.env.GITHUB_REPOSITORY.toLowerCase(), 'projetmario/flexweb');
const head = (await run('gh', ['api', 'repos/' + process.env.GITHUB_REPOSITORY + '/commits/main', '--jq', '.sha'])).stdout.trim();
assert.equal(head, process.env.GITHUB_SHA, 'main a changé depuis la demande de publication');

async function waitPublished(id) {
  for (let attempt = 0; attempt < 15; attempt++) {
    const status = await current();
    if (status.id === id) return status;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error('Publication Netlify non confirmée pour ' + id);
}

async function restoreLock(id) {
  const status = await current();
  assert.equal(status.id, id, 'Une autre version est en production');
  if (!!status.locked !== receipt.productionLocked) {
    await post('/deploys/' + id + (receipt.productionLocked ? '/lock' : '/unlock'));
    assert.equal(!!(await current()).locked, receipt.productionLocked);
  }
}

async function publicChecks() {
  const url = 'https://flex-web.fr';
  const options = { timeout: 180_000 };
  for (const script of ['verify.mjs', 'verify-quote.mjs', 'verify-home.mjs']) {
    const result = await run(process.execPath, [join(root, 'scripts', script), url], options);
    console.log(result.stdout.trim());
  }
}

let candidate;
let lockMayHaveChanged = false;
try {
  if (live.id === baseId) {
    const before = await current();
    assert.equal(before.id, baseId, 'Une publication concurrente a modifié le site');
    assert.equal(!!before.locked, receipt.productionLocked, 'L’état du verrou a changé');
    if (before.locked) {
      lockMayHaveChanged = true;
      await post('/deploys/' + baseId + '/unlock');
    }
    const unlocked = await current();
    assert.equal(unlocked.id, baseId, 'Une autre version est passée en production au déverrouillage');
    assert.ok(!unlocked.locked, 'Déverrouillage Netlify non confirmé');
    candidate = await api('/sites/' + site + '/deploys?title=' + encodeURIComponent(title), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ draft: false, branch: 'main', files, ...functionPayload(preview) }),
    });
    assert.equal(candidate.site_id, site);
    assert.deepEqual(candidate.required_functions || [], []);
    assert.deepEqual(candidate.required_edge_functions || [], []);
    for (const digest of new Set(candidate.required || [])) {
      const path = Object.keys(files).find(key => files[key] === digest);
      assert.ok(path);
      const bytes = await rawFile(approvedId, path);
      assert.equal(sha(bytes), digest);
      await api('/deploys/' + candidate.id + '/files' + path.split('/').map(encodeURIComponent).join('/'),
        { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body: bytes }, true);
    }
    candidate = await waitReady(candidate.id);
    await waitPublished(candidate.id);
    await verifyCopy(candidate);
  } else {
    candidate = live;
  }
  await restoreLock(candidate.id);
  await publicChecks();
  assert.equal((await current()).id, candidate.id);
  const result = { approvedId, productionId: candidate.id, previousId: baseId, digest: receipt.digest, files: receipt.files };
  await put(cache, 'production.json', JSON.stringify(result, null, 2) + '\n');
  console.log(result);
} finally {
  // Restore the prior auto-publishing policy even if the deploy or its public check failed.
  if (lockMayHaveChanged || candidate) await restoreLock((await current()).id);
}
