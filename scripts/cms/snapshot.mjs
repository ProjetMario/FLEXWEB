import { createHash } from 'node:crypto';
import { readFile, mkdir, rename } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { COLLECTIONS, renderBlockBody } from './content.mjs';
import { canonicalJSON, readJSONStream, readSnapshot, writeSnapshot, snapshotDigest, snapshotByteLength, MAX_SNAPSHOT_BYTES } from './snapshot-io.mjs';

export { canonicalJSON };
export const digest = value => createHash('sha256').update(typeof value === 'string' ? value : canonicalJSON(value)).digest('hex');
export const ARCHIVE_INLINE_LIMIT = 4 * 1024 ** 2;
export const ARCHIVE_CHUNK_LIMIT = 3 * 1024 ** 2;
const identity = entry => `${entry.collection}:${entry.sourceId}`;
const sha = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const requireValue = (value, code) => { if (!value) throw new Error(code); };
const rootFields = new Set(['schemaVersion', 'id', 'createdAt', 'sourceCommit', 'entries', 'pricingFingerprint', 'baseManifestHash']);
const entryFields = new Set(['collection', 'sourceId', 'path', 'title', 'seoTitle', 'seoDescription', 'content', 'data', 'revision', 'updatedAt', 'baselineHash', 'baseManifestHash']);

export async function readManifest(root = process.cwd()) {
  let bytes;
  try { bytes = await readFile(path.join(root, '.cms/manifest.json')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; bytes = gunzipSync(await readFile(path.join(root, 'cms/baseline.json.gz'))); }
  const manifest = JSON.parse(bytes.toString('utf8'));
  requireValue(manifest.schemaVersion === 1 && Array.isArray(manifest.entries) && sha(manifest.pricingFingerprint), 'INVALID_BASELINE');
  requireValue(manifest.hash === digest({ schemaVersion: manifest.schemaVersion, pricingFingerprint: manifest.pricingFingerprint, entries: manifest.entries }), 'BASELINE_HASH_MISMATCH');
  const identifiers = new Set(), paths = new Set();
  for (const entry of manifest.entries) {
    requireValue(COLLECTIONS.includes(entry.collection) && typeof entry.sourceId === 'string' && entry.sourceId && sha(entry.baselineHash), 'INVALID_BASELINE_ENTRY');
    requireValue(!identifiers.has(identity(entry)), 'DUPLICATE_BASELINE_ID'); identifiers.add(identity(entry));
    if (entry.collection === 'communes') requireValue(entry.path === '', 'INVALID_COMMUNE_PATH');
    else {
      requireValue(/^\/(?:[a-z0-9-]+\/)*$/.test(entry.path) && sha(entry.renderHash), 'INVALID_BASELINE_PATH');
      requireValue(!paths.has(entry.path), 'DUPLICATE_BASELINE_PATH'); paths.add(entry.path);
    }
  }
  return manifest;
}

export function validateSnapshot(snapshot, manifest, { sourceCommit } = {}) {
  requireValue(snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot), 'INVALID_SNAPSHOT');
  requireValue(Object.keys(snapshot).every(key => rootFields.has(key)), 'UNKNOWN_SNAPSHOT_FIELD');
  requireValue(snapshot.schemaVersion === 1 && sha(snapshot.id) && /^[a-f0-9]{40}$/.test(snapshot.sourceCommit), 'INVALID_SNAPSHOT_VERSION');
  if (sourceCommit) requireValue(snapshot.sourceCommit === sourceCommit, 'SNAPSHOT_SOURCE_MISMATCH');
  requireValue(typeof snapshot.createdAt === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(snapshot.createdAt) && Number.isFinite(Date.parse(snapshot.createdAt)), 'INVALID_SNAPSHOT_DATE');
  requireValue(snapshotDigest(snapshot) === snapshot.id, 'SNAPSHOT_HASH_MISMATCH');
  requireValue(snapshot.baseManifestHash === manifest.hash && snapshot.pricingFingerprint === manifest.pricingFingerprint, 'SNAPSHOT_BASELINE_OR_PRICES_MISMATCH');
  requireValue(Array.isArray(snapshot.entries) && snapshot.entries.length <= manifest.entries.length, 'INVALID_SNAPSHOT_ENTRIES');
  const known = new Map(manifest.entries.map(entry => [identity(entry), entry]));
  const seen = new Set();
  for (const entry of snapshot.entries) {
    requireValue(entry && typeof entry === 'object' && Object.keys(entry).every(key => entryFields.has(key)), 'UNKNOWN_ENTRY_FIELD');
    const key = identity(entry), baseline = known.get(key);
    requireValue(baseline && !seen.has(key), 'UNKNOWN_OR_DUPLICATE_ENTRY'); seen.add(key);
    requireValue(entry.path === baseline.path && entry.baselineHash === baseline.baselineHash && entry.baseManifestHash === manifest.hash, 'ENTRY_BASELINE_OR_PATH_CHANGED');
    requireValue(typeof entry.title === 'string' && entry.title.trim().length > 0 && entry.title.length <= 1000, 'INVALID_ENTRY_TITLE');
    requireValue(typeof entry.seoTitle === 'string' && entry.seoTitle.length <= 1000 && typeof entry.seoDescription === 'string' && entry.seoDescription.length <= 5000, 'INVALID_ENTRY_SEO');
    requireValue((typeof entry.revision === 'string' && entry.revision.length > 0 && entry.revision.length <= 200) || (Number.isInteger(entry.revision) && entry.revision > 0), 'INVALID_ENTRY_REVISION');
    requireValue(typeof entry.updatedAt === 'string' && Number.isFinite(Date.parse(entry.updatedAt)), 'INVALID_ENTRY_DATE');
    requireValue(entry.data && typeof entry.data === 'object' && !Array.isArray(entry.data), 'INVALID_ENTRY_DATA');
    if (entry.collection !== 'communes') {
      requireValue(entry.data.renderHash === baseline.renderHash, 'SOURCE_RENDER_CHANGED');
      requireValue(Array.isArray(entry.content) && entry.content.length <= 3000, 'INVALID_ENTRY_CONTENT');
      const blockKeys = new Set();
      for (const block of entry.content) {
        requireValue(typeof block._key === 'string' && !blockKeys.has(block._key), 'INVALID_BLOCK_KEY'); blockKeys.add(block._key);
        renderBlockBody(block); // Escaping and link protocol validation shared with the renderer.
      }
    }
    const sections = entry.data.additionalSections ?? [];
    requireValue(Array.isArray(sections) && sections.length <= 12 && sections.every(section => typeof section.title === 'string' && section.title.trim() && section.title.length <= 300 && typeof section.text === 'string' && section.text.trim() && section.text.length <= 10000), 'INVALID_ADDITIONAL_SECTIONS');
  }
  return snapshot;
}

/** Authenticated fixed-origin API adapter. Redirects cannot leak server tokens. */
export function createCMSClient({ origin, readToken, writeToken, fetchImpl = fetch, allowLoopback = false }) {
  const url = new URL(origin);
  requireValue(url.protocol === 'https:' || (allowLoopback && url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)), 'CMS_HTTPS_REQUIRED');
  requireValue(!url.username && !url.password && url.pathname === '/' && !url.search && !url.hash, 'INVALID_CMS_ORIGIN');
  async function request(method, route, body, { missing = false } = {}) {
    requireValue(route.startsWith('/api/flexweb/') && !route.includes('..'), 'INVALID_CMS_ROUTE');
    const token = method === 'GET' ? readToken : writeToken;
    requireValue(typeof token === 'string' && token.trim().length >= 16, 'MISSING_SCOPED_CMS_TOKEN');
    let response;
    const archiveRead = method === 'GET' && /^\/api\/flexweb\/snapshots\/[a-f0-9]{64}$/.test(route);
    try { response = await fetchImpl(new URL(route, url).href, { method, redirect: 'error', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, ...(body === undefined ? {} : { body: canonicalJSON(body) }), signal: AbortSignal.timeout(archiveRead ? 15 * 60000 : 60000) }); }
    catch { throw new Error('CMS_CONNECTION_FAILED'); }
    if (missing && response.status === 404) return null;
    requireValue(response.ok, `CMS_HTTP_${response.status}`);
    try { return await readJSONStream(response.body, { maxBytes: archiveRead ? MAX_SNAPSHOT_BYTES : 25 * 1024 * 1024 }); }
    catch (error) { throw new Error(error.message === 'JSON_STREAM_TOO_LARGE' ? 'CMS_RESPONSE_TOO_LARGE' : 'CMS_INVALID_JSON'); }
  }
  return { request };
}

/** R2 parts are immutable and content-addressed; incomplete uploads cannot be published. */
export async function archiveSnapshot(client, snapshot) {
  const bytes = snapshotByteLength(snapshot);
  requireValue(bytes <= MAX_SNAPSHOT_BYTES, 'SNAPSHOT_TOO_LARGE');
  for (const entry of snapshot.entries) requireValue(Buffer.byteLength(canonicalJSON(entry)) + 2 <= ARCHIVE_CHUNK_LIMIT, 'SNAPSHOT_ENTRY_TOO_LARGE');
  if (bytes <= ARCHIVE_INLINE_LIMIT) return client.request('POST', '/api/flexweb/snapshots', snapshot);
  const entryShards = [];
  let entries = [], size = 2;
  async function upload() {
    if (!entries.length) return;
    requireValue(entryShards.length < 1000, 'SNAPSHOT_TOO_MANY_CHUNKS');
    const hash = digest(entries), count = entries.length;
    const response = await client.request('POST', `/api/flexweb/snapshots/chunks/${hash}`, entries);
    requireValue(response?.hash === hash && response.count === count && response.bytes === size, 'ARCHIVE_CHUNK_UNCONFIRMED');
    entryShards.push({ hash, count, bytes: size });
    entries = []; size = 2;
  }
  for (const entry of snapshot.entries) {
    const entryBytes = Buffer.byteLength(canonicalJSON(entry));
    if (size + (entries.length ? 1 : 0) + entryBytes > ARCHIVE_CHUNK_LIMIT) await upload();
    size += (entries.length ? 1 : 0) + entryBytes;
    entries.push(entry);
  }
  await upload();
  const { entries: omitted, ...metadata } = snapshot;
  return client.request('POST', '/api/flexweb/snapshots', { ...metadata, entryShards, entryCount: snapshot.entries.length });
}

export async function pullSnapshot({ client, manifest, sourceCommit, mode = 'published', now = () => new Date().toISOString() }) {
  requireValue(/^[a-f0-9]{40}$/.test(sourceCommit) && ['candidate', 'published'].includes(mode), 'INVALID_PULL_INPUT');
  const entries = [], identifiers = new Set();
  for (const collection of COLLECTIONS) {
    let cursor, limit = 100; const cursors = new Set(); let pages = 0, scanned = 0;
    do {
      let page;
      for (;;) {
        const params = new URLSearchParams({ collection, mode, limit: String(limit) }); if (cursor) params.set('cursor', cursor);
        try { page = await client.request('GET', `/api/flexweb/entries?${params}`); break; }
        catch (error) {
          // The server rejects the whole page before returning a cursor. Retry
          // that same offset at a smaller size; no content is skipped or cut.
          if (error.message !== 'CMS_HTTP_413') throw error;
          requireValue(limit > 1, 'CMS_ENTRY_TOO_LARGE');
          limit = Math.max(1, Math.floor(limit / 2));
        }
      }
      requireValue(page && Array.isArray(page.entries) && page.entries.length <= limit, 'INVALID_CMS_PAGE');
      requireValue(Number.isInteger(page.scanned) && page.scanned >= page.entries.length && page.scanned <= limit, 'INVALID_CMS_SCANNED_COUNT');
      scanned += page.scanned;
      for (const entry of page.entries) {
        requireValue(entry.collection === collection && !identifiers.has(identity(entry)), 'DUPLICATE_OR_MIXED_CMS_PAGE');
        identifiers.add(identity(entry)); entries.push(entry);
      }
      requireValue(entries.length <= manifest.entries.length && scanned <= manifest.entries.length && ++pages <= manifest.entries.length + 10, 'CMS_PAGINATION_LIMIT');
      cursor = page.nextCursor || null;
      requireValue(!cursor || (typeof cursor === 'string' && cursor.length <= 4000 && !cursors.has(cursor)), 'CMS_REPEATED_CURSOR');
      if (cursor) cursors.add(cursor);
    } while (cursor);
  }
  entries.sort((a, b) => identity(a).localeCompare(identity(b), 'en'));
  const payload = { schemaVersion: 1, sourceCommit, baseManifestHash: manifest.hash, pricingFingerprint: manifest.pricingFingerprint, entries };
  const id = snapshotDigest(payload);
  const proposed = { ...payload, id, createdAt: now() };
  validateSnapshot(proposed, manifest, { sourceCommit });
  let archived = await client.request('GET', `/api/flexweb/snapshots/${id}`, undefined, { missing: true });
  if (!archived) {
    // A collision or lost write response is resolved by reading the immutable key.
    try { await archiveSnapshot(client, proposed); }
    catch (error) {
      try { archived = await client.request('GET', `/api/flexweb/snapshots/${id}`, undefined, { missing: true }); } catch {}
      if (!archived) throw error;
    }
    if (!archived) archived = await client.request('GET', `/api/flexweb/snapshots/${id}`);
  }
  validateSnapshot(archived, manifest, { sourceCommit });
  requireValue(archived.id === id, 'ARCHIVE_CONTENT_MISMATCH');
  // Snapshot and state live in separate R2 objects. Repair an interrupted initial
  // write through the idempotent archive operation, without replacing its bytes.
  let publicationState = await client.request('GET', `/api/flexweb/snapshots/${id}/status`, undefined, { missing: true });
  if (!publicationState) {
    await archiveSnapshot(client, archived);
    publicationState = await client.request('GET', `/api/flexweb/snapshots/${id}/status`);
  }
  requireValue(['draft', 'checking', 'review_failed', 'preview_ready', 'deployed'].includes(publicationState?.state), 'ARCHIVE_STATUS_UNAVAILABLE');
  return archived;
}

export async function reportSnapshot({ client, snapshot, status, report = {}, deployId }) {
  const states = { draft: 'draft', checking: 'checking', blocked: 'review_failed', deployed: 'deployed', rollback: 'review_failed' };
  requireValue(Object.hasOwn(states, status), 'UNKNOWN_PUBLICATION_STATUS');
  const route = `/api/flexweb/snapshots/${snapshot.id}/status`;
  const current = await client.request('GET', route);
  const state = status === 'checking' && report.previewVerified === true ? 'preview_ready' : states[status];
  const body = { state, expectedState: current.state };
  if (deployId) { requireValue(/^[a-z0-9-]+$/.test(deployId), 'INVALID_DEPLOY_ID'); body.deployId = deployId; }
  if (report.previewUrl && (state === 'preview_ready' || state === 'deployed')) {
    requireValue(/^https:\/\/[a-z0-9-]+--flex-webb\.netlify\.app$/.test(report.previewUrl), 'INVALID_PREVIEW_ORIGIN'); body.previewUrl = report.previewUrl;
  }
  if (status === 'blocked' || status === 'rollback') body.errors = [/^[A-Z0-9_]+$/.test(report.errorCode || '') ? report.errorCode : 'PUBLICATION_BLOCKED'];
  // A previously deployed unchanged release need not pass through checking again.
  if (current.state === 'deployed' && status === 'checking') return current;
  if (current.state === 'deployed' && status === 'deployed' && current.deployId === deployId) return current;
  if (current.state === 'checking' && state === 'checking') return current;
  return client.request('POST', route, body);
}

function option(args, name, fallback) { const index = args.indexOf(name); return index < 0 ? fallback : args[index + 1]; }
export async function main(args = process.argv.slice(2), { root = process.cwd(), env = process.env } = {}) {
  const [action] = args;
  const input = option(args, '--input'), output = option(args, '--output');
  const manifest = await readManifest(root);
  const client = () => createCMSClient({ origin: env.EMDASH_URL, readToken: env.EMDASH_READ_TOKEN, writeToken: env.EMDASH_WRITE_TOKEN });
  if (action === 'pull') {
    requireValue(output, 'OUTPUT_REQUIRED');
    const snapshot = await pullSnapshot({ client: client(), manifest, sourceCommit: env.CMS_SOURCE_COMMIT, mode: option(args, '--mode', 'published') });
    await mkdir(path.dirname(output), { recursive: true });
    await writeSnapshot(output, snapshot);
    console.log(JSON.stringify({ id: snapshot.id, entries: snapshot.entries.length, archived: true }));
    return snapshot;
  }
  requireValue(input, 'INPUT_REQUIRED');
  const snapshot = validateSnapshot(await readSnapshot(input), manifest, { sourceCommit: env.CMS_SOURCE_COMMIT });
  if (action === 'validate') { console.log(JSON.stringify({ valid: true, id: snapshot.id, entries: snapshot.entries.length })); return snapshot; }
  if (action === 'apply') {
    const destination = path.join(root, '.cms/snapshot.json');
    await mkdir(path.dirname(destination), { recursive: true });
    const temporary = `${destination}.${process.pid}.tmp`;
    await writeSnapshot(temporary, snapshot);
    await rename(temporary, destination);
    console.log(JSON.stringify({ applied: true, id: snapshot.id })); return snapshot;
  }
  if (action === 'report') {
    let report = {};
    if (env.CMS_PUBLICATION_REPORT_PATH) report = JSON.parse(await readFile(env.CMS_PUBLICATION_REPORT_PATH, 'utf8'));
    const result = await reportSnapshot({ client: client(), snapshot, status: option(args, '--status'), deployId: option(args, '--deploy-id'), report });
    console.log(JSON.stringify({ id: snapshot.id, state: result.state })); return result;
  }
  throw new Error('UNKNOWN_SNAPSHOT_COMMAND');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    // Do not print request URLs, raw provider bodies, tokens or arbitrary content.
    console.error(/^[A-Z0-9_]+$/.test(error.message) ? error.message : 'SNAPSHOT_OPERATION_FAILED');
    process.exitCode = 1;
  });
}
