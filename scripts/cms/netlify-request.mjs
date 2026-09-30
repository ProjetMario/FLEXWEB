import { setTimeout as wait } from 'node:timers/promises';
import { ReleaseError, requireRelease } from './release-core.mjs';

const MAX_ATTEMPTS = 5;
const MAX_WAIT_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 60000;

function headerDelay(value, reference, secondsAreRelative) {
  if (!value?.trim()) return 0;
  const text = value.trim();
  if (/^\d+(?:\.\d+)?$/.test(text)) {
    const milliseconds = Number(text) * 1000;
    return Number.isFinite(milliseconds) ? Math.max(0, secondsAreRelative ? milliseconds : milliseconds - reference) : 0;
  }
  const timestamp = Date.parse(text);
  return Number.isFinite(timestamp) ? Math.max(0, timestamp - reference) : 0;
}

export function netlifyRetryDelay(headers, now, attempt) {
  // Netlify has returned reset times both as Unix seconds and as UTC strings.
  // The server Date protects against a client clock running ahead of Netlify.
  const serverTime = Date.parse(headers.get('date') || '');
  const reference = Number.isFinite(serverTime) ? Math.min(now, serverTime) : now;
  return Math.ceil(Math.max(
    Math.min(5000 * 2 ** (attempt - 1), 60000),
    headerDelay(headers.get('retry-after'), reference, true),
    headerDelay(headers.get('x-ratelimit-reset'), reference, false),
  ));
}

/** Only explicit HTTP 429 responses to GET may be retried. A mutation or an
 * ambiguous transport failure is always returned to the existing reconciler. */
export async function requestNetlify(method, suffix, {
  token, fetchImpl = fetch, now = Date.now,
  sleep = (milliseconds, signal) => wait(milliseconds, undefined, { signal }),
  onRetry = detail => console.log(JSON.stringify(detail)),
  signal, maxAttempts = MAX_ATTEMPTS, maxWaitMs = MAX_WAIT_MS,
} = {}) {
  requireRelease(/^[A-Z]+$/.test(method) && typeof suffix === 'string' && suffix.startsWith('/') && !suffix.startsWith('//') && !suffix.includes('\\'), 'INVALID_NETLIFY_REQUEST');
  requireRelease(Number.isInteger(maxAttempts) && maxAttempts >= 1 && maxAttempts <= MAX_ATTEMPTS && Number.isFinite(maxWaitMs) && maxWaitMs >= 0 && maxWaitMs <= MAX_WAIT_MS, 'INVALID_NETLIFY_RETRY_LIMIT');
  let waited = 0;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (signal?.aborted) throw new ReleaseError('NETLIFY_REQUEST_ABORTED');
    const requestSignal = signal ? AbortSignal.any([signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]) : AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    let response;
    try {
      response = await fetchImpl(`https://api.netlify.com/api/v1${suffix}`, {
        method, redirect: 'error', credentials: 'omit',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        signal: requestSignal,
      });
    } catch { throw new ReleaseError(signal?.aborted ? 'NETLIFY_REQUEST_ABORTED' : 'NETLIFY_REQUEST_FAILED'); }
    let retryDelay;
    try {
      if (response.ok) {
        try { return response.status === 204 ? {} : await response.json(); }
        catch { throw new ReleaseError(signal?.aborted ? 'NETLIFY_REQUEST_ABORTED' : 'NETLIFY_RESPONSE_INVALID'); }
      }
      if (method !== 'GET' || response.status !== 429 || attempt === maxAttempts) throw new ReleaseError(`NETLIFY_HTTP_${response.status}`);
      retryDelay = netlifyRetryDelay(response.headers, now(), attempt);
      requireRelease(waited + retryDelay <= maxWaitMs, 'NETLIFY_RETRY_BUDGET_EXHAUSTED');
    } finally {
      // Do not read or retain provider error bodies; release the connection
      // before waiting, including when the remaining budget is insufficient.
      await response.body?.cancel().catch(() => {});
    }
    if (signal?.aborted) throw new ReleaseError('NETLIFY_REQUEST_ABORTED');
    onRetry({ method, status: 429, attempt, delayMs: retryDelay });
    const started = now();
    try { await sleep(retryDelay, signal); }
    catch { throw new ReleaseError(signal?.aborted ? 'NETLIFY_REQUEST_ABORTED' : 'NETLIFY_RETRY_WAIT_FAILED'); }
    waited += Math.max(retryDelay, now() - started);
    requireRelease(waited <= maxWaitMs, 'NETLIFY_RETRY_BUDGET_EXHAUSTED');
  }
}
