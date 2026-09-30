import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { createHash } from 'node:crypto';
import { canonicalJSON, snapshotParts, snapshotDigest, snapshotByteLength, readJSONStream, readSnapshot, writeSnapshot, fileDigest } from './snapshot-io.mjs';
import { createCMSClient, archiveSnapshot, ARCHIVE_CHUNK_LIMIT } from './snapshot.mjs';
import { createChunk, createShardedArchive, streamSnapshot } from '../../apps/content-cms/src/lib/sharded-archive.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
function value(entries = []) {
  const snapshot = { schemaVersion: 1, sourceCommit: 'a'.repeat(40), createdAt: '2026-09-30T12:00:00.000Z', pricingFingerprint: 'b'.repeat(64), baseManifestHash: 'c'.repeat(64), entries };
  return { ...snapshot, id: snapshotDigest(snapshot) };
}
async function* chunks(parts, size = 65521) {
  for (const part of parts) {
    const buffer = Buffer.from(part);
    for (let offset = 0; offset < buffer.length; offset += size) yield buffer.subarray(offset, offset + size);
  }
}
test('streamed canonical archive is byte-identical and hashes exactly like canonical JSON', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'flexweb-snapshot-io-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const snapshot = value([{ title: 'Savoie — devis', data: { z: 3, a: ['é', '😀'] } }]);
  const { id, createdAt, ...payload } = snapshot;
  assert.equal(snapshotDigest(snapshot), hash(canonicalJSON(payload)));
  assert.equal(snapshotByteLength(snapshot), Buffer.byteLength(canonicalJSON(snapshot)));
  const file = path.join(root, 'snapshot.json'); await writeSnapshot(file, snapshot);
  assert.equal(await readFile(file, 'utf8'), canonicalJSON(snapshot) + '\n');
  assert.equal(await fileDigest(file), hash(canonicalJSON(snapshot) + '\n'));
  assert.deepEqual(await readSnapshot(file), snapshot);
  const { entries, ...metadata } = snapshot;
  assert.deepEqual(await readSnapshot(file, { metadataOnly: true }), metadata);
});

test('JSON parser handles split UTF-8 and rejects truncation, trailing JSON and size overflow', async () => {
  const snapshot = value([{ text: 'Création — Rhône 😀' }]);
  assert.deepEqual(await readJSONStream(chunks(snapshotParts(snapshot), 1)), snapshot);
  await assert.rejects(readJSONStream(Readable.from(['{"entries":['])), /./);
  await assert.rejects(readJSONStream(Readable.from(['{}{}'])), /./);
  await assert.rejects(readJSONStream(Readable.from(['{"a":', '12345}']), { maxBytes: 8 }), /JSON_STREAM_TOO_LARGE/);
});

test('40 MiB cumulative archive uses bounded immutable shards and parses HTTP/file streams above old 25 MiB limit', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'flexweb-snapshot-large-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const snapshot = value(Array.from({ length: 40 }, (_, i) => ({ collection: 'pages', sourceId: `entry-${i}`, path: `/entry-${i}/`, title: `Page ${i}`, content: [], data: { text: 'é'.repeat(512 * 1024) } })));
  const objects = new Map(); let rootPosted, writes = 0, confirmedManifest;
  const bucket = {
    get: async key => objects.has(key) ? { size: Buffer.byteLength(objects.get(key)), text: async () => objects.get(key), json: async () => JSON.parse(objects.get(key)) } : null,
    put: async (key, body, options) => { if (objects.has(key) && options?.onlyIf?.etagDoesNotMatch === '*') return null; objects.set(key, body); return { key }; },
  };
  const client = createCMSClient({ origin: 'https://cms.example.test', readToken: 'read-token-000000000', writeToken: 'write-token-000000000', fetchImpl: async (url, options) => {
    const route = new URL(url).pathname;
    if (route.includes('/chunks/')) {
      writes++;
      const bytes = Buffer.byteLength(options.body), expectedHash = route.split('/').at(-1), entries = JSON.parse(options.body);
      assert.ok(bytes <= ARCHIVE_CHUNK_LIMIT); assert.equal(hash(options.body), expectedHash);
      return Response.json(await createChunk(bucket, expectedHash, entries));
    }
    if (options.method === 'POST') {
      rootPosted = JSON.parse(options.body);
      assert.equal(rootPosted.entryCount, 40); assert.equal(rootPosted.entries, undefined);
      confirmedManifest = (await createShardedArchive(bucket, rootPosted)).manifest;
      assert.equal(confirmedManifest.id, snapshot.id);
      return Response.json({ id: snapshot.id, archived: true, entryCount: confirmedManifest.entryCount });
    }
    return new Response(streamSnapshot(bucket, confirmedManifest));
  } });
  await archiveSnapshot(client, snapshot);
  assert.ok(writes > 1); assert.ok(Buffer.byteLength(canonicalJSON(rootPosted)) < 10000);
  const archived = await client.request('GET', `/api/flexweb/snapshots/${snapshot.id}`);
  assert.equal(snapshotDigest(archived), snapshot.id); assert.equal(archived.entries.length, 40);
  const file = path.join(root, 'snapshot.json'); await writeSnapshot(file, archived);
  const metadata = await readSnapshot(file, { metadataOnly: true });
  assert.equal(metadata.id, snapshot.id); assert.equal(metadata.entries, undefined);
  assert.equal((await readSnapshot(file)).entries.at(-1).sourceId, 'entry-39');
});

test('unconfirmed or interrupted shard uploads never submit a root manifest', async () => {
  const snapshot = value(Array.from({ length: 5 }, () => ({ text: 'x'.repeat(1024 * 1024) })));
  for (const failure of ['wrong-bytes', 'network']) {
    let rootWrites = 0;
    const client = { request: async (_method, route, entries) => {
      if (!route.includes('/chunks/')) { rootWrites++; return {}; }
      if (failure === 'network') throw new Error('CMS_CONNECTION_FAILED');
      return { hash: route.split('/').at(-1), count: entries.length, bytes: 0 };
    } };
    await assert.rejects(archiveSnapshot(client, snapshot), /ARCHIVE_CHUNK_UNCONFIRMED|CMS_CONNECTION_FAILED/);
    assert.equal(rootWrites, 0);
  }
});

test('one oversized content record cannot bypass the fragment ceiling', async () => {
  let writes = 0;
  for (const length of [3.5 * 1024 * 1024, 5 * 1024 * 1024]) {
    const snapshot = value([{ text: 'x'.repeat(length) }]);
    await assert.rejects(archiveSnapshot({ request: async () => { writes++; } }, snapshot), /SNAPSHOT_ENTRY_TOO_LARGE/);
  }
  assert.equal(writes, 0);
});
