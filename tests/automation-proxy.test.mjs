import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../netlify/functions/automation.ts';

test('preview metadata blocks CRM calls even when an environment value says production', async () => {
  const previous = globalThis.Netlify;
  let environmentReads = 0;
  globalThis.Netlify = { env: { get() { environmentReads++; return 'production'; } } };
  try {
    for (const deployContext of ['deploy-preview', 'branch-deploy']) {
      const response = await handler(new Request('https://example.netlify.app/api/automation/intake', { method: 'POST', body: '{}' }), {
        deploy: { context: deployContext }, params: { action: 'intake' },
      });
      assert.equal(response.status, 503);
      assert.match((await response.json()).error, /aperçu/);
    }
    assert.equal(environmentReads, 0, 'no API connection or credential is read');
  } finally { globalThis.Netlify = previous; }
});

test('production metadata reaches normal method validation', async () => {
  const response = await handler(new Request('https://flex-web.fr/api/automation/intake'), {
    deploy: { context: 'production' }, params: { action: 'intake' },
  });
  assert.equal(response.status, 405);
});
