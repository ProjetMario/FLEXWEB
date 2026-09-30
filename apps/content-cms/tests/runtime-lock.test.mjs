import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequestOwnedLock, MEDIA_USAGE_LOCK_WAIT_TIMEOUT } from '../src/runtime/request-owned-lock.mjs';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };

test('concurrent work remains exclusive per key while unrelated keys can proceed', async () => {
  const lock = createRequestOwnedLock({ pollMs: 1 });
  let active = 0, maximum = 0;
  const results = await Promise.all(Array.from({ length: 16 }, (_, i) => lock('same', async () => {
    active++; maximum = Math.max(maximum, active);
    await sleep(1); active--; return i;
  })));
  assert.equal(maximum, 1); assert.equal(results.length, 16);
  const owner = deferred(); let entered = false;
  const running = lock('a', () => owner.promise);
  await lock('b', () => { entered = true; });
  assert.equal(entered, true); owner.resolve(); await running;
});

test('a failed owner releases its lock and its anchor does not reject', async () => {
  const lock = createRequestOwnedLock(); const anchors = [];
  await assert.rejects(lock('key', async () => { throw new Error('OWNER_FAILURE'); }, { anchor: (p) => anchors.push(p) }), /OWNER_FAILURE/);
  await Promise.all(anchors); assert.equal(anchors.length, 1);
  assert.equal(await lock('key', () => 'next'), 'next');
});

test('deadline never steals an owner or executes rejected work; normal release permits later work', async () => {
  const owners = new Map(); const lock = createRequestOwnedLock({ owners, pollMs: 1 });
  const owner = deferred(); const running = lock('key', () => owner.promise);
  const identity = owners.get('key'); let called = false;
  await assert.rejects(lock('key', () => { called = true; }, { maxWaitMs: 15 }), { code: MEDIA_USAGE_LOCK_WAIT_TIMEOUT });
  assert.equal(called, false); assert.equal(owners.get('key'), identity);
  assert.equal(typeof identity, 'symbol');
  owner.resolve(); await running;
  assert.equal(await lock('key', () => 'resumed'), 'resumed');
});

test('an irrecoverably stalled owner causes bounded failure without reclaim or a shared Promise', async () => {
  const owners = new Map(); const lock = createRequestOwnedLock({ owners, pollMs: 1 });
  void lock('stalled', () => new Promise(() => {}));
  await assert.rejects(lock('stalled', () => assert.fail('must not run'), { maxWaitMs: 10 }), { code: MEDIA_USAGE_LOCK_WAIT_TIMEOUT });
  assert.equal(typeof owners.get('stalled'), 'symbol');
  assert.equal(await lock('other', () => 'independent'), 'independent');
});

test('a delayed waiter checks its absolute deadline even after the owner was released', async (t) => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 1_000 });
  const owners = new Map([['key', Symbol('owner')]]);
  const lock = createRequestOwnedLock({ owners, pollMs: 10 });
  const waiting = lock('key', () => assert.fail('deadline passed'), { maxWaitMs: 20 });
  t.mock.timers.tick(20); owners.delete('key');
  await assert.rejects(waiting, { code: MEDIA_USAGE_LOCK_WAIT_TIMEOUT });
  assert.equal(owners.size, 0);
});

test('release cannot delete a different owner identity', async () => {
  const owners = new Map(); const lock = createRequestOwnedLock({ owners });
  const owner = deferred(); const running = lock('key', () => owner.promise);
  const other = Symbol('foreign'); owners.set('key', other);
  owner.resolve(); await running;
  assert.equal(owners.get('key'), other);
});

test('timing inputs fail closed', async () => {
  assert.throws(() => createRequestOwnedLock({ pollMs: 0 }), TypeError);
  assert.throws(() => createRequestOwnedLock({ waitMs: Infinity }), TypeError);
  await assert.rejects(createRequestOwnedLock()('key', () => {}, { maxWaitMs: NaN }), TypeError);
});
