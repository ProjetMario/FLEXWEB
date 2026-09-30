import { createHash } from 'node:crypto';
import { canonical, hash, validateEntries } from './contracts.mjs';

export const MAX_CHUNK_BYTES = 4 * 1024 * 1024;
const chunkKey = (id) => `flexweb/release-chunks/${id}.json`;
const manifestKey = (id) => `flexweb/release-manifests/${id}.json`;
const byteLength = (value) => new TextEncoder().encode(value).byteLength;

export async function createChunk(bucket, id, entries) {
  if (!/^[a-f0-9]{64}$/.test(id) || !Array.isArray(entries) || !entries.length || entries.length > 50000) throw new Error('INVALID_CHUNK');
  validateEntries(entries);
  const body = canonical(entries);
  const bytes = byteLength(body);
  if (bytes > MAX_CHUNK_BYTES) throw new Error('BODY_TOO_LARGE');
  if (hash(entries) !== id) throw new Error('INVALID_CHUNK_HASH');
  const created = Boolean(await bucket.put(chunkKey(id), body, { onlyIf: { etagDoesNotMatch: '*' }, httpMetadata: { contentType: 'application/json' } }));
  return { hash: id, count: entries.length, bytes, created };
}

function validateManifest(value) {
  if (!value || value.schemaVersion !== 1 || !/^[a-f0-9]{64}$/.test(value.id || '') || !/^[a-f0-9]{40}$/.test(value.sourceCommit || '') || !/^[a-f0-9]{64}$/.test(value.baseManifestHash || '') || !/^[a-f0-9]{64}$/.test(value.pricingFingerprint || '') || !Number.isFinite(Date.parse(value.createdAt))) throw new Error('INVALID_MANIFEST');
  if (!Array.isArray(value.entryShards) || !value.entryShards.length || value.entryShards.length > 1000 || !Number.isInteger(value.entryCount) || value.entryCount < 1 || value.entryCount > 50000) throw new Error('INVALID_SHARDS');
  for (const shard of value.entryShards) if (!/^[a-f0-9]{64}$/.test(shard.hash || '') || !Number.isInteger(shard.count) || shard.count < 1 || !Number.isInteger(shard.bytes) || shard.bytes < 2 || shard.bytes > MAX_CHUNK_BYTES) throw new Error('INVALID_SHARD');
  if (value.entryShards.reduce((total, shard) => total + shard.count, 0) !== value.entryCount) throw new Error('INVALID_SHARD_COUNT');
  if (value.entryShards.reduce((total, shard) => total + shard.bytes, 0) > 2 * 1024 * 1024 * 1024) throw new Error('BODY_TOO_LARGE');
  return { schemaVersion: 1, id: value.id, createdAt: value.createdAt, sourceCommit: value.sourceCommit, pricingFingerprint: value.pricingFingerprint, baseManifestHash: value.baseManifestHash, entryShards: value.entryShards, entryCount: value.entryCount };
}

async function readChunk(bucket, shard) {
  const stored = await bucket.get(chunkKey(shard.hash));
  if (!stored || stored.size > MAX_CHUNK_BYTES) throw new Error('REQUIRED_CHUNK_MISSING');
  const body = await stored.text();
  if (byteLength(body) !== shard.bytes || createHash('sha256').update(body).digest('hex') !== shard.hash) throw new Error('INVALID_STORED_CHUNK');
  const entries = JSON.parse(body);
  if (!Array.isArray(entries) || entries.length !== shard.count) throw new Error('INVALID_STORED_CHUNK');
  return { body, entries };
}

// Canonical root keys are sorted exactly as canonical() does for a full snapshot.
function rootParts(manifest, includeIdentity) {
  const metadata = { schemaVersion: 1, sourceCommit: manifest.sourceCommit, pricingFingerprint: manifest.pricingFingerprint, baseManifestHash: manifest.baseManifestHash, ...(includeIdentity ? { id: manifest.id, createdAt: manifest.createdAt } : {}) };
  const before = [], after = [];
  for (const key of Object.keys(metadata).sort()) (key < 'entries' ? before : after).push(`${JSON.stringify(key)}:${canonical(metadata[key])}`);
  return { prefix: `{${before.length ? before.join(',') + ',' : ''}"entries":[`, suffix: `]${after.length ? ',' + after.join(',') : ''}}` };
}

export async function createShardedArchive(bucket, input) {
  const value = validateManifest(input);
  let stored = await bucket.get(manifestKey(value.id));
  let created = false;
  if (!stored) {
    const parts = rootParts(value, false);
    const digest = createHash('sha256').update(parts.prefix);
    const seen = new Set();
    let first = true;
    for (const shard of value.entryShards) {
      const { body, entries } = await readChunk(bucket, shard);
      validateEntries(entries, seen);
      if (!first) digest.update(',');
      digest.update(body.slice(1, -1));
      first = false;
    }
    if (digest.update(parts.suffix).digest('hex') !== value.id) throw new Error('INVALID_SNAPSHOT_ID');
    created = Boolean(await bucket.put(manifestKey(value.id), canonical(value), { onlyIf: { etagDoesNotMatch: '*' }, httpMetadata: { contentType: 'application/json' } }));
    stored = await bucket.get(manifestKey(value.id));
  }
  if (!stored) throw new Error('ARCHIVE_WRITE_UNCONFIRMED');
  const confirmed = await stored.json();
  await bucket.put(`flexweb/release-status/${value.id}.json`, JSON.stringify({ id: value.id, state: 'draft', updatedAt: confirmed.createdAt }), { onlyIf: { etagDoesNotMatch: '*' } });
  return { manifest: confirmed, created };
}

export async function getShardedArchive(bucket, id) {
  const object = await bucket.get(manifestKey(id));
  return object ? object.json() : null;
}

export function streamSnapshot(bucket, manifest) {
  const parts = rootParts(manifest, true);
  const encoder = new TextEncoder();
  let index = -1;
  return new ReadableStream({
    async pull(controller) {
      if (index === -1) { controller.enqueue(encoder.encode(parts.prefix)); index++; return; }
      if (index < manifest.entryShards.length) {
        const { body } = await readChunk(bucket, manifest.entryShards[index]);
        controller.enqueue(encoder.encode((index ? ',' : '') + body.slice(1, -1)));
        index++;
        return;
      }
      controller.enqueue(encoder.encode(parts.suffix)); controller.close();
    }
  });
}
