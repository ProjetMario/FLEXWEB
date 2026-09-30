import test from 'node:test';
import assert from 'node:assert/strict';
import { requestNetlify } from './netlify-request.mjs';

const start = Date.parse('2026-09-30T20:12:58Z');
function fixture(responses, extra = {}) {
  let time = start;
  const calls = [], waits = [], events = [], cleaned = [];
  const options = {
    token: 'fixture-only', now: () => time, onRetry: event => events.push(event),
    sleep: async milliseconds => { waits.push(milliseconds); time += milliseconds; },
    fetchImpl: async (url, request) => {
      calls.push({ url, request });
      const item = responses.shift();
      if (item instanceof Error) throw item;
      if (item.status >= 400) {
        return new Response(new ReadableStream({ cancel() { cleaned.push(item.status); } }), { status: item.status, headers: item.headers });
      }
      return Response.json(item.body ?? { id: 'confirmed' }, { status: item.status ?? 200 });
    }, ...extra,
  };
  return { options, calls, waits, events, cleaned };
}

test('GET retries an explicit 429 then succeeds, closing the body before waiting and logging only safe fields', async () => {
  const f = fixture([{ status: 429, headers: { 'retry-after': '12' } }, { status: 200 }]);
  const sleep = f.options.sleep;
  f.options.sleep = async (milliseconds, signal) => { assert.deepEqual(f.cleaned, [429]); await sleep(milliseconds, signal); };
  assert.deepEqual(await requestNetlify('GET', '/sites/example', f.options), { id: 'confirmed' });
  assert.deepEqual(f.waits, [12000]); assert.equal(f.calls.length, 2);
  assert.deepEqual(f.events, [{ method: 'GET', status: 429, attempt: 1, delayMs: 12000 }]);
  for (const { request } of f.calls) { assert.equal(request.redirect, 'error'); assert.equal(request.credentials, 'omit'); assert.ok(request.signal instanceof AbortSignal); }
});

test('Retry-After HTTP date is honored', async () => {
  const f = fixture([{ status: 429, headers: { 'retry-after': 'Wed, 30 Sep 2026 20:13:58 GMT' } }, { status: 200 }]);
  await requestNetlify('GET', '/sites/example', f.options); assert.deepEqual(f.waits, [60000]);
});

test('observed Netlify UTC strings in both headers are honored even with a fast client clock', async () => {
  const f = fixture([{ status: 429, headers: { date: 'Wed, 30 Sep 2026 20:12:58 GMT', 'retry-after': '2026-09-30 20:13:58 UTC', 'x-ratelimit-reset': '2026-09-30 20:13:58 UTC' } }, { status: 200 }]);
  let time = start + 120000;
  f.options.now = () => time;
  f.options.sleep = async delay => { f.waits.push(delay); time += delay; };
  await requestNetlify('GET', '/sites/example', f.options); assert.deepEqual(f.waits, [60000]);
});

test('the later valid server minimum wins, including Unix seconds for the reset header', async () => {
  const f = fixture([{ status: 429, headers: { 'retry-after': '20', 'x-ratelimit-reset': String((start + 90000) / 1000) } }, { status: 200 }]);
  await requestNetlify('GET', '/sites/example', f.options); assert.deepEqual(f.waits, [90000]);
});

test('a server delay longer than the budget fails rather than retrying early', async () => {
  const f = fixture([{ status: 429, headers: { 'retry-after': '301' } }]);
  await assert.rejects(requestNetlify('GET', '/sites/example', f.options), { code: 'NETLIFY_RETRY_BUDGET_EXHAUSTED' });
  assert.equal(f.calls.length, 1); assert.deepEqual(f.waits, []); assert.deepEqual(f.cleaned, [429]);
});

test('the cumulative wait budget is enforced across responses', async () => {
  const f = fixture(Array.from({ length: 3 }, () => ({ status: 429, headers: { 'retry-after': '120' } })));
  await assert.rejects(requestNetlify('GET', '/sites/example', f.options), { code: 'NETLIFY_RETRY_BUDGET_EXHAUSTED' });
  assert.deepEqual(f.waits, [120000, 120000]); assert.equal(f.calls.length, 3); assert.equal(f.cleaned.length, 3);
});

test('missing or invalid headers fall back to bounded backoff and at most five requests', async () => {
  const f = fixture(Array.from({ length: 5 }, () => ({ status: 429, headers: { 'retry-after': 'invalid', 'x-ratelimit-reset': 'invalid' } })));
  await assert.rejects(requestNetlify('GET', '/sites/example', f.options), { code: 'NETLIFY_HTTP_429' });
  assert.deepEqual(f.waits, [5000, 10000, 20000, 40000]); assert.equal(f.calls.length, 5); assert.equal(f.cleaned.length, 5);
});

for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) test(`${method} 429 is never replayed`, async () => {
  const f = fixture([{ status: 429, headers: { 'retry-after': '1' } }]);
  await assert.rejects(requestNetlify(method, '/sites/example/deploys/known/restore', f.options), { code: 'NETLIFY_HTTP_429' });
  assert.equal(f.calls.length, 1); assert.deepEqual(f.waits, []); assert.deepEqual(f.cleaned, [429]); assert.deepEqual(f.events, []);
});

for (const status of [401, 403, 404, 500]) test(`GET ${status} is not a rate-limit retry`, async () => {
  const f = fixture([{ status }]);
  await assert.rejects(requestNetlify('GET', '/sites/example', f.options), { code: `NETLIFY_HTTP_${status}` });
  assert.equal(f.calls.length, 1); assert.deepEqual(f.waits, []); assert.deepEqual(f.cleaned, [status]);
});

test('ambiguous transport failure is sanitized and never retried, even after a 429 retry', async () => {
  for (const responses of [[Error('sensitive provider diagnostic')], [{ status: 429 }, Error('sensitive provider diagnostic')]]) {
    const expectedCalls = responses.length, f = fixture(responses);
    await assert.rejects(requestNetlify('GET', '/sites/example', f.options), { code: 'NETLIFY_REQUEST_FAILED', message: 'NETLIFY_REQUEST_FAILED' });
    assert.equal(f.calls.length, expectedCalls);
  }
});

test('abort during the wait does not start another request and has already closed the 429 body', async () => {
  const controller = new AbortController(), f = fixture([{ status: 429 }], { signal: controller.signal });
  f.options.sleep = async (_milliseconds, signal) => { assert.equal(signal, controller.signal); assert.deepEqual(f.cleaned, [429]); controller.abort(); throw Error('aborted'); };
  await assert.rejects(requestNetlify('GET', '/sites/example', f.options), { code: 'NETLIFY_REQUEST_ABORTED' });
  assert.equal(f.calls.length, 1);
});

test('an already cancelled request never performs network I/O', async () => {
  const controller = new AbortController(); controller.abort();
  const f = fixture([], { signal: controller.signal });
  await assert.rejects(requestNetlify('GET', '/sites/example', f.options), { code: 'NETLIFY_REQUEST_ABORTED' }); assert.equal(f.calls.length, 0);
});

test('a delayed timer exhausting the remaining budget does not start another request', async () => {
  const f = fixture([{ status: 429 }]); let time = start;
  f.options.now = () => time; f.options.sleep = async () => { time += 300001; };
  await assert.rejects(requestNetlify('GET', '/sites/example', f.options), { code: 'NETLIFY_RETRY_BUDGET_EXHAUSTED' }); assert.equal(f.calls.length, 1);
});
