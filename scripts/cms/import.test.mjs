import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, lstat, rm, chmod } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { runImport, scanInput, mapRecord, normalizeOrigin, parseArguments, createApi } from './import.mjs';

const token = 'ec_pat_unit_test_credential_never_logged';
const origin = 'https://cms.example.test';
const sort = value => Array.isArray(value) ? value.map(sort) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, sort(value[key])])) : value;
const hash = value => createHash('sha256').update(JSON.stringify(sort(value))).digest('hex');
const digest = 'a'.repeat(64);
function record(sourceId = 'first', overrides = {}) {
  const value = { collection: 'pages', sourceId, path: `/${sourceId}/`, title: `Page ${sourceId}`, seoTitle: `SEO ${sourceId}`, seoDescription: 'Description de la page', content: [], data: {}, sourcePayloadHash: digest, baseManifestHash: digest, sourceUpdatedAt: '2026-09-25T00:00:00Z', ...overrides };
  value.baselineHash = hash({ title: value.title, seoTitle: value.seoTitle, seoDescription: value.seoDescription, content: value.content, data: value.data });
  return value;
}
function item(value, id = value.sourceId) { return { id, type: value.collection, status: 'draft', data: mapRecord(value).data, version: 1, draftRevisionId: null }; }
function response(data, status = 200, headers = {}) { return new Response(JSON.stringify({ success: true, data }), { status, headers: { 'content-type': 'application/json', ...headers } }); }
async function fixture(t, records, gzip = false) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'flexweb-import-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, '.cms'), { mode: 0o700 });
  const input = path.join(root, '.cms', gzip ? 'import.ndjson.gz' : 'import.ndjson');
  const text = records.map(value => JSON.stringify(value)).join('\n') + '\n';
  await writeFile(input, gzip ? gzipSync(text) : text, { mode: 0o600 });
  return { input, checkpoint: path.join(root, '.cms/import-checkpoint.json'), origin, token, sleep: async () => {} };
}
function mockApi(initial = [], hook) {
  const records = new Map(initial.map(value => [`${value.type}:${value.id}`, structuredClone(value)]));
  const calls = []; let serial = 0, active = 0, maxActive = 0;
  const fetchImpl = async (url, options) => {
    assert.equal(options.headers.authorization, `Bearer ${token}`);
    assert.equal(options.redirect, 'error');
    const parsed = new URL(url), method = options.method;
    const body = options.body ? JSON.parse(options.body) : undefined;
    calls.push({ method, url: parsed, body });
    active++; maxActive = Math.max(maxActive, active);
    try {
      const overridden = await hook?.({ url: parsed, method, body, records, calls });
      if (overridden) return overridden;
      if (parsed.pathname === '/_emdash/api/auth/me') return response({ role: 50 });
      const match = parsed.pathname.match(/^\/_emdash\/api\/content\/([^/]+)(?:\/([^/]+))?(?:\/(publish))?$/);
      assert.ok(match, parsed.pathname);
      const [, collection, id, action] = match;
      if (!id && method === 'GET') {
        const filter = JSON.parse(parsed.searchParams.get('fieldFilters') || '{}');
        const matching = [...records.values()].filter(row => row.type === collection && Object.entries(filter).every(([key, value]) => row.data[key] === value));
        const offset = Number(parsed.searchParams.get('cursor') || 0);
        return response({ items: matching.slice(offset, offset + 100), nextCursor: offset + 100 < matching.length ? String(offset + 100) : null, total: matching.length });
      }
      if (!id && method === 'POST') {
        assert.equal(body.status, 'draft'); assert.equal(body.locale, 'fr');
        if ([...records.values()].some(row => row.type === collection && row.data.source_id === body.data.source_id)) return response({}, 409);
        const row = { id: `created-${++serial}`, type: collection, data: body.data, status: 'draft', version: 1, draftRevisionId: null };
        records.set(`${collection}:${row.id}`, row);
        return response({ item: row, _rev: `rev-${row.version}` });
      }
      const row = records.get(`${collection}:${id}`);
      assert.ok(row, `${collection}:${id}`);
      if (method === 'GET') return response({ item: row, _rev: `rev-${row.version}` });
      assert.equal(action, 'publish'); assert.equal(method, 'POST');
      if (body._rev !== `rev-${row.version}`) return response({}, 409);
      row.status = 'published'; row.version++;
      return response({ item: row, _rev: `rev-${row.version}` });
    } finally { active--; }
  };
  return { fetchImpl, records, calls, maxActive: () => maxActive };
}

test('local dry-run streams gzip without credentials, remote writes or checkpoint', async t => {
  const options = await fixture(t, [record(), record('73065', { collection: 'communes', path: '' })], true);
  let calls = 0;
  const result = await runImport({ ...options, origin: undefined, token: undefined, fetchImpl: async () => { calls++; throw Error('forbidden'); } });
  assert.equal(result.mode, 'dry-run-local'); assert.equal(result.counts.planned, 2); assert.equal(calls, 0);
  await assert.rejects(lstat(options.checkpoint), { code: 'ENOENT' });
});

test('default remote dry-run authenticates admin, paginates and preserves editorial edits', async t => {
  const source = record('known');
  const existing = item(source); existing.data.title = 'Texte modifié par le propriétaire';
  const initial = Array.from({ length: 100 }, (_, i) => item(record(`unrelated-${i}`)));
  const api = mockApi([...initial, existing]);
  const options = await fixture(t, [source, record('new')]);
  const result = await runImport({ ...options, fetchImpl: api.fetchImpl });
  assert.equal(result.counts.preserved, 1); assert.equal(result.counts.preservedEdited, 1); assert.equal(result.counts.planned, 1);
  assert.ok(api.calls.some(call => call.url.searchParams.get('cursor') === '100'));
  assert.ok(api.calls.every(call => call.method === 'GET'));
  await assert.rejects(lstat(options.checkpoint), { code: 'ENOENT' });
});

test('execute creates and publishes only new records; rerun does not duplicate', async t => {
  const options = await fixture(t, [record('old'), record('new')]);
  const edited = item(record('old')); edited.data.title = 'Edition conservée';
  const api = mockApi([edited]);
  const result = await runImport({ ...options, execute: true, publishBaseline: true, fetchImpl: api.fetchImpl });
  assert.deepEqual({ created: result.counts.created, published: result.counts.published, preserved: result.counts.preserved }, { created: 1, published: 1, preserved: 1 });
  assert.equal(api.records.get('pages:old').data.title, 'Edition conservée');
  const writes = api.calls.filter(call => call.method === 'POST').length;
  await runImport({ ...options, execute: true, publishBaseline: true, fetchImpl: api.fetchImpl });
  assert.equal(api.calls.filter(call => call.method === 'POST').length, writes);
  assert.equal((await lstat(options.checkpoint)).mode & 0o777, 0o600);
  assert.ok(!(await readFile(options.checkpoint, 'utf8')).includes(token));
});

test('all local and remote collisions fail before any write', async t => {
  const original = record('same');
  const duplicates = await fixture(t, [original, original]);
  await assert.rejects(scanInput(duplicates.input), { code: 'DUPLICATE_SOURCE_ID' });
  const duplicatePath = await fixture(t, [original, record('different', { path: original.path })]);
  await assert.rejects(scanInput(duplicatePath.input), { code: 'DUPLICATE_PUBLIC_PATH' });
  const options = await fixture(t, [record('first-valid'), original]);
  for (const existing of [record('same', { path: '/elsewhere/' }), record('other', { path: '/same/', collection: 'realisations' })]) {
    const api = mockApi([item(existing)]);
    await assert.rejects(runImport({ ...options, execute: true, fetchImpl: api.fetchImpl }), error => ['SOURCE_ID_PATH_COLLISION', 'PUBLIC_PATH_SOURCE_COLLISION'].includes(error.code));
    assert.ok(api.calls.every(call => call.method === 'GET'));
  }
});

test('429 and 5xx retries are bounded, honor Retry-After and never echo response secrets', async t => {
  const options = await fixture(t, [record()]);
  let tries = 0; const delays = [];
  const api = mockApi([], ({ url }) => {
    if (url.pathname === '/_emdash/api/auth/me' && ++tries <= 2) return response({ detail: token }, tries === 1 ? 429 : 503, { 'retry-after': '2' });
  });
  await runImport({ ...options, fetchImpl: api.fetchImpl, sleep: async delay => delays.push(delay) });
  assert.deepEqual(delays, [2000, 2000]);
  let count = 0;
  await assert.rejects(runImport({ ...options, fetchImpl: async () => { count++; return response({ secret: token }, 503); }, maxAttempts: 3 }), error => error.code === 'CMS_HTTP_503' && !String(error).includes(token));
  assert.equal(count, 3);
});

test('an uncertain create reconciles by source_id without duplicate or automatic publication', async t => {
  const options = await fixture(t, [record()]); let postCount = 0;
  const api = mockApi([], ({ method, body, records }) => {
    if (method === 'POST' && body?.data) {
      postCount++;
      records.set('pages:uncertain', { id: 'uncertain', type: 'pages', status: 'draft', data: body.data, version: 1 });
      throw Error('response lost');
    }
  });
  const result = await runImport({ ...options, execute: true, publishBaseline: true, fetchImpl: api.fetchImpl });
  assert.equal(postCount, 1); assert.equal(result.counts.uncertain, 1); assert.equal(result.counts.published, 0);
  assert.equal(result.needsReview, true);
  assert.ok(api.calls.some(call => call.url.searchParams.has('fieldFilters')));
});

test('a failed create is retried only after absence is confirmed by source_id', async t => {
  const options = await fixture(t, [record()]); let creates = 0; const delays = [];
  const api = mockApi([], ({ method, body }) => { if (method === 'POST' && body?.data && ++creates === 1) return response({}, 503); });
  const result = await runImport({ ...options, execute: true, fetchImpl: api.fetchImpl, sleep: async ms => delays.push(ms) });
  assert.equal(result.counts.created, 1); assert.equal(creates, 2); assert.equal(delays.length, 1);
  const writes = api.calls.map((call, index) => ({ call, index })).filter(({ call }) => call.method === 'POST');
  assert.ok(api.calls.slice(writes[0].index + 1, writes[1].index).some(call => call.url.searchParams.has('fieldFilters')));
});

test('checkpoint resumes a created draft after a failed publication', async t => {
  const options = await fixture(t, [record()]); let failPublish = true;
  const api = mockApi([], ({ url }) => { if (failPublish && url.pathname.endsWith('/publish')) return response({}, 503); });
  await assert.rejects(runImport({ ...options, execute: true, publishBaseline: true, fetchImpl: api.fetchImpl, maxAttempts: 1 }), { code: 'CMS_HTTP_503' });
  const saved = JSON.parse(await readFile(options.checkpoint, 'utf8'));
  assert.equal(saved.pending['pages:first'].stage, 'created'); assert.equal(saved.completedLine, 0);
  failPublish = false;
  const result = await runImport({ ...options, execute: true, publishBaseline: true, fetchImpl: api.fetchImpl });
  assert.equal(result.counts.created, 1); assert.equal(result.counts.published, 1);
  assert.equal(api.calls.filter(call => call.method === 'POST' && call.body?.data).length, 1);
});

test('a resumed draft edited by a person is preserved, never published', async t => {
  const options = await fixture(t, [record()]); let failPublish = true;
  const api = mockApi([], ({ url }) => { if (failPublish && url.pathname.endsWith('/publish')) return response({}, 503); });
  await assert.rejects(runImport({ ...options, execute: true, publishBaseline: true, fetchImpl: api.fetchImpl, maxAttempts: 1 }));
  const created = [...api.records.values()][0]; created.data.title = 'Modification manuelle'; created.version++;
  failPublish = false;
  const writes = api.calls.filter(call => call.method === 'POST').length;
  const result = await runImport({ ...options, execute: true, publishBaseline: true, fetchImpl: api.fetchImpl });
  assert.equal(result.counts.preservedEdited, 1); assert.equal(result.counts.published, 0);
  assert.equal(result.needsReview, true);
  assert.equal(api.calls.filter(call => call.method === 'POST').length, writes);
  assert.equal(created.data.title, 'Modification manuelle');
});

test('a partly completed batch resumes without losing successes or double-counting them', async t => {
  const options = await fixture(t, [record('one'), record('two'), record('three')]); let fail = true;
  const api = mockApi([], ({ method, body }) => { if (fail && method === 'POST' && body?.data?.source_id === 'two') return response({}, 503); });
  await assert.rejects(runImport({ ...options, execute: true, fetchImpl: api.fetchImpl, concurrency: 1, maxAttempts: 1 }));
  const saved = JSON.parse(await readFile(options.checkpoint, 'utf8'));
  assert.equal(saved.pending['pages:one'].stage, 'complete'); assert.equal(saved.completedLine, 0);
  fail = false;
  const result = await runImport({ ...options, execute: true, fetchImpl: api.fetchImpl, concurrency: 1 });
  assert.equal(result.counts.created, 3); assert.equal(api.records.size, 3);
  assert.equal(api.calls.filter(call => call.method === 'POST' && call.body?.data?.source_id === 'one').length, 1);
});

test('input hash changes, insecure checkpoints, non-admin and remote HTTP fail closed', async t => {
  for (const url of ['http://cms.example.test', 'https://user:password@cms.example.test', 'https://cms.example.test/path', 'https://cms.example.test/?key=secret']) assert.throws(() => normalizeOrigin(url));
  assert.equal(normalizeOrigin('http://127.0.0.1:4321'), 'http://127.0.0.1:4321');
  const options = await fixture(t, [record()]); const api = mockApi();
  await runImport({ ...options, execute: true, fetchImpl: api.fetchImpl });
  await writeFile(options.input, JSON.stringify(record('different')) + '\n');
  await assert.rejects(runImport({ ...options, execute: true, fetchImpl: api.fetchImpl }), { code: 'CHECKPOINT_INPUT_MISMATCH' });
  await chmod(options.checkpoint, 0o644);
  await assert.rejects(runImport({ ...options, execute: true, fetchImpl: api.fetchImpl }), { code: 'CHECKPOINT_FILE_UNSAFE' });
  const userApi = mockApi([], ({ url }) => url.pathname.endsWith('/auth/me') ? response({ role: 40 }) : undefined);
  await assert.rejects(runImport({ ...options, fetchImpl: userApi.fetchImpl }), { code: 'CMS_ADMIN_REQUIRED' });
  assert.ok(userApi.calls.every(call => call.method === 'GET'));
});

test('concurrency is at most two, batch guard holds and repeated cursors stop', async t => {
  const options = await fixture(t, Array.from({ length: 7 }, (_, i) => record(`page-${i}`)));
  const api = mockApi([], async ({ method }) => { if (method === 'POST') await new Promise(resolve => setTimeout(resolve, 5)); });
  const result = await runImport({ ...options, execute: true, fetchImpl: api.fetchImpl, batchSize: 3 });
  assert.equal(result.counts.created, 7); assert.ok(api.maxActive() <= 2);
  await assert.rejects(runImport({ ...options, batchSize: 101 }), { code: 'INVALID_BATCH_SIZE' });
  await assert.rejects(runImport({ ...options, concurrency: 3 }), { code: 'INVALID_CONCURRENCY' });
  const client = createApi({ origin, token, fetchImpl: async () => response({ items: [], nextCursor: 'loop' }) });
  await assert.rejects(client.list('pages'), { code: 'REPEATED_PAGE_CURSOR' });
});

test('CLI keeps credentials in environment and requires explicit execution for baseline publication', async t => {
  assert.deepEqual(parseArguments([], { EMDASH_URL: origin, EMDASH_ADMIN_TOKEN: token }), { origin, token });
  assert.throws(() => parseArguments(['--token', token], {}), { code: 'UNKNOWN_ARGUMENT' });
  const options = await fixture(t, [record()]);
  await assert.rejects(runImport({ ...options, publishBaseline: true }), { code: 'PUBLISH_REQUIRES_EXECUTE' });
});
