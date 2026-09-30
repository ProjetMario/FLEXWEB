/**
 * An isolate-local mutex whose waiters never await another request's Promise.
 * The shared Map contains only owner identities; only that owner may release.
 * There is no TTL reclaim: a stalled owner cannot be replaced while it may write.
 */
export const MEDIA_USAGE_LOCK_WAIT_TIMEOUT = 'MEDIA_USAGE_LOCK_WAIT_TIMEOUT';

export function createRequestOwnedLock({ owners = new Map(), pollMs = 10, waitMs = 10_000 } = {}) {
  if (!Number.isFinite(pollMs) || pollMs <= 0 || !Number.isFinite(waitMs) || waitMs < 0) {
    throw new TypeError('Invalid media usage lock timing');
  }
  return async function withLock(key, fn, { anchor, maxWaitMs = waitMs } = {}) {
    if (!Number.isFinite(maxWaitMs) || maxWaitMs < 0) throw new TypeError('Invalid media usage lock deadline');
    const started = Date.now();
    let waited = false;
    const timeout = () => Object.assign(new Error(MEDIA_USAGE_LOCK_WAIT_TIMEOUT), { code: MEDIA_USAGE_LOCK_WAIT_TIMEOUT });
    while (owners.has(key)) {
      waited = true;
      const remaining = maxWaitMs - (Date.now() - started);
      if (remaining <= 0) throw timeout();
      // The timer and its continuation belong to this invocation.
      await new Promise((resolve) => setTimeout(resolve, Math.min(pollMs, remaining)));
    }
    // A delayed timer must not acquire after its deadline even if the owner
    // happened to release while the waiting invocation was not scheduled.
    if (waited && Date.now() - started >= maxWaitMs) throw timeout();
    const owner = Symbol('media-usage-owner');
    // No await between the check and claim: atomic within the JS isolate.
    owners.set(key, owner);
    const task = Promise.resolve().then(fn).finally(() => {
      if (owners.get(key) === owner) owners.delete(key);
    });
    // EmDash supplies after(() => promise), which uses the host's waitUntil.
    // This Promise stays with the owner and is never stored in shared state.
    anchor?.(task.then(() => undefined, () => undefined));
    return await task;
  };
}
