import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { ContentRepository, RevisionRepository } from 'emdash';
import { withEmDashRuntime } from 'emdash/middleware';
import { COLLECTIONS, hash, contentPayload, toEntry, sameSecret, json } from '../../../lib/contracts.mjs';

import { createArchive, updateArchiveStatus, readLimited } from '../../../lib/archive.mjs';
import { MAX_CHUNK_BYTES, createChunk, createShardedArchive, getShardedArchive, streamSnapshot } from '../../../lib/sharded-archive.mjs';

export const prerender = false;
const bindings = () => env as unknown as { MEDIA: R2Bucket; EMDASH_READ_TOKEN?: string; EMDASH_WRITE_TOKEN?: string };

export const ALL: APIRoute = async (context) => {
  const { request, url, params, locals } = context;
  const path = (params.path || '').split('/').filter(Boolean);
  const write = !['GET', 'HEAD'].includes(request.method);
  const settings = bindings();
  if (sameSecret(settings.EMDASH_READ_TOKEN, settings.EMDASH_WRITE_TOKEN)) return json({ error: 'DISTINCT_TOKENS_REQUIRED' }, 503);
  const bearer = request.headers.get('authorization')?.replace(/^Bearer /i, '');
  const machine = sameSecret(bearer, write ? settings.EMDASH_WRITE_TOKEN : settings.EMDASH_READ_TOKEN);
  const admin = locals.user && Number(locals.user.role) >= 50;
  if (!machine && !admin) return json({ error: 'UNAUTHORIZED' }, 401);
  if (write && !machine && (request.headers.get('origin') !== url.origin || request.headers.get('x-emdash-request') !== '1')) return json({ error: 'INVALID_ORIGIN' }, 403);
  try {
    if (path[0] === 'entries' && request.method === 'GET') {
      const collection = url.searchParams.get('collection') || '';
      const mode = url.searchParams.get('mode') || 'published';
      const limit = Number(url.searchParams.get('limit') || 100);
      if (!COLLECTIONS.includes(collection) || !['published', 'candidate'].includes(mode) || !Number.isInteger(limit) || limit < 1 || limit > 100) return json({ error: 'INVALID_QUERY' }, 400);
      return await withEmDashRuntime(async (runtime) => {
        const repository = new ContentRepository(runtime.db);
        const revisions = new RevisionRepository(runtime.db);
        const batch = await repository.findMany(collection, { limit, cursor: url.searchParams.get('cursor') || undefined, orderBy: { field: 'id', direction: 'asc' }, ...(mode === 'published' ? { where: { status: 'published' } } : {}) });
        const entries = [];
        let bytes = 0;
        for (const item of batch.items) {
          let fields = item.data;
          if (mode === 'candidate' && item.draftRevisionId) {
            const draft = await revisions.findById(item.draftRevisionId);
            if (!draft) throw new Error('DRAFT_REVISION_MISSING');
            fields = { ...item.data, ...draft.data };
          }
          if (hash(contentPayload(fields)) !== fields.baseline_hash) {
            const entry = toEntry(collection, item, fields);
            bytes += new TextEncoder().encode(JSON.stringify(entry)).byteLength;
            if (bytes > 16 * 1024 * 1024) return json({ error: 'PAGE_TOO_LARGE', message: 'Retenter le même curseur avec une limite inférieure.', limit }, 413);
            entries.push(entry);
          }
        }
        return json({ entries, nextCursor: batch.nextCursor, scanned: batch.items.length });
      });
    }
    if (path[0] !== 'snapshots') return json({ error: 'NOT_FOUND' }, 404);
    const bucket = settings.MEDIA;
    if (!bucket) return json({ error: 'STORAGE_NOT_CONFIGURED' }, 503);
    const streamed = (manifest: Record<string, unknown>, status = 200) => new Response(streamSnapshot(bucket, manifest), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' } });
    if (path[1] === 'chunks' && path.length === 3 && request.method === 'POST') {
      const result = await createChunk(bucket, path[2], JSON.parse(await readLimited(request, MAX_CHUNK_BYTES)));
      return json(result, result.created ? 201 : 200);
    }
    const id = path[1];
    if (id && !/^[a-f0-9]{64}$/.test(id)) return json({ error: 'INVALID_ID' }, 400);
    const key = `flexweb/releases/${id}.json`;
    const statusKey = `flexweb/release-status/${id}.json`;
    if (!id && request.method === 'GET') {
      const list = await bucket.list({ prefix: 'flexweb/release-status/', limit: 100, cursor: url.searchParams.get('cursor') || undefined });
      const items = await Promise.all(list.objects.map(async (object) => (await bucket.get(object.key))?.json()));
      return json({ items: items.filter(Boolean), nextCursor: list.truncated ? list.cursor : undefined });
    }
    if (!id && request.method === 'POST') {
      const value = JSON.parse(await readLimited(request, 20 * 1024 * 1024));
      if (!/^[a-f0-9]{64}$/.test(value?.id || '')) return json({ error: 'INVALID_ID' }, 400);
      const manifest = await getShardedArchive(bucket, value.id);
      if (manifest) {
        const result = await createShardedArchive(bucket, manifest);
        return json({ id: result.manifest.id, createdAt: result.manifest.createdAt, entryCount: result.manifest.entryCount, archived: true });
      }
      if (value.entryShards) {
        const previous = await bucket.get(`flexweb/releases/${value.id}.json`);
        if (previous) {
          const result = await createArchive(bucket, await previous.json());
          return json(result.snapshot);
        }
        const result = await createShardedArchive(bucket, value);
        return json({ id: result.manifest.id, createdAt: result.manifest.createdAt, entryCount: result.manifest.entryCount, archived: true }, result.created ? 201 : 200);
      }
      const result = await createArchive(bucket, value);
      return json(result.snapshot, result.created ? 201 : 200);
    }
    if (id && path.length === 2 && request.method === 'GET') {
      const manifest = await getShardedArchive(bucket, id);
      if (manifest) return streamed(manifest);
      const snapshot = await bucket.get(key);
      return snapshot ? json(await snapshot.json()) : json({ error: 'NOT_FOUND' }, 404);
    }
    if (id && path[2] === 'status') {
      const stored = await bucket.get(statusKey);
      if (!stored) return json({ error: 'NOT_FOUND' }, 404);
      const current = await stored.json<Record<string, unknown>>();
      if (request.method === 'GET') return json(current);
      if (request.method === 'POST') {
        const result = await updateArchiveStatus(bucket, id, JSON.parse(await readLimited(request, 65536)));
        return result ? json(result) : json({ error: 'NOT_FOUND' }, 404);
      }
    }
    return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
  } catch (error) {
    if (error instanceof SyntaxError) return json({ error: 'INVALID_JSON' }, 400);
    const message = error instanceof Error ? error.message : 'REQUEST_FAILED';
    if (message === 'BODY_TOO_LARGE') return json({ error: message }, 413);
    if (/INVALID|DUPLICATE|REQUIRED/.test(message)) return json({ error: message }, 400);
    if (message === 'STATE_CONFLICT') return json({ error: message }, 409);
    console.error('Flex-Web publication endpoint failed', { code: message });
    return json({ error: 'REQUEST_FAILED' }, 500);
  }
};
