/** Native EmDash import. Dry-run by default; never updates or deletes existing content. */
import { createReadStream } from 'node:fs';
import { mkdir, lstat, open, readFile, rename, unlink, chmod } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { createGunzip } from 'node:zlib';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const COLLECTIONS = ['pages', 'pages_commerciales', 'realisations', 'guides', 'communes', 'fiches_territoriales'];
const MAX_LINE_BYTES = 10 * 1024 * 1024;
const HEX = /^[a-f0-9]{64}$/;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const canonical = value => JSON.stringify(sort(value));
function sort(value) {
  if (Array.isArray(value)) return value.map(sort);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, sort(value[key])]));
  return value;
}
const hash = value => createHash('sha256').update(canonical(value)).digest('hex');
const keyOf = record => `${record.collection}:${record.sourceId}`;
const payloadOf = record => ({ title: record.title, seoTitle: record.seoTitle, seoDescription: record.seoDescription, content: record.content, data: record.data });
const must = (condition, code) => { if (!condition) throw new ImportError(code); };

export class ImportError extends Error {
  constructor(code, status = 0, retryAfter = 0) { super(code); this.name = 'ImportError'; this.code = code; this.status = status; this.retryAfter = retryAfter; }
}

export function normalizeOrigin(value) {
  let url;
  try { url = new URL(value); } catch { throw new ImportError('INVALID_CMS_ORIGIN'); }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  must(url.protocol === 'https:' || (local && url.protocol === 'http:'), 'HTTPS_REQUIRED');
  must(!url.username && !url.password && url.pathname === '/' && !url.search && !url.hash, 'CMS_ORIGIN_ONLY');
  return url.origin;
}

export function validateRecord(record) {
  must(record && typeof record === 'object' && COLLECTIONS.includes(record.collection), 'INVALID_COLLECTION');
  must(typeof record.sourceId === 'string' && record.sourceId.length > 0 && record.sourceId.length <= 500 && !/[\u0000-\u001f]/.test(record.sourceId), 'INVALID_SOURCE_ID');
  must(typeof record.path === 'string' && (record.collection === 'communes' && record.path === '' || /^\/(?:[a-z0-9-]+\/)*$/.test(record.path)), 'INVALID_PUBLIC_PATH');
  for (const field of ['title', 'seoTitle', 'seoDescription']) must(typeof record[field] === 'string', 'INVALID_TEXT_FIELD');
  must(record.title.trim().length > 0 && record.title.length <= 2000, 'INVALID_TITLE');
  must(Array.isArray(record.content) && record.data && typeof record.data === 'object' && !Array.isArray(record.data), 'INVALID_CONTENT');
  for (const field of ['baselineHash', 'sourcePayloadHash', 'baseManifestHash']) must(HEX.test(record[field] || ''), 'INVALID_SOURCE_HASH');
  must(hash(payloadOf(record)) === record.baselineHash, 'BASELINE_HASH_MISMATCH');
  must(typeof record.sourceUpdatedAt === 'string' && /^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(record.sourceUpdatedAt) && Number.isFinite(Date.parse(record.sourceUpdatedAt)), 'INVALID_SOURCE_DATE');
  return record;
}

export function mapRecord(record) {
  validateRecord(record);
  const data = {
    title: record.title, source_id: record.sourceId, path: record.path,
    seo_title: record.seoTitle, seo_description: record.seoDescription,
    content: record.content, data: record.data, baseline_hash: record.baselineHash,
    source_payload_hash: record.sourcePayloadHash, base_manifest_hash: record.baseManifestHash,
    // Native datetime fields are stored as UTC ISO with milliseconds. Compare
    // that canonical form on publication so normalization is not an editor change.
    source_updated_at: new Date(record.sourceUpdatedAt).toISOString(),
  };
  // Optional list filters mirror source metadata; their absence never invents a review.
  const metadata = record.data;
  if (['pages_commerciales', 'communes', 'fiches_territoriales'].includes(record.collection)) {
    const department = metadata.departmentCode ?? metadata.department_code;
    if (typeof department === 'string') data.department_code = department;
  }
  if (record.collection === 'pages_commerciales' && ['site', 'automation', 'application'].includes(metadata.service)) data.service = metadata.service;
  if (['communes', 'fiches_territoriales'].includes(record.collection)) {
    const code = metadata.communeCode ?? metadata.commune_code ?? (record.collection === 'communes' ? record.sourceId : undefined);
    if (typeof code === 'string') data.commune_code = code;
  }
  if (record.collection === 'fiches_territoriales') {
    if (['sites', 'automatisation'].includes(metadata.axis)) data.axis = metadata.axis;
    data.editorial_status = metadata.editorialStatus === 'reviewed' ? 'reviewed' : 'prepared-not-editorially-approved';
  }
  return { data, status: 'draft', locale: 'fr' };
}

async function* inputLines(filename, digest) {
  const file = createReadStream(filename);
  const input = filename.endsWith('.gz') ? file.pipe(createGunzip()) : file;
  file.on('error', error => input.destroy(error));
  if (digest) input.on('data', chunk => digest.update(chunk));
  const lines = createInterface({ input, crlfDelay: Infinity });
  let line = 0;
  try {
    for await (const text of lines) {
      line++;
      must(Buffer.byteLength(text) <= MAX_LINE_BYTES, 'INPUT_LINE_TOO_LARGE');
      if (!text.trim()) continue;
      let record;
      try { record = JSON.parse(text); } catch { throw new ImportError(`INVALID_JSON_LINE_${line}`); }
      yield { line, record: validateRecord(record) };
    }
  } catch (error) { throw error instanceof ImportError ? error : new ImportError('INPUT_READ_FAILED'); }
  finally { lines.close(); input.destroy(); file.destroy(); }
}

export async function scanInput(filename) {
  const stat = await lstat(filename);
  must(stat.isFile() && !stat.isSymbolicLink(), 'INPUT_FILE_REQUIRED');
  const digest = createHash('sha256');
  const identities = new Set(), paths = new Set(), collections = new Set();
  let count = 0, lastLine = 0, baseManifestHash;
  for await (const { line, record } of inputLines(filename, digest)) {
    must(!identities.has(keyOf(record)), 'DUPLICATE_SOURCE_ID'); identities.add(keyOf(record));
    if (record.path) { must(!paths.has(record.path), 'DUPLICATE_PUBLIC_PATH'); paths.add(record.path); }
    if (baseManifestHash) must(record.baseManifestHash === baseManifestHash, 'MIXED_BASE_MANIFESTS');
    baseManifestHash = record.baseManifestHash;
    collections.add(record.collection); count++; lastLine = line;
    must(count <= 40000, 'TOO_MANY_RECORDS');
  }
  must(count > 0, 'EMPTY_INPUT');
  return { count, lastLine, collections: [...collections], inputHash: digest.digest('hex'), baseManifestHash, size: stat.size, mtimeMs: stat.mtimeMs };
}

function retryDelay(error, attempt) { return Math.min(30000, Math.max(error.retryAfter || 0, 500 * 2 ** attempt)); }
const transient = error => error instanceof ImportError && (error.status === 429 || error.status >= 500 || ['NETWORK_UNCERTAIN', 'BODY_RESPONSE_FAILED'].includes(error.code));

export function createApi({ origin, token, fetchImpl = fetch, sleep = pause, maxAttempts = 4 }) {
  origin = normalizeOrigin(origin);
  must(typeof token === 'string' && token.length >= 16 && !/[\r\n]/.test(token), 'CMS_ADMIN_TOKEN_REQUIRED');
  must(Number.isInteger(maxAttempts) && maxAttempts >= 1 && maxAttempts <= 5, 'INVALID_RETRY_LIMIT');
  async function request(method, suffix, body, retry = method === 'GET') {
    for (let attempt = 0; attempt < (retry ? maxAttempts : 1); attempt++) {
      try {
        let response;
        try {
          response = await fetchImpl(`${origin}/_emdash/api${suffix}`, {
            method, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(30000),
            headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          });
        } catch { throw new ImportError('NETWORK_UNCERTAIN'); }
        const wait = response.headers.get('retry-after');
        const waitMs = wait ? (/^\d+$/.test(wait) ? Number(wait) * 1000 : Math.max(0, Date.parse(wait) - Date.now())) : 0;
        if (!response.ok) {
          // Release an unread error body without buffering arbitrary provider text.
          // Cleanup failure must never hide the HTTP status or Retry-After.
          try { await response.body?.cancel(); } catch { /* The original HTTP failure remains authoritative. */ }
          throw new ImportError(`CMS_HTTP_${response.status}`, response.status, Number.isFinite(waitMs) ? waitMs : 0);
        }
        let result;
        try { result = await response.json(); }
        catch (error) {
          // A stream can fail after successful headers and after a POST committed.
          // Preserve that uncertainty; only malformed JSON is a protocol failure.
          throw new ImportError(error instanceof SyntaxError ? 'INVALID_CMS_RESPONSE' : 'BODY_RESPONSE_FAILED', response.status);
        }
        // Never echo arbitrary server messages (they can contain credentials or content).
        must(result?.success === true && result.data && typeof result.data === 'object', 'CMS_OPERATION_REJECTED');
        return result.data;
      } catch (error) {
        if (!retry || !transient(error) || attempt + 1 === maxAttempts) throw error;
        await sleep(retryDelay(error, attempt));
      }
    }
  }
  async function* pages(collection, fieldFilters) {
    const cursors = new Set(); let cursor, count = 0;
    do {
      const params = new URLSearchParams({ limit: '100', locale: 'fr' });
      if (cursor) params.set('cursor', cursor);
      if (fieldFilters) params.set('fieldFilters', JSON.stringify(fieldFilters));
      const result = await request('GET', `/content/${collection}?${params}`);
      must(Array.isArray(result.items) && result.items.length <= 100, 'INVALID_LIST_RESPONSE');
      count += result.items.length;
      must(count <= 50000, 'REMOTE_COLLECTION_TOO_LARGE');
      yield result.items;
      cursor = result.nextCursor;
      if (cursor) { must(typeof cursor === 'string' && !cursors.has(cursor), 'REPEATED_PAGE_CURSOR'); cursors.add(cursor); }
    } while (cursor);
  }
  async function list(collection, fieldFilters) {
    const items = [];
    for await (const page of pages(collection, fieldFilters)) items.push(...page);
    return items;
  }
  return { request, list, pages, sleep, maxAttempts };
}

function emptyCounts() { return { created: 0, published: 0, preserved: 0, preservedEdited: 0, uncertain: 0, planned: 0 }; }
function contribution(fields = {}) { return { ...emptyCounts(), ...fields }; }
function existingIdentity(item, collection) {
  must(item && typeof item.id === 'string' && item.data && typeof item.data.source_id === 'string', 'INVALID_REMOTE_IDENTITY');
  return { id: item.id, collection, sourceId: item.data.source_id, path: item.data.path || '', baselineHash: item.data.baseline_hash, contentHash: hash({ title: item.data.title || '', seoTitle: item.data.seo_title || '', seoDescription: item.data.seo_description || '', content: item.data.content || [], data: item.data.data || {} }) };
}
async function loadRemoteIndex(api, collections) {
  const sources = new Map(), paths = new Map();
  for (const collection of collections) {
    // Keep only identities between pages; native list is limited to the relevant collection.
    for await (const page of api.pages(collection)) for (const raw of page) {
      const item = existingIdentity(raw, collection), key = keyOf(item);
      must(!sources.has(key), 'REMOTE_SOURCE_ID_COLLISION'); sources.set(key, item);
      if (item.path) { must(!paths.has(item.path), 'REMOTE_PUBLIC_PATH_COLLISION'); paths.set(item.path, key); }
    }
  }
  return { sources, paths };
}
function checkCollision(record, index) {
  const key = keyOf(record), existing = index.sources.get(key);
  if (existing) must(existing.path === record.path, 'SOURCE_ID_PATH_COLLISION');
  if (record.path && index.paths.has(record.path)) must(index.paths.get(record.path) === key, 'PUBLIC_PATH_SOURCE_COLLISION');
  return existing;
}

async function privateDirectory(filename) {
  must(path.basename(path.dirname(filename)) === '.cms' && /^import[\w.-]*\.json$/.test(path.basename(filename)), 'PRIVATE_CHECKPOINT_PATH_REQUIRED');
  await mkdir(path.dirname(filename), { recursive: true, mode: 0o700 });
  const directory = await lstat(path.dirname(filename)); must(directory.isDirectory() && !directory.isSymbolicLink(), 'CHECKPOINT_DIRECTORY_UNSAFE');
  await chmod(path.dirname(filename), 0o700);
}
async function atomicCheckpoint(filename, state) {
  const tmp = `${filename}.${randomUUID()}.tmp`;
  const handle = await open(tmp, 'wx', 0o600);
  try { await handle.writeFile(JSON.stringify(state)); await handle.sync(); } finally { await handle.close(); }
  try { await rename(tmp, filename); } catch (error) { await unlink(tmp).catch(() => {}); throw error; }
}
async function assertUnchanged(filename, scan) {
  const stat = await lstat(filename);
  must(stat.isFile() && !stat.isSymbolicLink() && stat.size === scan.size && stat.mtimeMs === scan.mtimeMs, 'INPUT_CHANGED_DURING_IMPORT');
}

export async function runImport({ input = '.cms/import.ndjson', origin, token, execute = false, publishBaseline = false, batchSize = 100, concurrency = 2, checkpoint = '.cms/import-checkpoint.json', fetchImpl = fetch, sleep = pause, maxAttempts = 4, shouldPause } = {}) {
  must(Number.isInteger(batchSize) && batchSize >= 1 && batchSize <= 100, 'INVALID_BATCH_SIZE');
  must(Number.isInteger(concurrency) && concurrency >= 1 && concurrency <= 64, 'INVALID_CONCURRENCY');
  must(shouldPause === undefined || typeof shouldPause === 'function', 'INVALID_PAUSE_CALLBACK');
  must(!publishBaseline || execute, 'PUBLISH_REQUIRES_EXECUTE');
  input = path.resolve(input); checkpoint = path.resolve(checkpoint);
  const scan = await scanInput(input);
  if (!origin && !execute) return { mode: 'dry-run-local', inputRecords: scan.count, inputHash: scan.inputHash, baseManifestHash: scan.baseManifestHash, counts: contribution({ planned: scan.count }), remaining: scan.count };
  const normalizedOrigin = normalizeOrigin(origin), api = createApi({ origin: normalizedOrigin, token, fetchImpl, sleep, maxAttempts });
  const user = await api.request('GET', '/auth/me'); must(Number(user.role) >= 50, 'CMS_ADMIN_REQUIRED');
  let lock, lockPath, state, save = async () => {};
  try {
    if (execute) {
      await privateDirectory(checkpoint);
      lockPath = path.join(path.dirname(checkpoint), 'import.lock');
      try { lock = await open(lockPath, 'wx', 0o600); await lock.writeFile(JSON.stringify({ pid: process.pid })); } catch { throw new ImportError('IMPORT_ALREADY_RUNNING'); }
      try {
        const stat = await lstat(checkpoint); must(stat.isFile() && !stat.isSymbolicLink() && (stat.mode & 0o077) === 0, 'CHECKPOINT_FILE_UNSAFE');
        state = JSON.parse(await readFile(checkpoint, 'utf8'));
      } catch (error) { if (error.code !== 'ENOENT') throw error instanceof ImportError ? error : new ImportError('INVALID_CHECKPOINT'); }
    }
    const identity = { version: 1, origin: normalizedOrigin, inputHash: scan.inputHash, baseManifestHash: scan.baseManifestHash, publishBaseline };
    if (state) {
      for (const [key, value] of Object.entries(identity)) must(state[key] === value, 'CHECKPOINT_INPUT_MISMATCH');
      must(Number.isInteger(state.completedLine) && state.completedLine >= 0 && state.completedLine <= scan.lastLine && state.pending && typeof state.pending === 'object' && !Array.isArray(state.pending) && state.counts && Object.keys(emptyCounts()).every(key => Number.isInteger(state.counts[key]) && state.counts[key] >= 0), 'INVALID_CHECKPOINT');
    } else state = { ...identity, completedLine: 0, counts: emptyCounts(), pending: {} };
    let writes = Promise.resolve();
    if (execute) save = () => { const snapshot = structuredClone(state); writes = writes.then(() => atomicCheckpoint(checkpoint, snapshot)); return writes; };
    const index = await loadRemoteIndex(api, COLLECTIONS);
    // A complete second pass finds any known collisions before creating a single entry.
    for await (const { record } of inputLines(input)) checkCollision(record, index);
    await assertUnchanged(input, scan); await save();

    const complete = async (key, counts) => { state.pending[key] = { stage: 'complete', counts }; await save(); return counts; };
    const findSource = async record => {
      const matches = await api.list(record.collection, { source_id: record.sourceId });
      must(matches.length <= 1, 'REMOTE_SOURCE_ID_COLLISION');
      if (!matches.length) return null;
      const found = existingIdentity(matches[0], record.collection);
      must(found.sourceId === record.sourceId && found.path === record.path, 'SOURCE_ID_PATH_COLLISION');
      return matches[0];
    };
    async function publishOwned(record, pending, created) {
      const key = keyOf(record), suffix = `/content/${record.collection}/${encodeURIComponent(pending.id)}`;
      for (let attempt = 0; attempt < api.maxAttempts; attempt++) {
        // A complete native CREATE response already describes this exact draft.
        // Native publication fences the same _rev atomically against concurrent
        // edits. Resumed drafts and every uncertain retry must reload instead.
        const current = attempt === 0 && created ? created : await api.request('GET', suffix);
        must(current.item?.id === pending.id && current.item?.data?.source_id === record.sourceId && current.item?.data?.path === record.path, 'SOURCE_ID_PATH_COLLISION');
        const expected = mapRecord(record).data;
        const observed = Object.fromEntries(Object.keys(expected).map(field => [field, current.item.data[field]]));
        if (hash(expected) !== hash(observed) || current.item.draftRevisionId) return complete(key, contribution({ created: 1, preservedEdited: 1 }));
        if (current.item.status === 'published') return complete(key, contribution({ created: 1, published: 1 }));
        if (current._rev !== pending.rev || current.item.status !== 'draft') return complete(key, contribution({ created: 1, preservedEdited: 1 }));
        try {
          const published = await api.request('POST', `${suffix}/publish`, { _rev: pending.rev });
          must(published.item?.id === pending.id && published.item?.status === 'published', 'PUBLISH_NOT_CONFIRMED');
          return complete(key, contribution({ created: 1, published: 1 }));
        } catch (error) {
          if (error.status === 409) return complete(key, contribution({ created: 1, preservedEdited: 1 }));
          if (!transient(error) || attempt + 1 === api.maxAttempts) throw error;
          await api.sleep(retryDelay(error, attempt));
          // A retry always reloads state; the original revision is never replaced.
        }
      }
    }
    async function processRecord(record) {
      const key = keyOf(record), pending = state.pending[key];
      if (pending?.stage === 'complete') return pending.counts;
      if (pending?.stage === 'created') return publishBaseline ? publishOwned(record, pending) : complete(key, contribution({ created: 1 }));
      const existing = checkCollision(record, index);
      if (existing) return complete(key, contribution({ preserved: 1, preservedEdited: existing.contentHash !== record.baselineHash ? 1 : 0, uncertain: pending?.stage === 'creating' ? 1 : 0 }));
      if (!execute) return contribution({ planned: 1 });
      state.pending[key] = { stage: 'creating' }; await save();
      const mapped = mapRecord(record);
      let created;
      for (let attempt = 0; attempt < api.maxAttempts; attempt++) {
        try {
          created = await api.request('POST', `/content/${record.collection}`, mapped);
          must(typeof created.item?.id === 'string' && created.item.id.length > 0 && created.item?.data?.source_id === record.sourceId && created.item?.data?.path === record.path && created.item?.status === 'draft' && !created.item.draftRevisionId && typeof created._rev === 'string' && created._rev.length > 0, 'CREATE_NOT_CONFIRMED');
          const observed = Object.fromEntries(Object.keys(mapped.data).map(field => [field, created.item.data[field]]));
          must(hash(mapped.data) === hash(observed), 'CREATE_NOT_CONFIRMED');
          break;
        } catch (error) {
          // An uncertain POST is reconciled by the unique source_id before it can be repeated.
          if (transient(error) || [400, 409].includes(error.status) || error.code === 'CREATE_NOT_CONFIRMED') {
            const found = await findSource(record);
            if (found) return complete(key, contribution({ preserved: 1, uncertain: 1 }));
          }
          if (!transient(error) || attempt + 1 === api.maxAttempts) throw error;
          await api.sleep(retryDelay(error, attempt));
        }
      }
      const owned = { stage: 'created', id: created.item.id, rev: created._rev };
      state.pending[key] = owned; await save();
      return publishBaseline ? publishOwned(record, owned, created) : complete(key, contribution({ created: 1 }));
    }
    async function batch(entries) {
      await assertUnchanged(input, scan);
      const results = []; let next = 0, failure;
      async function worker() {
        while (!failure && next < entries.length) {
          const position = next++;
          try { results[position] = await processRecord(entries[position].record); } catch (error) { failure ||= error; }
        }
      }
      await Promise.all(Array.from({ length: Math.min(concurrency, entries.length) }, worker));
      if (failure) throw failure;
      for (const counts of results) for (const name of Object.keys(state.counts)) state.counts[name] += counts[name];
      state.completedLine = entries.at(-1).line;
      state.pending = {}; await save();
    }
    function result(paused = false) {
      // Each record contributes exactly once to created, preserved or planned;
      // pending successes from a previous interrupted batch are not yet folded
      // into those totals. A paused run leaves that pending state untouched.
      const completed = state.counts.created + state.counts.preserved + state.counts.planned + Object.values(state.pending).filter(entry => entry.stage === 'complete').length;
      const needsReview = state.counts.uncertain > 0 || publishBaseline && state.counts.published < state.counts.created;
      return { mode: execute ? 'execute' : 'dry-run', inputRecords: scan.count, inputHash: scan.inputHash, baseManifestHash: scan.baseManifestHash, counts: state.counts, completedLine: state.completedLine, remaining: Math.max(0, scan.count - completed), needsReview, ...(paused ? { paused: true } : {}) };
    }
    async function pauseAtBoundary() {
      if (!shouldPause || !await shouldPause()) return null;
      await assertUnchanged(input, scan); await save();
      const paused = result(true);
      return paused.remaining > 0 ? paused : null;
    }
    let entries = [];
    for await (const entry of inputLines(input)) {
      if (entry.line <= state.completedLine) continue;
      entries.push(entry);
      if (entries.length === batchSize) {
        const before = await pauseAtBoundary(); if (before) return before;
        await batch(entries); entries = [];
        const after = await pauseAtBoundary(); if (after) return after;
      }
    }
    if (entries.length) {
      const before = await pauseAtBoundary(); if (before) return before;
      await batch(entries);
      const after = await pauseAtBoundary(); if (after) return after;
    }
    await assertUnchanged(input, scan);
    return result();
  } finally { if (lock) { await lock.close(); await unlink(lockPath); } }
}

export function parseArguments(args, env = process.env) {
  const options = { origin: env.EMDASH_URL, token: env.EMDASH_ADMIN_TOKEN };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--execute') options.execute = true;
    else if (arg === '--publish-baseline') options.publishBaseline = true;
    else if (['--input', '--origin', '--checkpoint', '--batch-size', '--concurrency'].includes(arg)) {
      const value = args[++i]; must(value && !value.startsWith('--'), 'MISSING_ARGUMENT');
      const name = { '--input': 'input', '--origin': 'origin', '--checkpoint': 'checkpoint', '--batch-size': 'batchSize', '--concurrency': 'concurrency' }[arg];
      options[name] = ['batchSize', 'concurrency'].includes(name) ? Number(value) : value;
    } else throw new ImportError('UNKNOWN_ARGUMENT');
  }
  return options;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { const result = await runImport(parseArguments(process.argv.slice(2))); console.log(JSON.stringify(result, null, 2)); if (result.needsReview) process.exitCode = 2; }
  catch (error) { console.error(JSON.stringify({ error: error instanceof ImportError ? error.code : 'IMPORT_FAILED' })); process.exitCode = 1; }
}
