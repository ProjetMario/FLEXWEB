import { setTimeout as wait } from 'node:timers/promises';
import { ReleaseError, requireRelease } from './release-core.mjs';

const MAX_ATTEMPTS = 5;
const MAX_WAIT_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 60000;

function headerDelay(value, reference, secondsAreRelative) {
  if (!value?.trim()) return null;
  const text = value.trim();
  if (/^\d+(?:\.\d+)?$/.test(text)) {
    const milliseconds = Number(text) * 1000;
    return Number.isFinite(milliseconds) ? Math.max(0, secondsAreRelative ? milliseconds : milliseconds - reference) : null;
  }
  const timestamp = Date.parse(text);
  return Number.isFinite(timestamp) ? Math.max(0, timestamp - reference) : null;
}

function retryTiming(headers, now, attempt) {
  // Netlify has returned reset times both as Unix seconds and as UTC strings.
  // Wait the full interval stated by the server, independent of client skew.
  const serverTime = Date.parse(headers.get('date') || '');
  const reference = Number.isFinite(serverTime) ? serverTime : now;
  const parsedRetryAfterDelayMs = headerDelay(headers.get('retry-after'), reference, true);
  const parsedResetDelayMs = headerDelay(headers.get('x-ratelimit-reset'), reference, false);
  const requestedDelayMs = Math.ceil(Math.max(
    Math.min(5000 * 2 ** (attempt - 1), 60000),
    parsedRetryAfterDelayMs ?? 0,
    parsedResetDelayMs ?? 0,
  ));
  return {
    observedAt: new Date(now).toISOString(),
    serverDate: Number.isFinite(serverTime) ? new Date(serverTime).toISOString() : 'invalid',
    parsedRetryAfterDelayMs, parsedResetDelayMs, requestedDelayMs,
  };
}

export function netlifyRetryDelay(headers, now, attempt) {
  return retryTiming(headers, now, attempt).requestedDelayMs;
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
      if (method !== 'GET' || response.status !== 429) throw new ReleaseError(`NETLIFY_HTTP_${response.status}`);
      const timing = retryTiming(response.headers, now(), attempt);
      // Emit only normalized timing metadata, including when retry is refused.
      onRetry({ method, status: 429, attempt, ...timing, remainingWaitBudgetMs: Math.max(0, maxWaitMs - waited) });
      if (attempt === maxAttempts) throw new ReleaseError(`NETLIFY_HTTP_${response.status}`);
      retryDelay = timing.requestedDelayMs;
      requireRelease(waited + retryDelay <= maxWaitMs, 'NETLIFY_RETRY_BUDGET_EXHAUSTED');
    } finally {
      // Do not read or retain provider error bodies; release the connection
      // before waiting, including when the remaining budget is insufficient.
      await response.body?.cancel().catch(() => {});
    }
    if (signal?.aborted) throw new ReleaseError('NETLIFY_REQUEST_ABORTED');
    const started = now();
    try { await sleep(retryDelay, signal); }
    catch { throw new ReleaseError(signal?.aborted ? 'NETLIFY_REQUEST_ABORTED' : 'NETLIFY_RETRY_WAIT_FAILED'); }
    waited += Math.max(retryDelay, now() - started);
    requireRelease(waited <= maxWaitMs, 'NETLIFY_RETRY_BUDGET_EXHAUSTED');
  }
}
