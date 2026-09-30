import { canonical, validateSnapshot, nextStatus } from './contracts.mjs';
export async function createArchive(bucket, value) {
  const snapshot = validateSnapshot(value);
  const key = `flexweb/releases/${snapshot.id}.json`;
  let stored = await bucket.get(key);
  let created = false;
  if (!stored) {
    created = Boolean(await bucket.put(key, canonical(snapshot), { onlyIf: { etagDoesNotMatch: '*' }, httpMetadata: { contentType: 'application/json' } }));
    stored = await bucket.get(key);
  }
  if (!stored) throw new Error('ARCHIVE_WRITE_UNCONFIRMED');
  const confirmed = await stored.json();
  // A retry repairs a crash between immutable snapshot and mutable status writes.
  await bucket.put(`flexweb/release-status/${snapshot.id}.json`, JSON.stringify({ id: snapshot.id, state: 'draft', updatedAt: confirmed.createdAt }), { onlyIf: { etagDoesNotMatch: '*' } });
  return { snapshot: confirmed, created };
}
export async function updateArchiveStatus(bucket, id, input) {
  const key = `flexweb/release-status/${id}.json`;
  const stored = await bucket.get(key);
  if (!stored) return null;
  const current = await stored.json();
  const result = nextStatus(current, input);
  if (result === current) return current;
  if (!await bucket.put(key, JSON.stringify(result), { onlyIf: { etagMatches: stored.etag } })) throw new Error('STATE_CONFLICT');
  return result;
}
export async function readLimited(request, limit) {
  if (Number(request.headers.get('content-length') || 0) > limit) throw new Error('BODY_TOO_LARGE');
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > limit) { await reader.cancel(); throw new Error('BODY_TOO_LARGE'); }
    chunks.push(value);
  }
  const body = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(body);
}
