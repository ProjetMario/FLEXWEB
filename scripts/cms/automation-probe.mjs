import { ReleaseError, requireRelease } from './release-core.mjs';

const BODY_LIMIT = 4096;
const PUBLIC_ORIGIN = 'https://flex-web.fr';
const METHOD_ERROR = 'Méthode non acceptée.';
const PREVIEW_ERROR = 'Les demandes sont désactivées dans cet aperçu. Utilisez flex-web.fr pour envoyer votre projet.';

/** Probe the deployed function, not the mocked form. The handler rejects GET
 * before reading runtime credentials or forwarding any request to the CRM. */
export async function verifyAutomationProxy(origin, { fetchImpl = fetch } = {}) {
  requireRelease(origin === PUBLIC_ORIGIN || /^https:\/\/[a-z0-9-]+--flex-webb\.netlify\.app$/.test(origin), 'AUTOMATION_PROXY_ORIGIN_REJECTED');
  const expected = origin === PUBLIC_ORIGIN ? { status: 405, error: METHOD_ERROR } : { status: 503, error: PREVIEW_ERROR };
  let response;
  try {
    response = await fetchImpl(`${origin}/api/automation/intake`, {
      method: 'GET', headers: { accept: 'application/json' },
      redirect: 'error', credentials: 'omit', cache: 'no-store',
      signal: AbortSignal.timeout(20000),
    });
  } catch { throw new ReleaseError('AUTOMATION_PROXY_UNAVAILABLE'); }
  let reader;
  try {
    requireRelease(response.status === expected.status, 'AUTOMATION_PROXY_STATUS_INVALID');
    requireRelease(/^application\/json(?:;|$)/i.test(response.headers.get('content-type') || ''), 'AUTOMATION_PROXY_CONTENT_TYPE_INVALID');
    const cache = (response.headers.get('cache-control') || '').toLowerCase().split(',').map(value => value.trim());
    requireRelease(cache.includes('no-store'), 'AUTOMATION_PROXY_CACHE_INVALID');
    reader = response.body?.getReader();
    requireRelease(reader, 'AUTOMATION_PROXY_BODY_MISSING');
    const chunks = []; let bytes = 0;
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      bytes += value.byteLength;
      requireRelease(bytes <= BODY_LIMIT, 'AUTOMATION_PROXY_RESPONSE_TOO_LARGE');
      chunks.push(Buffer.from(value));
    }
    let data;
    try { data = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
    catch { throw new ReleaseError('AUTOMATION_PROXY_RESPONSE_INVALID'); }
    requireRelease(data && !Array.isArray(data) && data.error === expected.error && Object.keys(data).length === 1, 'AUTOMATION_PROXY_RESPONSE_INVALID');
    return { status: expected.status, route: '/api/automation/intake', method: 'GET', noStore: true };
  } catch (error) {
    throw error instanceof ReleaseError ? error : new ReleaseError('AUTOMATION_PROXY_UNAVAILABLE');
  } finally {
    if (reader) { await reader.cancel().catch(() => {}); reader.releaseLock(); }
    else await response.body?.cancel().catch(() => {});
  }
}
