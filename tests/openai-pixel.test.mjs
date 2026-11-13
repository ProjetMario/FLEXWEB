import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const component = readFileSync(new URL('../src/components/seo/OpenAIPixel.astro', import.meta.url), 'utf8');
const script = component.match(/<script is:inline>([\s\S]*)<\/script>/)[1];
function load(pathname, consent, advertising) {
  const storage = new Map([['flex-web-cookie-consent', consent], ['flex-web-openai-consent', advertising]]);
  const scripts = [], listeners = new Map();
  const context = {
    location: {pathname}, localStorage: {getItem: key => storage.get(key)},
    document: {createElement: () => ({}), head: {append: value => scripts.push(value)}},
    window: {addEventListener: (name, callback) => listeners.set(name, callback)},
  };
  vm.runInNewContext(script, context);
  return {context, storage, scripts, update: () => listeners.get('flexweb-consent-change')?.()};
}

test('old analytics consent, refusal and private routes never load the advertising SDK', () => {
  for (const [path, consent, advertising] of [
    ['/demarrer/', 'accepted', null], ['/demarrer/', 'accepted', 'refused'],
    ['/demarrer/', 'refused', 'accepted'], ['/demarrer/', null, null],
    ['/espace-projet/', 'accepted', 'accepted'], ['/', 'accepted', 'accepted'],
  ]) assert.equal(load(path, consent, advertising).scripts.length, 0);
});

test('form consent loads once, queues initialization, and withdrawal disables measurement', () => {
  const state = load('/demarrer/', null, null);
  state.storage.set('flex-web-cookie-consent', 'accepted');
  state.storage.set('flex-web-openai-consent', 'accepted');
  state.update();
  assert.equal(state.scripts.length, 1);
  assert.equal(state.scripts[0].src, 'https://bzrcdn.openai.com/sdk/oaiq.min.js');
  const calls = () => Array.from(state.context.window.oaiq.q, args => Array.from(args));
  assert.equal(calls().filter(call => call[0] === 'init').length, 1);
  assert.equal(calls()[1][1].pixelId, '81CNK3kYSfq7irfRADpKNh');
  state.storage.set('flex-web-openai-consent', 'refused');
  state.update();
  assert.deepEqual(calls().at(-1), ['consent', false]);
  state.storage.set('flex-web-openai-consent', 'accepted');
  state.update();
  assert.equal(state.scripts.length, 1);
  assert.equal(calls().filter(call => call[0] === 'init').length, 1);
});
