import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { gzipSync } from 'node:zlib';
import { canonicalJSON, digest, createCMSClient, pullSnapshot, validateSnapshot, readManifest, main, reportSnapshot } from './snapshot.mjs';
import { nextStatus } from '../../apps/content-cms/src/lib/contracts.mjs';

const commit = 'a'.repeat(40);
const original = {
  collection: 'pages_commerciales', sourceId: '/creation-site-internet-savoie/', path: '/creation-site-internet-savoie/',
  title: 'Créer un site en Savoie', seoTitle: 'Site internet en Savoie', seoDescription: 'Un contenu utile.',
  content: [{ _type: 'block', _key: 'b1', style: 'normal', children: [{ _type: 'span', _key: 's1', text: 'Une nouvelle phrase.', marks: [] }], markDefs: [] }],
  data: { renderHash: 'b'.repeat(64), additionalSections: [] }, revision: 2, updatedAt: '2026-09-30T10:00:00.000Z', baselineHash: 'c'.repeat(64),
};
function baseline(entries = [original]) {
  const payload = { schemaVersion: 1, pricingFingerprint: 'd'.repeat(64), entries: entries.map(e => ({ collection: e.collection, sourceId: e.sourceId, path: e.path, renderHash: e.data.renderHash, baselineHash: e.baselineHash })) };
  return { ...payload, hash: digest(payload) };
}
function entry(manifest = baseline()) { return { ...structuredClone(original), baseManifestHash: manifest.hash }; }
function snapshot(manifest = baseline(), entries = [entry(manifest)]) {
  const payload = { schemaVersion: 1, sourceCommit: commit, entries, pricingFingerprint: manifest.pricingFingerprint, baseManifestHash: manifest.hash };
  return { ...payload, id: digest(payload), createdAt: '2026-09-30T10:01:00.000Z' };
}
function rehash(snapshot) { const { id, createdAt, ...payload } = snapshot; return { ...snapshot, id: digest(payload) }; }
function httpMock({ entries = [entry()], initial = new Map(), failPostAfterSave = false } = {}) {
  const archives = initial, calls = []; let state = { state: 'draft' };
  const fetchImpl = async (url, options) => {
    const u = new URL(url); calls.push({ url, ...options });
    if (u.pathname === '/api/flexweb/entries') return Response.json({ entries: entries.filter(e => e.collection === u.searchParams.get('collection')), scanned: entries.length });
    if (u.pathname.endsWith('/status')) {
      if (options.method === 'GET') return Response.json(state);
      const body = JSON.parse(options.body);
      if (body.expectedState !== state.state) return Response.json({ error: 'conflict' }, { status: 409 });
      try { state = nextStatus(state, body); } catch { return Response.json({ error: 'state conflict' }, { status: 409 }); }
      return Response.json(state);
    }
    if (u.pathname === '/api/flexweb/snapshots' && options.method === 'POST') {
      const body = JSON.parse(options.body); archives.set(body.id, body);
      if (failPostAfterSave) throw new Error('timeout with private token');
      return Response.json({ id: body.id }, { status: 201 });
    }
    if (u.pathname.startsWith('/api/flexweb/snapshots/')) {
      const saved = archives.get(u.pathname.split('/').at(-1));
      return saved ? Response.json(saved) : Response.json({ error: 'absent' }, { status: 404 });
    }
    return Response.json({ error: 'unexpected request' }, { status: 500 });
  };
  const client = createCMSClient({ origin: 'https://cms.example.test', readToken: 'test-read-token-000000', writeToken: 'test-write-token-000000', fetchImpl });
  return { client, calls, archives };
}

test('canonical hashes are independent of object key insertion order', () => {
  assert.equal(canonicalJSON({ b: 2, a: { y: 3, x: 4 } }), canonicalJSON({ a: { x: 4, y: 3 }, b: 2 }));
});

test('pull archives first and reuses exact revision bytes and date on unchanged rerun', async () => {
  const mock = httpMock(), manifest = baseline();
  const first = await pullSnapshot({ client: mock.client, manifest, sourceCommit: commit, now: () => '2026-09-30T10:01:00.000Z' });
  const second = await pullSnapshot({ client: mock.client, manifest, sourceCommit: commit, now: () => '2026-09-30T12:30:00.000Z' });
  assert.equal(canonicalJSON(first), canonicalJSON(second));
  assert.equal(mock.calls.filter(c => c.method === 'POST').length, 1);
  assert.ok(mock.calls.every(c => c.redirect === 'error'));
  assert.ok(mock.calls.filter(c => c.method === 'GET').every(c => c.headers.authorization === 'Bearer test-read-token-000000'));
  assert.ok(mock.calls.filter(c => c.method === 'POST').every(c => c.headers.authorization === 'Bearer test-write-token-000000'));
  assert.ok(mock.calls.filter(c => c.url.includes('/entries?')).every(c => new URL(c.url).searchParams.get('mode') === 'published'));
});

test('lost archive response is reconciled with one immutable write', async () => {
  const mock = httpMock({ failPostAfterSave: true });
  const saved = await pullSnapshot({ client: mock.client, manifest: baseline(), sourceCommit: commit });
  assert.equal(mock.calls.filter(c => c.method === 'POST').length, 1);
  assert.equal(mock.archives.get(saved.id).id, saved.id);
});

test('unavailable CMS never produces a partial release', async () => {
  const client = createCMSClient({ origin: 'https://cms.example.test', readToken: 'test-read-token-000000', writeToken: 'test-write-token-000000', fetchImpl: async () => { throw new Error('Authorization: private-secret'); } });
  await assert.rejects(pullSnapshot({ client, manifest: baseline(), sourceCommit: commit }), /^Error: CMS_CONNECTION_FAILED$/);
});

test('cannot substitute a different archived payload', async () => {
  const desired = snapshot();
  const other = rehash({ ...desired, entries: [{ ...entry(), seoTitle: 'Different content' }] });
  const mock = httpMock({ initial: new Map([[desired.id, other]]) });
  await assert.rejects(pullSnapshot({ client: mock.client, manifest: baseline(), sourceCommit: commit }), /ARCHIVE_CONTENT_MISMATCH/);
});

test('changed path, price fingerprint, baseline, source and duplicate IDs are blocked', () => {
  const manifest = baseline(), valid = snapshot();
  for (const [mutate, expected] of [
    [s => { s.entries[0].path = '/autre/'; }, /ENTRY_BASELINE_OR_PATH_CHANGED/],
    [s => { s.pricingFingerprint = '0'.repeat(64); }, /SNAPSHOT_BASELINE_OR_PRICES_MISMATCH/],
    [s => { s.entries[0].data.renderHash = '0'.repeat(64); }, /SOURCE_RENDER_CHANGED/],
    [s => { s.entries.push(structuredClone(s.entries[0])); }, /INVALID_SNAPSHOT_ENTRIES/],
  ]) {
    const invalid = structuredClone(valid); mutate(invalid);
    assert.throws(() => validateSnapshot(rehash(invalid), manifest), expected);
  }
  assert.throws(() => validateSnapshot(valid, manifest, { sourceCommit: 'b'.repeat(40) }), /SNAPSHOT_SOURCE_MISMATCH/);
});

test('invalid content links and incompatible source render hash cannot pass validation', () => {
  const invalid = snapshot();
  invalid.entries[0].content[0].markDefs = [{ _type: 'link', _key: 'bad', href: 'javascript:alert(1)' }];
  invalid.entries[0].content[0].children[0].marks = ['bad'];
  assert.throws(() => validateSnapshot(rehash(invalid), baseline()), /Protocole/);
});

test('repeated pagination cursors are blocked and cannot loop indefinitely', async () => {
  let pages = 0;
  const client = { request: async () => { pages++; return { entries: [], scanned: 0, nextCursor: 'repeated' }; } };
  await assert.rejects(pullSnapshot({ client, manifest: baseline(), sourceCommit: commit }), /CMS_REPEATED_CURSOR/);
  assert.equal(pages, 2);
});

test('duplicate rows across pages cannot silently overwrite each other', async () => {
  const client = { request: async (_method, route) => route.includes('collection=pages_commerciales') ? { entries: [entry(), entry()], scanned: 2 } : { entries: [], scanned: 0 } };
  await assert.rejects(pullSnapshot({ client, manifest: baseline(), sourceCommit: commit }), /DUPLICATE_OR_MIXED_CMS_PAGE/);
});

test('oversized export pages retry the exact cursor with a smaller limit', async () => {
  const mock = httpMock(); const attempts = [];
  const client = { request: async (method, route, ...args) => {
    if (route.includes('/entries?')) {
      const params = new URL(route, 'https://cms.example.test').searchParams;
      if (params.get('collection') === 'pages_commerciales') {
        attempts.push({ limit: params.get('limit'), cursor: params.get('cursor') });
        if (Number(params.get('limit')) > 25) throw new Error('CMS_HTTP_413');
      }
    }
    return mock.client.request(method, route, ...args);
  } };
  const result = await pullSnapshot({ client, manifest: baseline(), sourceCommit: commit });
  assert.equal(result.entries.length, 1);
  assert.deepEqual(attempts, [{ limit: '100', cursor: null }, { limit: '50', cursor: null }, { limit: '25', cursor: null }]);
});

test('a single oversized export entry is blocked without an infinite retry', async () => {
  let calls = 0;
  await assert.rejects(pullSnapshot({ client: { request: async () => { calls++; throw new Error('CMS_HTTP_413'); } }, manifest: baseline(), sourceCommit: commit }), /CMS_ENTRY_TOO_LARGE/);
  assert.equal(calls, 7);
});

test('public HTTP origins and embedded user credentials are rejected', () => {
  assert.throws(() => createCMSClient({ origin: 'http://cms.example.test' }), /CMS_HTTPS_REQUIRED/);
  assert.throws(() => createCMSClient({ origin: 'https://user:password@cms.example.test' }), /INVALID_CMS_ORIGIN/);
});

test('report uses compare-and-swap current state and safe metadata', async () => {
  const mock = httpMock(), value = snapshot();
  assert.equal((await reportSnapshot({ client: mock.client, snapshot: value, status: 'checking' })).state, 'checking');
  assert.equal((await reportSnapshot({ client: mock.client, snapshot: value, status: 'checking', report: { previewVerified: true, previewDeployId: 'preview', previewUrl: 'https://preview--flex-webb.netlify.app' } })).state, 'preview_ready');
  assert.equal((await reportSnapshot({ client: mock.client, snapshot: value, status: 'deployed', deployId: 'candidate-deploy-123' })).state, 'deployed');
  const posted = mock.calls.filter(c => c.method === 'POST').map(c => JSON.parse(c.body));
  assert.deepEqual(posted.map(c => c.expectedState), ['draft', 'checking', 'preview_ready']);
});

test('creating a preview does not report it as verified, unchanged deployed reports stay idempotent', async () => {
  const mock = httpMock(), value = snapshot();
  await reportSnapshot({ client: mock.client, snapshot: value, status: 'checking' });
  const pending = await reportSnapshot({ client: mock.client, snapshot: value, status: 'checking', report: { previewDeployId: 'candidate', previewUrl: 'https://candidate--flex-webb.netlify.app' } });
  assert.equal(pending.state, 'checking');
  await reportSnapshot({ client: mock.client, snapshot: value, status: 'checking', report: { previewVerified: true, previewUrl: 'https://candidate--flex-webb.netlify.app' } });
  await reportSnapshot({ client: mock.client, snapshot: value, status: 'deployed', deployId: 'candidate-deploy-123', report: { previewUrl: 'https://candidate--flex-webb.netlify.app' } });
  const postCount = mock.calls.filter(c => c.method === 'POST').length;
  const same = await reportSnapshot({ client: mock.client, snapshot: value, status: 'deployed', deployId: 'candidate-deploy-123' });
  assert.equal(same.state, 'deployed'); assert.equal(mock.calls.filter(c => c.method === 'POST').length, postCount);
});

test('archive left without status by an interrupted write is repaired without replacing snapshot', async () => {
  const value = snapshot(); let repaired = false, writes = 0;
  const client = { request: async (method, route, body) => {
    if (route.includes('/entries?')) return { entries: route.includes('collection=pages_commerciales') ? [entry()] : [], scanned: 1 };
    if (route.endsWith('/status')) return repaired ? { state: 'draft' } : null;
    if (method === 'POST') { assert.deepEqual(body, value); repaired = true; writes++; return value; }
    return value;
  } };
  const returned = await pullSnapshot({ client, manifest: baseline(), sourceCommit: commit });
  assert.deepEqual(returned, value); assert.equal(writes, 1);
});

test('publication report redacts arbitrary provider error messages', async () => {
  const mock = httpMock();
  await reportSnapshot({ client: mock.client, snapshot: snapshot(), status: 'checking' });
  await reportSnapshot({ client: mock.client, snapshot: snapshot(), status: 'blocked', report: { errorCode: 'Bearer private-secret' } });
  const body = mock.calls.filter(c => c.method === 'POST').at(-1).body;
  assert.doesNotMatch(body, /private-secret/); assert.match(body, /PUBLICATION_BLOCKED/);
});

test('compressed tracked manifest validates and apply only installs ignored snapshot', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'flexweb-cms-snapshot-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'cms')); await writeFile(path.join(root, 'cms/baseline.json.gz'), gzipSync(JSON.stringify(baseline())));
  const input = path.join(root, 'candidate.json'); await writeFile(input, JSON.stringify(snapshot()));
  assert.equal((await readManifest(root)).hash, baseline().hash);
  await main(['apply', '--input', input], { root, env: { CMS_SOURCE_COMMIT: commit } });
  assert.deepEqual(await readdir(path.join(root, '.cms')), ['snapshot.json']);
  assert.equal(JSON.parse(await readFile(path.join(root, '.cms/snapshot.json'))).id, snapshot().id);
  assert.deepEqual((await readdir(root)).sort(), ['.cms', 'candidate.json', 'cms']);
});

test('corrupted manifest cannot authorize new paths', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'flexweb-cms-bad-manifest-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, '.cms')); const manifest = baseline(); manifest.entries[0].path = '/unauthorized/';
  await writeFile(path.join(root, '.cms/manifest.json'), JSON.stringify(manifest));
  await assert.rejects(readManifest(root), /BASELINE_HASH_MISMATCH/);
});
