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
function brokenBodyResponse(status = 200) {
  return new Response(new ReadableStream({ start(controller) {
    controller.enqueue(new TextEncoder().encode('{"success":true,"data":'));
    controller.error(new TypeError('private provider detail must not escape'));
  } }), { status, headers: { 'content-type': 'application/json' } });
}
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

test('a complete native create is published with its original revision without an initial item GET', async t => {
  const options = await fixture(t, [record()]); const api = mockApi();
  const result = await runImport({ ...options, execute: true, publishBaseline: true, fetchImpl: api.fetchImpl });
  assert.equal(result.counts.published, 1);
  assert.equal(api.calls.filter(call => call.method === 'GET' && /\/content\/pages\/[^/]+$/.test(call.url.pathname)).length, 0);
  assert.deepEqual(api.calls.filter(call => call.method === 'POST').map(call => [call.url.pathname, call.body._rev]), [
    ['/_emdash/api/content/pages', undefined], ['/_emdash/api/content/pages/created-1/publish', 'rev-1'],
  ]);
});

test('an incomplete create response is reconciled without publishing unverified mapping', async t => {
  const options = await fixture(t, [record()]);
  const api = mockApi([], ({ method, body, records }) => {
    if (method === 'POST' && body?.data) {
      const row = { id: 'created', type: 'pages', status: 'draft', data: body.data, version: 1 };
      records.set('pages:created', row);
      const incomplete = structuredClone(row); delete incomplete.data.source_payload_hash;
      return response({ item: incomplete, _rev: 'rev-1' });
    }
  });
  const result = await runImport({ ...options, execute: true, publishBaseline: true, fetchImpl: api.fetchImpl });
  assert.equal(result.counts.uncertain, 1); assert.equal(result.counts.published, 0);
  assert.equal(result.needsReview, true);
  assert.ok(api.calls.some(call => call.url.searchParams.has('fieldFilters')));
  assert.ok(!api.calls.some(call => call.url.pathname.endsWith('/publish')));
});

test('a concurrent edit after create is preserved when native publication rejects the original revision', async t => {
  const options = await fixture(t, [record()]);
  const api = mockApi([], ({ url, method, body, records }) => {
    if (method === 'POST' && url.pathname.endsWith('/publish')) {
      const row = records.get('pages:created-1');
      row.data.title = 'Edition pendant la publication'; row.version++;
      assert.equal(body._rev, 'rev-1');
      // The native endpoint below returns 409 for the stale revision.
    }
  });
  const result = await runImport({ ...options, execute: true, publishBaseline: true, fetchImpl: api.fetchImpl });
  assert.equal(result.counts.created, 1); assert.equal(result.counts.published, 0);
  assert.equal(result.counts.preservedEdited, 1); assert.equal(result.needsReview, true);
  assert.equal(api.records.get('pages:created-1').status, 'draft');
  assert.equal(api.records.get('pages:created-1').data.title, 'Edition pendant la publication');
  assert.equal(api.calls.filter(call => call.url.pathname.endsWith('/publish')).length, 1);
});

test('an uncertain publication reloads the item before recognizing success without publishing twice', async t => {
  const options = await fixture(t, [record()]);
  const api = mockApi([], ({ url, method, records }) => {
    if (method === 'POST' && url.pathname.endsWith('/publish')) {
      const row = records.get('pages:created-1'); row.status = 'published'; row.version++;
      throw Error('publication succeeded but response lost');
    }
  });
  const result = await runImport({ ...options, execute: true, publishBaseline: true, fetchImpl: api.fetchImpl });
  assert.equal(result.counts.published, 1); assert.equal(result.needsReview, false);
  const calls = api.calls.filter(call => call.url.pathname.startsWith('/_emdash/api/content/pages/'));
  assert.deepEqual(calls.map(call => [call.method, call.url.pathname]), [
    ['POST', '/_emdash/api/content/pages/created-1/publish'], ['GET', '/_emdash/api/content/pages/created-1'],
  ]);
});

test('a committed CREATE with a lost response body is reconciled without duplicate creation or unverified publication', async t => {
  const options = await fixture(t, [record()]);
  const api = mockApi([], ({ method, body, records }) => {
    if (method === 'POST' && body?.data) {
      records.set('pages:committed', { id: 'committed', type: 'pages', status: 'draft', data: body.data, version: 1, draftRevisionId: null });
      return brokenBodyResponse(201);
    }
  });
  const result = await runImport({ ...options, execute: true, publishBaseline: true, fetchImpl: api.fetchImpl });
  assert.equal(result.counts.uncertain, 1); assert.equal(result.counts.preserved, 1); assert.equal(result.counts.published, 0);
  assert.equal(result.needsReview, true); assert.equal(api.records.size, 1);
  assert.equal(api.calls.filter(call => call.method === 'POST').length, 1);
  assert.ok(api.calls.some(call => call.method === 'GET' && call.url.searchParams.has('fieldFilters')));
  const checkpoint = JSON.parse(await readFile(options.checkpoint, 'utf8'));
  assert.equal(checkpoint.completedLine, 1); assert.deepEqual(checkpoint.pending, {});
});

test('a committed PUBLISH with a lost response body is confirmed by GET without repeating the POST', async t => {
  const options = await fixture(t, [record()]);
  const api = mockApi([], ({ url, method, records }) => {
    if (method === 'POST' && url.pathname.endsWith('/publish')) {
      const row = records.get('pages:created-1'); row.status = 'published'; row.version++;
      return brokenBodyResponse();
    }
  });
  const result = await runImport({ ...options, execute: true, publishBaseline: true, fetchImpl: api.fetchImpl });
  assert.equal(result.counts.created, 1); assert.equal(result.counts.published, 1); assert.equal(result.needsReview, false);
  const calls = api.calls.filter(call => call.url.pathname.startsWith('/_emdash/api/content/pages/'));
  assert.deepEqual(calls.map(call => [call.method, call.url.pathname]), [
    ['POST', '/_emdash/api/content/pages/created-1/publish'], ['GET', '/_emdash/api/content/pages/created-1'],
  ]);
});

test('HTTP errors release unread bodies before a GET retry, retaining status and Retry-After', async () => {
  const events = [];
  const client = createApi({ origin, token, sleep: async ms => events.push(`sleep:${ms}`), fetchImpl: async () => {
    events.push('fetch');
    if (events.length > 1) return response({ ok: true });
    return new Response(new ReadableStream({ cancel() { events.push('cancel'); } }), { status: 429, headers: { 'retry-after': '2' } });
  } });
  assert.deepEqual(await client.request('GET', '/auth/me'), { ok: true });
  assert.deepEqual(events, ['fetch', 'cancel', 'sleep:2000', 'fetch']);
});

test('failed body cancellation cannot replace an HTTP error or trigger a direct POST retry', async () => {
  let calls = 0, canceled = 0;
  const client = createApi({ origin, token, sleep: async () => assert.fail('POST must not retry directly'), fetchImpl: async () => {
    calls++;
    return new Response(new ReadableStream({ cancel() { canceled++; throw new Error(token); } }), { status: 503, headers: { 'retry-after': '3' } });
  } });
  await assert.rejects(client.request('POST', '/content/pages', {}), error => error.code === 'CMS_HTTP_503' && error.status === 503 && error.retryAfter === 3000 && !String(error).includes(token));
  assert.equal(calls, 1); assert.equal(canceled, 1);
});

test('body stream failures have a distinct safe diagnostic, bounded GET retries and no direct POST retry', async () => {
  let calls = 0, sleeps = 0;
  const client = createApi({ origin, token, maxAttempts: 3, sleep: async () => { sleeps++; }, fetchImpl: async () => { calls++; return brokenBodyResponse(); } });
  await assert.rejects(client.request('GET', '/auth/me'), error => error.code === 'BODY_RESPONSE_FAILED' && error.status === 200 && !String(error).includes('private provider'));
  assert.equal(calls, 3); assert.equal(sleeps, 2);
  await assert.rejects(client.request('POST', '/content/pages', {}), { code: 'BODY_RESPONSE_FAILED' });
  assert.equal(calls, 4); assert.equal(sleeps, 2);
});

test('malformed JSON and rejected envelopes stay protocol errors without automatic retry', async () => {
  for (const [body, code] of [['not JSON ' + token, 'INVALID_CMS_RESPONSE'], ['null', 'CMS_OPERATION_REJECTED']]) {
    let calls = 0;
    const client = createApi({ origin, token, sleep: async () => assert.fail('invalid protocol must not retry'), fetchImpl: async () => { calls++; return new Response(body); } });
    await assert.rejects(client.request('GET', '/auth/me'), error => error.code === code && !String(error).includes(token));
    assert.equal(calls, 1);
  }
});

test('an uncertain publication reloads and stops if a concurrent edit changes the revision', async t => {
  const options = await fixture(t, [record()]);
  const api = mockApi([], ({ url, method, records }) => {
    if (method === 'POST' && url.pathname.endsWith('/publish')) {
      // A revision-only change is enough to forbid retrying the old publication.
      const row = records.get('pages:created-1'); row.version++;
      return response({}, 503);
    }
  });
  const result = await runImport({ ...options, execute: true, publishBaseline: true, fetchImpl: api.fetchImpl });
  assert.equal(result.counts.published, 0); assert.equal(result.counts.preservedEdited, 1);
  assert.equal(api.calls.filter(call => call.url.pathname.endsWith('/publish')).length, 1);
  assert.equal(api.calls.filter(call => call.method === 'GET' && call.url.pathname.endsWith('/created-1')).length, 1);
});

test('native datetime normalization does not falsely mark newly imported drafts as edited', async t => {
  const sources = [
    record('date-no-milliseconds', { sourceUpdatedAt: '2026-09-25T00:00:00Z' }),
    record('date-offset', { sourceUpdatedAt: '2026-09-25T02:00:00+02:00' }),
    record('date-canonical', { sourceUpdatedAt: '2026-09-25T00:00:00.000Z' }),
  ];
  const options = await fixture(t, sources);
  const api = mockApi([], ({ method, body }) => {
    if (method === 'POST' && body?.data) {
      // EmDash 1.0.1 ContentDatetimeNormalizer -> normalizeDatetime stores
      // explicit-offset datetime fields using Date.toISOString().
      body.data.source_updated_at = new Date(body.data.source_updated_at).toISOString();
    }
  });
  const result = await runImport({ ...options, execute: true, publishBaseline: true, fetchImpl: api.fetchImpl });
  assert.equal(result.counts.created, 3);
  assert.equal(result.counts.published, 3);
  assert.equal(result.counts.preservedEdited, 0);
  assert.equal(result.needsReview, false);
  for (const source of sources) {
    const stored = [...api.records.values()].find(value => value.data.source_id === source.sourceId);
    assert.equal(stored.data.source_updated_at, '2026-09-25T00:00:00.000Z');
    assert.equal(stored.data.baseline_hash, source.baselineHash);
    assert.equal(stored.data.source_payload_hash, source.sourcePayloadHash);
    assert.equal(stored.status, 'published');
  }
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
  const callsBeforeResume = api.calls.length;
  failPublish = false;
  const result = await runImport({ ...options, execute: true, publishBaseline: true, fetchImpl: api.fetchImpl });
  assert.equal(result.counts.created, 1); assert.equal(result.counts.published, 1);
  assert.equal(api.calls.filter(call => call.method === 'POST' && call.body?.data).length, 1);
  const resumed = api.calls.slice(callsBeforeResume).filter(call => call.url.pathname.startsWith('/_emdash/api/content/pages/'));
  assert.deepEqual(resumed.map(call => call.method), ['GET', 'POST']);
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
  for (const concurrency of [0, 33, 1.5, '4', Number.NaN, Number.POSITIVE_INFINITY]) await assert.rejects(runImport({ ...options, concurrency }), { code: 'INVALID_CONCURRENCY' });
  await assert.rejects(runImport({ ...options, shouldPause: true }), { code: 'INVALID_PAUSE_CALLBACK' });
  const client = createApi({ origin, token, fetchImpl: async () => response({ items: [], nextCursor: 'loop' }) });
  await assert.rejects(client.list('pages'), { code: 'REPEATED_PAGE_CURSOR' });
});

for (const concurrency of [4, 8, 16, 32]) test(`explicit concurrency ${concurrency} permits exactly that many in-flight requests and preserves all checkpoints`, async t => {
  const options = await fixture(t, Array.from({ length: concurrency * 2 + 1 }, (_, i) => record(`parallel-${i}`)));
  let entered = 0, release;
  const firstWave = new Promise(resolve => { release = resolve; });
  const api = mockApi([], async ({ method, body }) => {
    if (method === 'POST' && body?.data && ++entered <= concurrency) {
      if (entered === concurrency) release();
      await firstWave;
    }
  });
  const result = await runImport({ ...options, execute: true, publishBaseline: true, fetchImpl: api.fetchImpl, concurrency, batchSize: concurrency });
  assert.equal(api.maxActive(), concurrency);
  assert.equal(result.counts.created, concurrency * 2 + 1);
  assert.equal(result.counts.published, concurrency * 2 + 1);
  assert.equal(result.remaining, 0);
  const checkpoint = JSON.parse(await readFile(options.checkpoint, 'utf8'));
  assert.equal(checkpoint.completedLine, concurrency * 2 + 1);
  assert.deepEqual(checkpoint.pending, {});
  const writes = api.calls.filter(call => call.method === 'POST').length;
  await runImport({ ...options, execute: true, publishBaseline: true, fetchImpl: api.fetchImpl, concurrency });
  assert.equal(api.calls.filter(call => call.method === 'POST').length, writes);
});

for (const concurrency of [8, 16, 32]) test(`a terminal failure with ${concurrency} active requests drains the first wave before unlocking and resumes exactly once`, { timeout: 30000 }, async t => {
  const total = concurrency * 2 + 1;
  const sources = Array.from({ length: total }, (_, i) => record(`drain-${i}`));
  const options = await fixture(t, sources), lockPath = path.join(path.dirname(options.checkpoint), 'import.lock');
  const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
  const firstWaveEntered = deferred(), otherWorkersPublished = deferred();
  const gates = Array.from({ length: concurrency }, deferred);
  let failingRun = true, entered = 0, held = 0, publications = 0, settled = false;
  const api = mockApi([], async ({ method, body, url }) => {
    if (!failingRun || method !== 'POST') return;
    if (body?.data) {
      const position = sources.findIndex(source => source.sourceId === body.data.source_id);
      assert.ok(position < concurrency, 'no second wave may start after the terminal failure');
      entered++; held++;
      if (entered === concurrency) firstWaveEntered.resolve();
      try { await gates[position].promise; }
      finally { held--; }
      // A known terminal rejection: no remote record is created for this source.
      if (position === 0) return response({}, 401);
    } else if (url.pathname.endsWith('/publish') && ++publications === concurrency - 2) otherWorkersPublished.resolve();
  });
  const outcome = runImport({ ...options, execute: true, publishBaseline: true, fetchImpl: api.fetchImpl, concurrency, batchSize: concurrency * 2 })
    .then(value => { settled = true; return { value }; }, error => { settled = true; return { error }; });
  try {
    await firstWaveEntered.promise;
    assert.equal(api.maxActive(), concurrency); assert.equal(held, concurrency);
    gates[0].resolve();
    // Flush the rejected request's microtasks before releasing any other worker.
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(held, concurrency - 1); assert.equal(settled, false);
    assert.ok((await lstat(lockPath)).isFile());

    for (let position = 1; position < concurrency - 1; position++) gates[position].resolve();
    await otherWorkersPublished.promise;
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(held, 1); assert.equal(settled, false);
    assert.ok((await lstat(lockPath)).isFile(), 'the final in-flight request still owns the import lock');
    assert.equal(api.calls.filter(call => call.method === 'POST' && call.body?.data).length, concurrency);

    gates[concurrency - 1].resolve();
    const failed = await outcome;
    assert.equal(failed.error?.code, 'CMS_HTTP_401'); assert.equal(held, 0);
    await assert.rejects(lstat(lockPath), { code: 'ENOENT' });
    assert.equal(api.records.size, concurrency - 1);
    assert.equal(api.calls.filter(call => call.method === 'POST' && call.body?.data).length, concurrency);
    const saved = JSON.parse(await readFile(options.checkpoint, 'utf8'));
    assert.equal(saved.completedLine, 0);
    assert.deepEqual(saved.counts, { created: 0, published: 0, preserved: 0, preservedEdited: 0, uncertain: 0, planned: 0 });
    assert.deepEqual(Object.keys(saved.pending).sort(), sources.slice(0, concurrency).map(source => `pages:${source.sourceId}`).sort());
    assert.equal(saved.pending['pages:drain-0'].stage, 'creating');
    for (const source of sources.slice(1, concurrency)) {
      assert.equal(saved.pending[`pages:${source.sourceId}`].stage, 'complete');
      assert.deepEqual(saved.pending[`pages:${source.sourceId}`].counts, { created: 1, published: 1, preserved: 0, preservedEdited: 0, uncertain: 0, planned: 0 });
    }

    failingRun = false;
    const resumed = await runImport({ ...options, execute: true, publishBaseline: true, fetchImpl: api.fetchImpl, concurrency, batchSize: concurrency * 2 });
    assert.deepEqual(resumed.counts, { created: total, published: total, preserved: 0, preservedEdited: 0, uncertain: 0, planned: 0 });
    assert.equal(resumed.remaining, 0); assert.equal(resumed.needsReview, false);
    assert.equal(api.records.size, total);
    assert.equal(new Set([...api.records.values()].map(row => row.data.source_id)).size, total);
    for (const [position, source] of sources.entries()) {
      const creates = api.calls.filter(call => call.method === 'POST' && call.body?.data?.source_id === source.sourceId);
      assert.equal(creates.length, position === 0 ? 2 : 1, source.sourceId);
      const stored = [...api.records.values()].find(row => row.data.source_id === source.sourceId);
      assert.equal(stored.status, 'published'); assert.equal(stored.version, 2);
    }
    assert.equal(api.calls.filter(call => call.method === 'POST' && call.url.pathname.endsWith('/publish')).length, total);
    const final = JSON.parse(await readFile(options.checkpoint, 'utf8'));
    assert.equal(final.completedLine, total); assert.deepEqual(final.pending, {}); assert.deepEqual(final.counts, resumed.counts);
    await assert.rejects(lstat(lockPath), { code: 'ENOENT' });
  } finally {
    for (const gate of gates) gate.resolve();
    await outcome;
  }
});

test('a requested pause completes one batch, releases the lock and resumes without duplicate writes', async t => {
  const options = await fixture(t, [record('one'), record('two'), record('three'), record('four'), record('five')]);
  const api = mockApi(); let boundaries = 0;
  const paused = await runImport({ ...options, execute: true, publishBaseline: true, fetchImpl: api.fetchImpl, concurrency: 4, batchSize: 2, shouldPause: () => ++boundaries === 2 });
  assert.equal(boundaries, 2); assert.equal(paused.paused, true);
  assert.equal(paused.counts.published, 2); assert.equal(paused.completedLine, 2); assert.equal(paused.remaining, 3);
  const saved = JSON.parse(await readFile(options.checkpoint, 'utf8'));
  assert.deepEqual(saved.pending, {}); assert.equal(saved.counts.published, 2);
  await assert.rejects(lstat(path.join(path.dirname(options.checkpoint), 'import.lock')), { code: 'ENOENT' });
  const resumed = await runImport({ ...options, execute: true, publishBaseline: true, fetchImpl: api.fetchImpl, concurrency: 8, batchSize: 2 });
  assert.equal(resumed.paused, undefined); assert.equal(resumed.remaining, 0); assert.equal(resumed.counts.published, 5);
  for (const sourceId of ['one', 'two', 'three', 'four', 'five']) assert.equal(api.calls.filter(call => call.method === 'POST' && call.body?.data?.source_id === sourceId).length, 1);
});

test('pausing before a resumed batch preserves pending successes and reports the actual unfinished records', async t => {
  const options = await fixture(t, [record('one'), record('two'), record('three')]); let fail = true;
  const api = mockApi([], ({ method, body }) => { if (fail && method === 'POST' && body?.data?.source_id === 'two') return response({}, 503); });
  await assert.rejects(runImport({ ...options, execute: true, fetchImpl: api.fetchImpl, concurrency: 1, maxAttempts: 1 }));
  const before = JSON.parse(await readFile(options.checkpoint, 'utf8'));
  const writes = api.calls.filter(call => call.method === 'POST').length;
  const paused = await runImport({ ...options, execute: true, fetchImpl: api.fetchImpl, shouldPause: async () => true });
  assert.equal(paused.paused, true); assert.equal(paused.remaining, 2);
  assert.deepEqual(JSON.parse(await readFile(options.checkpoint, 'utf8')), before);
  assert.equal(api.calls.filter(call => call.method === 'POST').length, writes);
  fail = false;
  const resumed = await runImport({ ...options, execute: true, fetchImpl: api.fetchImpl });
  assert.equal(resumed.counts.created, 3); assert.equal(resumed.remaining, 0);
  assert.equal(api.calls.filter(call => call.method === 'POST' && call.body?.data?.source_id === 'one').length, 1);
});

test('CLI keeps credentials in environment and requires explicit execution for baseline publication', async t => {
  assert.deepEqual(parseArguments([], { EMDASH_URL: origin, EMDASH_ADMIN_TOKEN: token }), { origin, token });
  assert.throws(() => parseArguments(['--token', token], {}), { code: 'UNKNOWN_ARGUMENT' });
  const options = await fixture(t, [record()]);
  await assert.rejects(runImport({ ...options, publishBaseline: true }), { code: 'PUBLISH_REQUIRES_EXECUTE' });
});
