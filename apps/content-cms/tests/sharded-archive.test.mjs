import test from 'node:test';
import assert from 'node:assert/strict';
import { canonical, hash, snapshotId } from '../src/lib/contracts.mjs';
import { MAX_CHUNK_BYTES, createChunk, createShardedArchive, getShardedArchive, streamSnapshot } from '../src/lib/sharded-archive.mjs';
class Bucket {
  values = new Map(); serial = 0;
  async get(key) { const item = this.values.get(key); return item ? { etag: item.etag, size: Buffer.byteLength(item.body), json: async () => JSON.parse(item.body), text: async () => item.body } : null; }
  async put(key, body, options = {}) { const previous = this.values.get(key); if (options.onlyIf?.etagDoesNotMatch === '*' && previous) return null; const stored = { body, etag: String(++this.serial) }; this.values.set(key, stored); return stored; }
}
const entry = (id, text = 'Exemple') => ({ collection: 'guides', sourceId: id, path: `/guides/${id}/`, title: text, content: [], data: {} });
function snapshot(entries) { const value = { schemaVersion: 1, createdAt: '2026-09-30T08:00:00.000Z', sourceCommit: 'a'.repeat(40), entries, pricingFingerprint: 'b'.repeat(64), baseManifestHash: 'c'.repeat(64) }; return { ...value, id: snapshotId(value) }; }
async function upload(bucket, value, groups) { const entryShards = []; for (const entries of groups) { const result = await createChunk(bucket, hash(entries), entries); entryShards.push({ hash: result.hash, count: result.count, bytes: result.bytes }); } const { entries, ...metadata } = value; return { ...metadata, entryCount: entries.length, entryShards }; }

test('sharded archive streams the standard snapshot and preserves the original hash', async () => {
  const bucket = new Bucket(); const value = snapshot([entry('one'), entry('two')]);
  const request = await upload(bucket, value, value.entries.map(item => [item]));
  const result = await createShardedArchive(bucket, request);
  assert.equal(result.created, true);
  const received = await new Response(streamSnapshot(bucket, await getShardedArchive(bucket, value.id))).json();
  assert.deepEqual(received, value); assert.equal(snapshotId(received), value.id);
  assert.equal((await createShardedArchive(bucket, { ...request, createdAt: '2026-10-01T00:00:00Z' })).manifest.createdAt, value.createdAt);
});

test('missing or altered fragments cannot create an archive', async () => {
  const bucket = new Bucket(); const value = snapshot([entry('one')]);
  const request = await upload(bucket, value, [value.entries]);
  const key = `flexweb/release-chunks/${request.entryShards[0].hash}.json`;
  const original = bucket.values.get(key);
  bucket.values.delete(key); await assert.rejects(createShardedArchive(bucket, request), /REQUIRED_CHUNK_MISSING/);
  bucket.values.set(key, { ...original, body: original.body.replace('Exemple', 'Modifié') });
  await assert.rejects(createShardedArchive(bucket, request), /INVALID_STORED_CHUNK/);
});

test('duplicate identities across chunks and incorrect global hashes fail closed', async () => {
  const bucket = new Bucket(); const value = snapshot([entry('one'), entry('one', 'Second')]);
  const request = await upload(bucket, value, value.entries.map(item => [item]));
  await assert.rejects(createShardedArchive(bucket, request), /DUPLICATE_ENTRY/);
  const correct = snapshot([entry('unique')]); const second = await upload(bucket, correct, [correct.entries]);
  await assert.rejects(createShardedArchive(bucket, { ...second, id: 'f'.repeat(64) }), /INVALID_SNAPSHOT_ID/);
});

test('cumulative snapshots beyond the previous 20 MiB limit work with bounded fragments', async () => {
  const bucket = new Bucket(); const text = 'a'.repeat(3 * 1024 * 1024);
  const value = snapshot(Array.from({ length: 7 }, (_, index) => entry(String(index), text)));
  assert.ok(Buffer.byteLength(canonical(value)) > 20 * 1024 * 1024);
  const request = await upload(bucket, value, value.entries.map(item => [item]));
  assert.ok(request.entryShards.every(item => item.bytes < MAX_CHUNK_BYTES));
  await createShardedArchive(bucket, request);
  const received = await new Response(streamSnapshot(bucket, await getShardedArchive(bucket, value.id))).json();
  assert.equal(received.entries.length, 7); assert.equal(snapshotId(received), value.id);
  await assert.rejects(createChunk(bucket, hash([entry('too-big', 'a'.repeat(MAX_CHUNK_BYTES))]), [entry('too-big', 'a'.repeat(MAX_CHUNK_BYTES))]), /BODY_TOO_LARGE/);
});
