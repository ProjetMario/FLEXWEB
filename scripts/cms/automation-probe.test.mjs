import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyAutomationProxy } from './automation-probe.mjs';

const headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
const body = JSON.stringify({ error: 'Méthode non acceptée.' });
const reply = (changes = {}) => new Response(changes.body ?? body, { status: changes.status ?? 405, headers: { ...headers, ...changes.headers } });

test('production and immutable preview use only a credential-free GET with no payload', async () => {
  for (const origin of ['https://flex-web.fr', 'https://verified-candidate--flex-webb.netlify.app']) {
    const calls = [];
    const result = await verifyAutomationProxy(origin, { fetchImpl: async (url, options) => { calls.push({ url, options }); return reply(); } });
    assert.equal(result.status, 405); assert.equal(calls.length, 1);
    assert.equal(calls[0].url, `${origin}/api/automation/intake`);
    assert.deepEqual(Object.keys(calls[0].options.headers), ['accept']);
    assert.equal(calls[0].options.method, 'GET'); assert.equal(calls[0].options.body, undefined);
    assert.equal(calls[0].options.redirect, 'error'); assert.equal(calls[0].options.credentials, 'omit');
    assert.equal(calls[0].options.cache, 'no-store');
  }
});

for (const status of [200, 301, 404, 500, 503]) test(`HTTP ${status} cannot validate the quote function`, async () => {
  await assert.rejects(() => verifyAutomationProxy('https://flex-web.fr', { fetchImpl: async () => reply({ status }) }), { code: 'AUTOMATION_PROXY_STATUS_INVALID' });
});

test('a static HTML fallback cannot substitute for the JSON handler', async () => {
  await assert.rejects(() => verifyAutomationProxy('https://flex-web.fr', { fetchImpl: async () => reply({ headers: { 'content-type': 'text/html' } }) }), { code: 'AUTOMATION_PROXY_CONTENT_TYPE_INVALID' });
});

test('wrong, malformed or augmented responses fail despite HTTP 405', async () => {
  for (const value of ['not JSON', JSON.stringify({ error: 'preview disabled' }), 'null', '[]', JSON.stringify({ error: 'Méthode non acceptée.', success: true })]) {
    await assert.rejects(() => verifyAutomationProxy('https://flex-web.fr', { fetchImpl: async () => reply({ body: value }) }), { code: 'AUTOMATION_PROXY_RESPONSE_INVALID' });
  }
});

test('cached method errors are rejected', async () => {
  await assert.rejects(() => verifyAutomationProxy('https://flex-web.fr', { fetchImpl: async () => reply({ headers: { 'cache-control': 'public, max-age=60' } }) }), { code: 'AUTOMATION_PROXY_CACHE_INVALID' });
});

test('oversized response stops reading and cancels its stream', async () => {
  let cancelled = false;
  const response = new Response(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('x'.repeat(4097))); }, cancel() { cancelled = true; } }), { status: 405, headers });
  await assert.rejects(() => verifyAutomationProxy('https://flex-web.fr', { fetchImpl: async () => response }), { code: 'AUTOMATION_PROXY_RESPONSE_TOO_LARGE' });
  assert.equal(cancelled, true);
});

test('transport errors are sanitized and not retried', async () => {
  let calls = 0;
  await assert.rejects(() => verifyAutomationProxy('https://flex-web.fr', { fetchImpl: async () => { calls++; throw Error('private diagnostic'); } }), { code: 'AUTOMATION_PROXY_UNAVAILABLE' });
  assert.equal(calls, 1);
});

test('another origin is rejected before any request', async () => {
  let calls = 0;
  for (const origin of ['https://example.com', 'https://flexweb-gestion.netlify.app', 'https://flex-web.fr@evil.example', 'https://flex-web.fr/path']) {
    await assert.rejects(() => verifyAutomationProxy(origin, { fetchImpl: async () => { calls++; return reply(); } }), { code: 'AUTOMATION_PROXY_ORIGIN_REJECTED' });
  }
  assert.equal(calls, 0);
});
