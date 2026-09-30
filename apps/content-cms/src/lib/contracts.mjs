import { createHash, timingSafeEqual } from 'node:crypto';

export const COLLECTIONS = ['pages', 'pages_commerciales', 'realisations', 'guides', 'communes', 'fiches_territoriales'];
export const STATES = ['draft', 'checking', 'review_failed', 'preview_ready', 'deployed'];
export const canonical = (value) => JSON.stringify(sort(value));
function sort(value) {
  if (Array.isArray(value)) return value.map(sort);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sort(value[key])]));
  return value;
}
export const hash = (value) => createHash('sha256').update(canonical(value)).digest('hex');
export function sameSecret(actual, expected) {
  if (typeof expected !== 'string' || expected.length < 32 || typeof actual !== 'string') return false;
  return timingSafeEqual(createHash('sha256').update(actual).digest(), createHash('sha256').update(expected).digest());
}
export function contentPayload(fields) {
  return { title: fields.title || '', seoTitle: fields.seo_title || '', seoDescription: fields.seo_description || '', content: fields.content || [], data: fields.data || {} };
}
export function toEntry(collection, item, fields = item.data) {
  return { collection, sourceId: fields.source_id, path: fields.path || '', ...contentPayload(fields), revision: String(item.version), updatedAt: item.updatedAt, baselineHash: fields.baseline_hash, baseManifestHash: fields.base_manifest_hash };
}
export function snapshotId(snapshot) {
  const { id, createdAt, ...payload } = snapshot;
  return hash(payload);
}
export function validateSnapshot(value) {
  if (!value || value.schemaVersion !== 1 || !/^[a-f0-9]{64}$/.test(value.id || '') || value.id !== snapshotId(value)) throw new Error('INVALID_SNAPSHOT_ID');
  if (!/^[a-f0-9]{40}$/.test(value.sourceCommit || '') || !/^[a-f0-9]{64}$/.test(value.baseManifestHash || '') || !/^[a-f0-9]{64}$/.test(value.pricingFingerprint || '')) throw new Error('INVALID_BASELINE');
  if (!Number.isFinite(Date.parse(value.createdAt)) || !Array.isArray(value.entries) || value.entries.length > 50000) throw new Error('INVALID_SNAPSHOT');
  validateEntries(value.entries);
  return value;
}
export function validateEntries(entries, seen = new Set()) {
  for (const entry of entries) {
    if (!COLLECTIONS.includes(entry.collection) || typeof entry.sourceId !== 'string' || !entry.sourceId || typeof entry.title !== 'string' || !Array.isArray(entry.content) || !entry.data || typeof entry.data !== 'object') throw new Error('INVALID_ENTRY');
    if (entry.path && (!entry.path.startsWith('/') || entry.path.startsWith('//') || /[?#\\]/.test(entry.path))) throw new Error('INVALID_PATH');
    const key = entry.collection + ':' + entry.sourceId;
    if (seen.has(key)) throw new Error('DUPLICATE_ENTRY');
    seen.add(key);
  }
  return entries;
}
export function nextStatus(current, input) {
  const allowed = { draft: ['checking'], checking: ['review_failed', 'preview_ready'], review_failed: ['checking'], preview_ready: ['checking', 'deployed', 'review_failed'], deployed: ['review_failed'] };
  if (!input || !STATES.includes(input.state)) throw new Error('INVALID_STATE');
  const payload = { state: input.state, ...(input.previewUrl ? { previewUrl: input.previewUrl } : {}), ...(input.deployId ? { deployId: input.deployId } : {}), ...(input.errors ? { errors: input.errors } : {}) };
  if (payload.previewUrl && (!/^https:\/\/[a-z0-9-]+(?:--[a-z0-9-]+)?\.netlify\.app\/?/i.test(payload.previewUrl) || new URL(payload.previewUrl).hostname.split('.').length !== 3)) throw new Error('INVALID_PREVIEW_URL');
  if (payload.errors && (!Array.isArray(payload.errors) || payload.errors.length > 30 || payload.errors.some((error) => typeof error !== 'string' || error.length > 2000))) throw new Error('INVALID_ERRORS');
  if (payload.state === 'deployed' && (typeof payload.deployId !== 'string' || !/^[a-zA-Z0-9-]{10,80}$/.test(payload.deployId))) throw new Error('DEPLOY_ID_REQUIRED');
  const priorPayload = { state: current.state, ...(current.previewUrl ? { previewUrl: current.previewUrl } : {}), ...(current.deployId ? { deployId: current.deployId } : {}), ...(current.errors ? { errors: current.errors } : {}) };
  if (canonical(payload) === canonical(priorPayload)) return current;
  if (input.expectedState !== current.state || !allowed[current.state]?.includes(input.state)) throw new Error('STATE_CONFLICT');
  return { id: current.id, ...payload, updatedAt: new Date().toISOString() };
}
export function json(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' } });
}
