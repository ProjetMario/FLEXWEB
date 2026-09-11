import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { trackLead } from '../src/lib/analytics.ts';

afterEach(() => { delete globalThis.window; });
const mockWindow = (consent = 'accepted') => {
  const calls = [];
  globalThis.window = {
    localStorage: { getItem: () => consent },
    location: { origin: 'https://flex-web.fr', pathname: '/demarrer/', search: '?email=private@example.fr', hash: '#cle=secret' },
    gtag: (...args) => calls.push(args),
  };
  return calls;
};

test('no consent, refusal or server render records no conversion', () => {
  assert.equal(trackLead('project_quote', 'site'), false);
  for (const value of [null, 'refused', '']) {
    const calls = mockWindow(value);
    assert.equal(trackLead('project_quote', 'site'), false);
    assert.equal(calls.length, 0);
  }
});

test('accepted consent sends only a fixed service and sanitized URL', () => {
  const calls = mockWindow();
  assert.equal(trackLead('project_quote', 'automation'), true);
  assert.deepEqual(calls, [['event', 'generate_lead', {
    form_id: 'project_quote', service_type: 'automation',
    page_location: 'https://flex-web.fr/demarrer/', transport_type: 'beacon',
  }]]);
  assert.doesNotMatch(JSON.stringify(calls), /private|secret|email/);
});

test('private project pages never generate conversion analytics', () => {
  const calls = mockWindow();
  window.location.pathname = '/espace-projet/';
  assert.equal(trackLead('project_quote', 'site'), false);
  assert.equal(calls.length, 0);
});

test('unexpected values cannot become analytics event data', () => {
  const calls = mockWindow();
  assert.equal(trackLead('private@example.fr', 'site'), false);
  assert.equal(trackLead('project_quote', 'private@example.fr'), false);
  assert.equal(calls.length, 0);
});

test('storage, loader and analytics failures never block a confirmed request', () => {
  mockWindow();
  delete window.gtag;
  assert.equal(trackLead('project_quote', 'application'), false);
  window.gtag = () => { throw new Error('analytics unavailable'); };
  assert.equal(trackLead('project_quote', 'application'), false);
  window.localStorage.getItem = () => { throw new Error('storage unavailable'); };
  assert.equal(trackLead('project_quote', 'application'), false);
});
