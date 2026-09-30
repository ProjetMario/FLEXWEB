import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { executeRelease, getNetlifyProductionState, PUBLIC_SITE_ID, sha256 } from './release-core.mjs';
import { reportSnapshot } from './snapshot.mjs';
import { nextStatus } from '../../apps/content-cms/src/lib/contracts.mjs';

const commit = 'a'.repeat(40);
async function fixture(t, overrides = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'flexweb-cms-release-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const snapshotPath = path.join(root, 'snapshot.json'), artifactDir = path.join(root, 'dist');
  await mkdir(artifactDir);
  await writeFile(snapshotPath, JSON.stringify({ schemaVersion: 1, id: 'snapshot-1', sourceCommit: commit, entries: [], pricingFingerprint: 'verified-by-parent' }));
  await writeFile(path.join(artifactDir, 'index.html'), '<html>Content</html>');
  const calls = []; let live = 'previous';
  const providers = {
    pullSnapshot: async () => calls.push('pull'),
    validateSnapshot: async () => calls.push('validate'),
    currentProduction: async () => ({ siteId: PUBLIC_SITE_ID, id: live, ready: true, gitBuildsStopped: true, nonGitProductionDeploysAllowed: true }),
    currentSourceCommit: async () => commit,
    archiveSnapshot: async () => calls.push('archive'),
    applySnapshot: async () => calls.push('apply'),
    buildAndTest: async () => calls.push('build'),
    createPreview: async () => { calls.push('preview'); return { siteId: PUBLIC_SITE_ID, id: 'candidate', url: 'https://candidate--flex-webb.netlify.app', ready: true, draft: true }; },
    verifyPreview: async () => calls.push('verify-preview'),
    promote: async id => { calls.push(`promote:${id}`); live = id; },
    verifyProduction: async () => calls.push('verify-production'),
    report: async (_snapshot, state) => calls.push(`report:${state.status}`),
    ...overrides,
  };
  return { snapshotPath, artifactDir, codeCommit: commit, statusPath: path.join(root, 'status.json'), lockPath: path.join(root, 'lock'), providers, calls };
}

test('one build, verified preview and same deployment promoted', async t => {
  const options = await fixture(t); const r = await executeRelease(options);
  assert.equal(r.status, 'deployed'); assert.equal(r.deployId, 'candidate');
  assert.equal(options.calls.filter(c => c === 'build').length, 1);
  assert.deepEqual(options.calls.filter(c => c.startsWith('promote:')), ['promote:candidate']);
  assert.ok(options.calls.indexOf('verify-preview') < options.calls.indexOf('promote:candidate'));
  assert.equal(JSON.parse(await readFile(path.join(options.artifactDir, '.well-known/flexweb-release.json'))).snapshotSha256, r.snapshotSha256);
});

test('same revision and code already deployed do not build again', async t => {
  const options = await fixture(t);
  options.providers.currentProduction = async () => ({ siteId: PUBLIC_SITE_ID, id: 'previous', ready: true, gitBuildsStopped: true, nonGitProductionDeploysAllowed: true, codeCommit: commit, snapshotSha256: sha256(await readFile(options.snapshotPath)) });
  const r = await executeRelease(options);
  assert.equal(r.status, 'deployed'); assert.equal(r.unchanged, true); assert.ok(!options.calls.includes('build'));
  assert.equal(r.productionVerified, true); assert.ok(options.calls.includes('verify-production'));
});

test('an unchanged release cannot be acknowledged when the live production marker fails verification', async t => {
  const options = await fixture(t, { verifyProduction: async () => { throw new Error('live marker mismatch'); } });
  options.providers.currentProduction = async () => ({ siteId: PUBLIC_SITE_ID, id: 'previous', ready: true, gitBuildsStopped: true, nonGitProductionDeploysAllowed: true, codeCommit: commit, snapshotSha256: sha256(await readFile(options.snapshotPath)) });
  const result = await executeRelease(options);
  assert.equal(result.status, 'blocked'); assert.equal(result.productionVerified, undefined);
  assert.ok(!options.calls.includes('report:deployed')); assert.ok(!options.calls.includes('build'));
  assert.ok(!options.calls.some(call => call.startsWith('promote:')));
});

test('an unchanged release cannot acknowledge a deployment replaced during its live verification', async t => {
  const options = await fixture(t); let reads = 0;
  options.providers.currentProduction = async () => ({ siteId: PUBLIC_SITE_ID, id: ++reads === 1 ? 'previous' : 'newer', ready: true, gitBuildsStopped: true, nonGitProductionDeploysAllowed: true, codeCommit: commit, snapshotSha256: sha256(await readFile(options.snapshotPath)) });
  const result = await executeRelease(options);
  assert.equal(result.status, 'blocked'); assert.equal(result.errorCode, 'PRODUCTION_CHANGED');
  assert.equal(result.productionVerified, undefined); assert.ok(options.calls.includes('verify-production'));
  assert.ok(!options.calls.includes('report:deployed')); assert.ok(!options.calls.includes('build'));
  assert.ok(!options.calls.some(call => call.startsWith('promote:')));
});

for (const savedBeforeResponseLoss of [false, true]) test(`an unchanged release recovers a lost CMS status response (saved=${savedBeforeResponseLoss}) without another build or promotion`, async t => {
  const candidateId = 'candidate-deploy-123', previousId = 'previous-deploy-123';
  let live = previousId, lost = false, cmsState = { state: 'draft' }, verifiedProduction = 0;
  const transitions = [];
  const client = { request: async (method, _route, input) => {
    if (method === 'GET') return structuredClone(cmsState);
    assert.equal(method, 'POST');
    transitions.push([cmsState.state, input.state]);
    if (input.state === 'deployed' && !lost) {
      lost = true;
      if (savedBeforeResponseLoss) cmsState = nextStatus(cmsState, input);
      throw new Error('response lost; the caller cannot know whether the state was saved');
    }
    cmsState = nextStatus(cmsState, input);
    return structuredClone(cmsState);
  } };
  const options = await fixture(t);
  const expectedSha = sha256(await readFile(options.snapshotPath));
  options.providers.currentProduction = async () => ({ siteId: PUBLIC_SITE_ID, id: live, ready: true, gitBuildsStopped: true, nonGitProductionDeploysAllowed: true,
    ...(live === candidateId ? { codeCommit: commit, snapshotSha256: expectedSha } : {}) });
  options.providers.createPreview = async () => { options.calls.push('preview'); return { siteId: PUBLIC_SITE_ID, id: candidateId, url: `https://${candidateId}--flex-webb.netlify.app`, ready: true, draft: true }; };
  options.providers.promote = async id => { options.calls.push(`promote:${id}`); live = id; };
  options.providers.verifyProduction = async (candidate, expected) => {
    verifiedProduction++; options.calls.push('verify-production');
    assert.equal(live, candidateId); assert.equal(candidate.id, candidateId);
    assert.deepEqual(JSON.parse(await readFile(path.join(options.artifactDir, '.well-known/flexweb-release.json'))), expected);
  };
  options.providers.report = (snapshot, report) => reportSnapshot({ client, snapshot, status: report.status, report, deployId: report.deployId });
  const first = await executeRelease(options);
  assert.equal(first.status, 'deployed'); assert.equal(first.statusSyncPending, true);
  assert.equal(cmsState.state, savedBeforeResponseLoss ? 'deployed' : 'preview_ready');
  assert.equal(verifiedProduction, 1);
  const second = await executeRelease(options);
  assert.equal(second.status, 'deployed'); assert.equal(second.unchanged, true);
  assert.equal(second.productionVerified, true); assert.equal(second.statusSyncPending, undefined);
  assert.equal(cmsState.state, 'deployed'); assert.equal(cmsState.deployId, candidateId);
  assert.equal(verifiedProduction, 2);
  assert.equal(options.calls.filter(call => call === 'build').length, 1);
  assert.equal(options.calls.filter(call => call === 'preview').length, 1);
  assert.deepEqual(options.calls.filter(call => call.startsWith('promote:')), [`promote:${candidateId}`]);
  if (!savedBeforeResponseLoss) assert.deepEqual(transitions.slice(-3), [['preview_ready', 'checking'], ['checking', 'preview_ready'], ['preview_ready', 'deployed']]);
});

test('concurrent invocation cannot run two builds', async t => {
  const options = await fixture(t); let releaseBuild, signalBuild;
  const reached = new Promise(resolve => { signalBuild = resolve; });
  options.providers.buildAndTest = async () => { signalBuild(); await new Promise(resolve => { releaseBuild = resolve; }); };
  const first = executeRelease(options); await reached;
  await assert.rejects(executeRelease(options), /RELEASE_ALREADY_RUNNING/);
  releaseBuild(); assert.equal((await first).status, 'deployed');
});

test('failed checks preserve the published deployment and redact provider errors', async t => {
  const options = await fixture(t, { buildAndTest: async () => { throw new Error('Authorization: Bearer secret-private-value'); } });
  const r = await executeRelease(options);
  assert.equal(r.status, 'blocked'); assert.equal(r.errorCode, 'RELEASE_FAILED');
  assert.ok(!options.calls.some(c => c.startsWith('promote:')));
  assert.doesNotMatch(await readFile(options.statusPath, 'utf8'), /secret-private-value/);
});

test('snapshot modification during build blocks promotion', async t => {
  const options = await fixture(t);
  options.providers.buildAndTest = () => writeFile(options.snapshotPath, '{}');
  const r = await executeRelease(options); assert.equal(r.errorCode, 'SNAPSHOT_CHANGED');
  assert.ok(!options.calls.includes('preview'));
});

test('artifact modification after preview blocks promotion', async t => {
  const options = await fixture(t);
  options.providers.verifyPreview = () => writeFile(path.join(options.artifactDir, 'index.html'), 'changed');
  const r = await executeRelease(options); assert.equal(r.errorCode, 'ARTIFACT_CHANGED');
  assert.ok(!options.calls.some(c => c.startsWith('promote:')));
});

test('newer production cannot be overwritten by an older pending release', async t => {
  let reads = 0;
  const options = await fixture(t, { currentProduction: async () => ({ siteId: PUBLIC_SITE_ID, id: ++reads === 1 ? 'previous' : 'newer', ready: true, gitBuildsStopped: true, nonGitProductionDeploysAllowed: true }) });
  const r = await executeRelease(options); assert.equal(r.errorCode, 'PRODUCTION_CHANGED');
  assert.ok(!options.calls.some(c => c.startsWith('promote:')));
});

test('native Git deployment must be disabled explicitly before automatic activation', async t => {
  const options = await fixture(t, { currentProduction: async () => ({ siteId: PUBLIC_SITE_ID, id: 'previous', ready: true, gitBuildsStopped: false }) });
  const r = await executeRelease(options); assert.equal(r.errorCode, 'GIT_AUTOPUBLISH_STILL_ENABLED');
  assert.ok(!options.calls.includes('build'));
});

test('the Netlify production policy is read from the top-level boolean, not build_settings', () => {
  const site = {
    id: PUBLIC_SITE_ID, published_deploy: { id: 'historical', state: 'ready' },
    build_settings: { stop_builds: true, prevent_non_git_prod_deploys: false },
    prevent_non_git_prod_deploys: true,
  };
  const marker = { snapshotSha256: 'historic-content-hash', codeCommit: commit };
  const blocked = getNetlifyProductionState(site, marker);
  assert.equal(blocked.nonGitProductionDeploysAllowed, false);
  assert.equal(blocked.gitBuildsStopped, true);
  assert.equal(blocked.id, 'historical');
  assert.equal(blocked.snapshotSha256, marker.snapshotSha256);
  assert.equal(blocked.codeCommit, commit);
  assert.equal(getNetlifyProductionState({ ...site, prevent_non_git_prod_deploys: false }).nonGitProductionDeploysAllowed, true);
  for (const value of [undefined, null, 'false', 0]) {
    assert.equal(getNetlifyProductionState({ ...site, prevent_non_git_prod_deploys: value }).nonGitProductionDeploysAllowed, false);
  }
});

for (const value of [true, undefined]) test(`a forbidden or unavailable Netlify policy blocks before CMS export and other external actions (${value})`, async t => {
  const options = await fixture(t);
  let productionReads = 0;
  options.providers.currentProduction = async () => {
    productionReads++;
    return getNetlifyProductionState({ id: PUBLIC_SITE_ID, published_deploy: { id: 'previous', state: 'ready' }, build_settings: { stop_builds: true }, prevent_non_git_prod_deploys: value });
  };
  const result = await executeRelease(options);
  assert.equal(result.status, 'blocked');
  assert.equal(result.errorCode, 'NON_GIT_PRODUCTION_DEPLOYS_FORBIDDEN');
  assert.equal(productionReads, 1);
  assert.deepEqual(options.calls, []);
  assert.equal(JSON.parse(await readFile(options.statusPath)).errorCode, result.errorCode);
});

test('an explicitly allowed Netlify policy continues through export, checks and promotion', async t => {
  const options = await fixture(t);
  const current = options.providers.currentProduction;
  options.providers.currentProduction = async () => {
    options.calls.push('read-policy');
    const state = await current();
    return getNetlifyProductionState({ id: PUBLIC_SITE_ID, published_deploy: { id: state.id, state: 'ready' }, build_settings: { stop_builds: true }, prevent_non_git_prod_deploys: false });
  };
  const result = await executeRelease(options);
  assert.equal(result.status, 'deployed');
  assert.equal(options.calls[0], 'read-policy');
  assert.ok(options.calls.indexOf('read-policy') < options.calls.indexOf('pull'));
  assert.ok(options.calls.indexOf('pull') < options.calls.indexOf('build'));
  assert.deepEqual(options.calls.filter(call => call.startsWith('promote:')), ['promote:candidate']);
});

for (const stage of ['applySnapshot', 'buildAndTest', 'verifyPreview']) test(`re-enabling Git-only production during ${stage} prevents the next costly action`, async t => {
  const options = await fixture(t); let allowed = true;
  const current = options.providers.currentProduction;
  options.providers.currentProduction = async () => ({ ...await current(), nonGitProductionDeploysAllowed: allowed });
  const original = options.providers[stage];
  options.providers[stage] = async (...args) => { await original(...args); allowed = false; };
  const result = await executeRelease(options);
  assert.equal(result.status, 'blocked');
  assert.equal(result.errorCode, 'NON_GIT_PRODUCTION_DEPLOYS_FORBIDDEN');
  if (stage === 'applySnapshot') assert.ok(!options.calls.includes('build'));
  if (stage === 'buildAndTest') assert.ok(!options.calls.includes('preview'));
  assert.ok(!options.calls.some(call => call.startsWith('promote:')));
});

test('a resumed unchanged release also stops before export when the policy was re-enabled', async t => {
  const options = await fixture(t);
  const snapshotSha256 = sha256(await readFile(options.snapshotPath));
  options.providers.currentProduction = async () => ({ siteId: PUBLIC_SITE_ID, id: 'previous', ready: true, gitBuildsStopped: true, nonGitProductionDeploysAllowed: false, snapshotSha256, codeCommit: commit });
  const result = await executeRelease(options);
  assert.equal(result.errorCode, 'NON_GIT_PRODUCTION_DEPLOYS_FORBIDDEN');
  assert.equal(result.unchanged, undefined);
  assert.deepEqual(options.calls, []);
});

test('a resumed unchanged release cannot acknowledge success if policy changes during verification', async t => {
  const options = await fixture(t); let allowed = true;
  const snapshotSha256 = sha256(await readFile(options.snapshotPath));
  options.providers.currentProduction = async () => ({ siteId: PUBLIC_SITE_ID, id: 'previous', ready: true, gitBuildsStopped: true, nonGitProductionDeploysAllowed: allowed, snapshotSha256, codeCommit: commit });
  options.providers.verifyProduction = async () => { options.calls.push('verify-production'); allowed = false; };
  const result = await executeRelease(options);
  assert.equal(result.errorCode, 'NON_GIT_PRODUCTION_DEPLOYS_FORBIDDEN');
  assert.ok(options.calls.includes('verify-production'));
  assert.ok(!options.calls.includes('report:deployed'));
  assert.ok(!options.calls.some(call => call.startsWith('promote:')));
});

test('a rollback does not bypass a re-enabled production policy', async t => {
  const options = await fixture(t); let allowed = true;
  const current = options.providers.currentProduction;
  options.providers.currentProduction = async () => ({ ...await current(), nonGitProductionDeploysAllowed: allowed });
  options.providers.verifyProduction = async () => { allowed = false; throw new Error('verification failed'); };
  const result = await executeRelease(options);
  assert.equal(result.status, 'blocked');
  assert.equal(result.rollback, 'skipped-deployment-policy');
  assert.deepEqual(options.calls.filter(call => call.startsWith('promote:')), ['promote:candidate']);
});

test('post-publication verification failure restores previous immutable deploy', async t => {
  const options = await fixture(t, { verifyProduction: async () => { throw new Error('bad content'); } });
  const r = await executeRelease(options); assert.equal(r.status, 'blocked'); assert.equal(r.rollback, 'confirmed');
  assert.deepEqual(options.calls.filter(c => c.startsWith('promote:')), ['promote:candidate', 'promote:previous']);
});

test('lost successful promotion response is reconciled without duplicate promotion', async t => {
  const options = await fixture(t); const original = options.providers.promote;
  options.providers.promote = async id => { await original(id); throw new Error('network timeout'); };
  const r = await executeRelease(options); assert.equal(r.status, 'deployed');
  assert.deepEqual(options.calls.filter(c => c.startsWith('promote:')), ['promote:candidate']);
});

test('CMS status outage before build blocks instead of publishing silently', async t => {
  const options = await fixture(t, { report: async () => { throw new Error('offline'); } });
  const r = await executeRelease(options); assert.equal(r.status, 'blocked'); assert.equal(r.errorCode, 'CMS_STATUS_UNAVAILABLE');
  assert.ok(!options.calls.includes('build')); assert.equal(r.statusSyncPending, true);
});

test('source commit mismatch cannot publish a snapshot against unrelated code', async t => {
  const options = await fixture(t); options.codeCommit = 'b'.repeat(40);
  const r = await executeRelease(options); assert.equal(r.errorCode, 'SNAPSHOT_SOURCE_MISMATCH');
  assert.ok(!options.calls.includes('build'));
});

test('new source commit during preview prevents stale-code promotion', async t => {
  const options = await fixture(t); let reads = 0;
  options.providers.currentSourceCommit = async () => ++reads === 1 ? commit : 'b'.repeat(40);
  const r = await executeRelease(options); assert.equal(r.errorCode, 'SOURCE_ADVANCED');
  assert.ok(!options.calls.some(c => c.startsWith('promote:')));
});

test('uncertain promotion does not replay a request or claim publication', async t => {
  const options = await fixture(t);
  options.providers.promote = async () => { options.calls.push('uncertain-mutation'); throw new Error('timeout'); };
  const r = await executeRelease(options);
  assert.equal(r.status, 'blocked'); assert.equal(r.errorCode, 'PROMOTION_UNCONFIRMED');
  assert.equal(options.calls.filter(c => c === 'uncertain-mutation').length, 1);
});

test('status callback failure after verified promotion does not rollback a good site', async t => {
  const options = await fixture(t);
  options.providers.report = async (_snapshot, state) => { if (state.status === 'deployed') throw new Error('CMS offline'); };
  const r = await executeRelease(options);
  assert.equal(r.status, 'deployed'); assert.equal(r.statusSyncPending, true);
  assert.deepEqual(options.calls.filter(c => c.startsWith('promote:')), ['promote:candidate']);
});

test('wrong preview site cannot become public', async t => {
  const options = await fixture(t, { createPreview: async () => ({ siteId: 'crm-site', id: 'wrong', draft: true, ready: true }) });
  const r = await executeRelease(options); assert.equal(r.errorCode, 'INVALID_PREVIEW_DEPLOYMENT');
  assert.ok(!options.calls.some(c => c.startsWith('promote:')));
});
