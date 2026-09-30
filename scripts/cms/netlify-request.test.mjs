import test from 'node:test';
import assert from 'node:assert/strict';
import { requestNetlify } from './netlify-request.mjs';

const start = Date.parse('2026-09-30T20:12:58Z');
// Date/reset metadata from a successful GET on 2026-09-30. Used here only
// in synthetic 429s: these are not the headers of either failed release.
const observedHeaders = {
  date: 'Wed, 30 Sep 2026 20:32:38 GMT',
  'retry-after': '2026-09-30 20:33:38 UTC',
  'x-ratelimit-reset': '2026-09-30 20:33:38 UTC',
};
const diagnosticKeys = ['method', 'status', 'attempt', 'observedAt', 'serverDate', 'parsedRetryAfterDelayMs', 'parsedResetDelayMs', 'requestedDelayMs', 'remainingWaitBudgetMs'];
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
        return new Response(new ReadableStream({
          start(controller) { if (item.body) controller.enqueue(new TextEncoder().encode(item.body)); },
          cancel() { cleaned.push(item.status); },
        }), { status: item.status, headers: item.headers });
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
  assert.deepEqual(f.events, [{
    method: 'GET', status: 429, attempt: 1, observedAt: '2026-09-30T20:12:58.000Z', serverDate: 'invalid',
    parsedRetryAfterDelayMs: 12000, parsedResetDelayMs: null, requestedDelayMs: 12000, remainingWaitBudgetMs: 300000,
  }]);
  for (const { request } of f.calls) { assert.equal(request.redirect, 'error'); assert.equal(request.credentials, 'omit'); assert.ok(request.signal instanceof AbortSignal); }
});

test('Retry-After HTTP date is honored', async () => {
  const f = fixture([{ status: 429, headers: { 'retry-after': 'Wed, 30 Sep 2026 20:13:58 GMT' } }, { status: 200 }]);
  await requestNetlify('GET', '/sites/example', f.options); assert.deepEqual(f.waits, [60000]);
});

for (const skew of [-600000, 600000]) test(`synthetic 429 with observed UTC dates waits the full 60s with client skew ${skew}ms`, async () => {
  const f = fixture([{ status: 429, headers: observedHeaders }, { status: 200 }]);
  let time = Date.parse(observedHeaders.date) + skew;
  const observedAt = new Date(time).toISOString();
  f.options.now = () => time;
  f.options.sleep = async delay => { f.waits.push(delay); time += delay; };
  await requestNetlify('GET', '/sites/example', f.options); assert.deepEqual(f.waits, [60000]);
  assert.deepEqual(f.events, [{
    method: 'GET', status: 429, attempt: 1, observedAt, serverDate: '2026-09-30T20:32:38.000Z',
    parsedRetryAfterDelayMs: 60000, parsedResetDelayMs: 60000, requestedDelayMs: 60000, remainingWaitBudgetMs: 300000,
  }]);
});

for (const date of [undefined, 'invalid-untrusted-date']) test(`a ${date === undefined ? 'missing' : 'invalid'} server Date uses the client clock`, async () => {
  const headers = { ...observedHeaders };
  if (date === undefined) delete headers.date; else headers.date = date;
  const f = fixture([{ status: 429, headers }, { status: 200 }]);
  let time = Date.parse('2026-09-30T20:32:58Z');
  f.options.now = () => time;
  f.options.sleep = async delay => { f.waits.push(delay); time += delay; };
  await requestNetlify('GET', '/sites/example', f.options);
  assert.deepEqual(f.waits, [40000]);
  assert.equal(f.events[0].serverDate, 'invalid');
  assert.equal(f.events[0].parsedRetryAfterDelayMs, 40000);
  assert.equal(f.events[0].parsedResetDelayMs, 40000);
  assert.ok(!JSON.stringify(f.events).includes('invalid-untrusted-date'));
});

test('the later valid server minimum wins, including Unix seconds for the reset header', async () => {
  const f = fixture([{ status: 429, headers: { 'retry-after': '20', 'x-ratelimit-reset': String((start + 90000) / 1000) } }, { status: 200 }]);
  await requestNetlify('GET', '/sites/example', f.options); assert.deepEqual(f.waits, [90000]);
});

test('a server delay longer than the budget logs safe metadata before refusing and never leaks provider input', async () => {
  const f = fixture([{ status: 429, body: 'sensitive-response-body', headers: {
    'retry-after': '301', 'x-ratelimit-reset': 'sensitive-invalid-reset', date: 'sensitive-invalid-date',
    'x-private': 'sensitive-header', authorization: 'sensitive-provider-token',
  } }], { token: 'sensitive-request-token' });
  await assert.rejects(requestNetlify('GET', '/sites/sensitive-url', f.options), { code: 'NETLIFY_RETRY_BUDGET_EXHAUSTED' });
  assert.equal(f.calls.length, 1); assert.deepEqual(f.waits, []); assert.deepEqual(f.cleaned, [429]);
  assert.equal(f.events.length, 1);
  assert.deepEqual(Object.keys(f.events[0]), diagnosticKeys);
  assert.deepEqual(f.events[0], {
    method: 'GET', status: 429, attempt: 1, observedAt: '2026-09-30T20:12:58.000Z', serverDate: 'invalid',
    parsedRetryAfterDelayMs: 301000, parsedResetDelayMs: null, requestedDelayMs: 301000, remainingWaitBudgetMs: 300000,
  });
  assert.ok(!JSON.stringify(f.events).includes('sensitive-'));
});

test('the cumulative wait budget is enforced across responses', async () => {
  const f = fixture(Array.from({ length: 3 }, () => ({ status: 429, headers: { 'retry-after': '120' } })));
  await assert.rejects(requestNetlify('GET', '/sites/example', f.options), { code: 'NETLIFY_RETRY_BUDGET_EXHAUSTED' });
  assert.deepEqual(f.waits, [120000, 120000]); assert.equal(f.calls.length, 3); assert.equal(f.cleaned.length, 3);
  assert.equal(f.events.length, 3); assert.equal(f.events[2].remainingWaitBudgetMs, 60000);
  assert.equal(f.events[2].requestedDelayMs, 120000);
});

test('missing or invalid headers fall back to bounded backoff and at most five requests', async () => {
  const f = fixture(Array.from({ length: 5 }, () => ({ status: 429, headers: { 'retry-after': 'invalid', 'x-ratelimit-reset': 'invalid' } })));
  await assert.rejects(requestNetlify('GET', '/sites/example', f.options), { code: 'NETLIFY_HTTP_429' });
  assert.deepEqual(f.waits, [5000, 10000, 20000, 40000]); assert.equal(f.calls.length, 5); assert.equal(f.cleaned.length, 5);
  assert.equal(f.events.length, 5); assert.equal(f.events[4].attempt, 5);
  assert.equal(f.events[4].parsedRetryAfterDelayMs, null); assert.equal(f.events[4].parsedResetDelayMs, null);
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
