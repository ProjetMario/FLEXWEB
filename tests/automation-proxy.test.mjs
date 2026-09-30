import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../netlify/functions/automation.ts';
import { verifyAutomationProxy } from '../scripts/cms/automation-probe.mjs';

const canonical = 'https://flex-web.fr';
const previewError = 'Les demandes sont désactivées dans cet aperçu. Utilisez flex-web.fr pour envoyer votre projet.';
const contexts = ['production', 'deploy-preview', 'branch-deploy'];
const context = (deployContext, action = 'intake') => ({ deploy: { context: deployContext }, params: { action }, ip: '127.0.0.1' });

async function withProvider(fn) {
  const previous = { Netlify: globalThis.Netlify, fetch: globalThis.fetch };
  const calls = [], reads = [];
  globalThis.Netlify = { env: { get(key) { reads.push(key); return { AUTOMATION_API_URL: 'https://crm.example.invalid', AUTOMATION_SHARED_SECRET: 'x'.repeat(32) }[key]; } } };
  globalThis.fetch = async (url, options) => { calls.push({ url, options }); return Response.json({ saved: true }, { status: 201 }); };
  try { await fn({ calls, reads }); }
  finally { globalThis.Netlify = previous.Netlify; globalThis.fetch = previous.fetch; }
}

test('every noncanonical request URL blocks before credentials or CRM, even with a forged canonical Origin header', async () => {
  await withProvider(async ({ calls, reads }) => {
    for (const origin of ['https://preview--flex-webb.netlify.app', 'https://flex-webb.netlify.app', 'https://www.flex-web.fr', 'http://flex-web.fr', 'https://flex-web.fr:444', 'https://flex-web.fr.evil.example', 'http://localhost:4321']) {
      for (const deployContext of contexts) {
        const response = await handler(new Request(`${origin}/api/automation/intake`, { method: 'POST', headers: { origin: canonical, 'content-type': 'application/json' }, body: '{}' }), context(deployContext));
        assert.equal(response.status, 503);
        assert.deepEqual(await response.json(), { error: previewError });
        assert.equal(response.headers.get('cache-control'), 'no-store');
      }
    }
    assert.equal(calls.length, 0); assert.equal(reads.length, 0);
  });
});

test('canonical URL forwards through the existing guards even when the promoted deployment retains preview metadata', async () => {
  await withProvider(async ({ calls, reads }) => {
    for (const deployContext of contexts) {
      const response = await handler(new Request(`${canonical}/api/automation/intake`, { method: 'POST', headers: { origin: canonical, 'content-type': 'application/json' }, body: '{"project":"test"}' }), context(deployContext));
      assert.equal(response.status, 201); assert.deepEqual(await response.json(), { saved: true });
    }
    assert.equal(calls.length, 3); assert.equal(reads.length, 6);
    for (const call of calls) {
      assert.equal(call.url, 'https://crm.example.invalid/api/automation/intake');
      assert.equal(call.options.method, 'POST'); assert.equal(call.options.body, '{"project":"test"}');
      assert.equal(call.options.redirect, 'error');
    }
  });
});

test('canonical GET is exactly 405 for any deploy metadata and never reads credentials or forwards', async () => {
  await withProvider(async ({ calls, reads }) => {
    for (const deployContext of contexts) {
      const response = await handler(new Request(`${canonical}/api/automation/intake`), context(deployContext));
      assert.equal(response.status, 405); assert.deepEqual(await response.json(), { error: 'Méthode non acceptée.' });
      assert.equal(response.headers.get('cache-control'), 'no-store');
    }
    assert.equal(calls.length, 0); assert.equal(reads.length, 0);
  });
});

test('immutable preview GET remains exactly blocked even with production metadata', async () => {
  await withProvider(async ({ calls, reads }) => {
    const response = await handler(new Request('https://candidate--flex-webb.netlify.app/api/automation/intake'), context('production'));
    assert.equal(response.status, 503); assert.deepEqual(await response.json(), { error: previewError });
    assert.equal(calls.length, 0); assert.equal(reads.length, 0);
  });
});

test('canonical request URL still enforces CSRF, action and JSON guards before credentials', async () => {
  await withProvider(async ({ calls, reads }) => {
    for (const [headers, action, expected] of [
      [{ 'content-type': 'application/json' }, 'intake', 403],
      [{ origin: 'https://evil.example', 'content-type': 'application/json' }, 'intake', 403],
      [{ origin: canonical, 'content-type': 'text/plain' }, 'intake', 415],
      [{ origin: canonical, 'content-type': 'application/json' }, 'unknown', 404],
    ]) {
      const response = await handler(new Request(`${canonical}/api/automation/${action}`, { method: 'POST', headers, body: '{}' }), context('deploy-preview', action));
      assert.equal(response.status, expected);
    }
    assert.equal(calls.length, 0); assert.equal(reads.length, 0);
  });
});

test('the same handler and preview metadata satisfy the strict release probes before and after canonical promotion', async () => {
  await withProvider(async ({ calls, reads }) => {
    const fetchImpl = (url, options) => handler(new Request(url, options), context('deploy-preview'));
    assert.equal((await verifyAutomationProxy('https://candidate--flex-webb.netlify.app', { fetchImpl })).status, 503);
    assert.equal((await verifyAutomationProxy(canonical, { fetchImpl })).status, 405);
    assert.equal(calls.length, 0); assert.equal(reads.length, 0);
  });
});
