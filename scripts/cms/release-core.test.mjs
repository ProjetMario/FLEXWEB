import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { executeRelease, PUBLIC_SITE_ID, sha256 } from './release-core.mjs';
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
    validateSnapshot: async () => calls.push('validate'),
    currentProduction: async () => ({ siteId: PUBLIC_SITE_ID, id: live, ready: true, gitBuildsStopped: true }),
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
  options.providers.currentProduction = async () => ({ siteId: PUBLIC_SITE_ID, id: 'previous', ready: true, gitBuildsStopped: true, codeCommit: commit, snapshotSha256: sha256(await readFile(options.snapshotPath)) });
  const r = await executeRelease(options);
  assert.equal(r.status, 'deployed'); assert.equal(r.unchanged, true); assert.ok(!options.calls.includes('build'));
  assert.equal(r.productionVerified, true); assert.ok(options.calls.includes('verify-production'));
});

test('an unchanged release cannot be acknowledged when the live production marker fails verification', async t => {
  const options = await fixture(t, { verifyProduction: async () => { throw new Error('live marker mismatch'); } });
  options.providers.currentProduction = async () => ({ siteId: PUBLIC_SITE_ID, id: 'previous', ready: true, gitBuildsStopped: true, codeCommit: commit, snapshotSha256: sha256(await readFile(options.snapshotPath)) });
  const result = await executeRelease(options);
  assert.equal(result.status, 'blocked'); assert.equal(result.productionVerified, undefined);
  assert.ok(!options.calls.includes('report:deployed')); assert.ok(!options.calls.includes('build'));
  assert.ok(!options.calls.some(call => call.startsWith('promote:')));
});

test('an unchanged release cannot acknowledge a deployment replaced during its live verification', async t => {
  const options = await fixture(t); let reads = 0;
  options.providers.currentProduction = async () => ({ siteId: PUBLIC_SITE_ID, id: ++reads === 1 ? 'previous' : 'newer', ready: true, gitBuildsStopped: true, codeCommit: commit, snapshotSha256: sha256(await readFile(options.snapshotPath)) });
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
  options.providers.currentProduction = async () => ({ siteId: PUBLIC_SITE_ID, id: live, ready: true, gitBuildsStopped: true,
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
  const options = await fixture(t, { currentProduction: async () => ({ siteId: PUBLIC_SITE_ID, id: ++reads === 1 ? 'previous' : 'newer', ready: true, gitBuildsStopped: true }) });
  const r = await executeRelease(options); assert.equal(r.errorCode, 'PRODUCTION_CHANGED');
  assert.ok(!options.calls.some(c => c.startsWith('promote:')));
});

test('native Git deployment must be disabled explicitly before automatic activation', async t => {
  const options = await fixture(t, { currentProduction: async () => ({ siteId: PUBLIC_SITE_ID, id: 'previous', ready: true, gitBuildsStopped: false }) });
  const r = await executeRelease(options); assert.equal(r.errorCode, 'GIT_AUTOPUBLISH_STILL_ENABLED');
  assert.ok(!options.calls.includes('build'));
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
