import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { JSONParser } from '@streamparser/json';

// The catalogue can contain tens of thousands of cumulative edits. Never turn
// the full archive into one V8 string (whose limit is lower than this bound).
export const MAX_SNAPSHOT_BYTES = 2 * 1024 ** 3;
const metadataKeys = ['schemaVersion', 'id', 'createdAt', 'sourceCommit', 'pricingFingerprint', 'baseManifestHash'];

export function canonicalJSON(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJSON).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJSON(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

export function* snapshotParts(snapshot, { digestOnly = false } = {}) {
  const keys = Object.keys(snapshot).filter(key => !digestOnly || !['id', 'createdAt'].includes(key)).sort();
  yield '{';
  for (let index = 0; index < keys.length; index++) {
    const key = keys[index];
    if (index) yield ',';
    yield `${JSON.stringify(key)}:`;
    if (key === 'entries' && Array.isArray(snapshot.entries)) {
      yield '[';
      for (let entryIndex = 0; entryIndex < snapshot.entries.length; entryIndex++) {
        if (entryIndex) yield ',';
        yield canonicalJSON(snapshot.entries[entryIndex]);
      }
      yield ']';
    } else yield canonicalJSON(snapshot[key]);
  }
  yield '}';
}

export function snapshotDigest(snapshot) {
  const hash = createHash('sha256');
  for (const part of snapshotParts(snapshot, { digestOnly: true })) hash.update(part);
  return hash.digest('hex');
}

export function snapshotByteLength(snapshot) {
  let bytes = 0;
  for (const part of snapshotParts(snapshot)) bytes += Buffer.byteLength(part);
  return bytes;
}

export async function readJSONStream(stream, { metadataOnly = false, maxBytes = MAX_SNAPSHOT_BYTES } = {}) {
  if (!stream) throw new Error('EMPTY_JSON_STREAM');
  let result = metadataOnly ? {} : undefined, bytes = 0;
  const parser = new JSONParser({
    paths: metadataOnly ? metadataKeys.map(key => `$.${key}`) : ['$'],
    keepStack: !metadataOnly,
    stringBufferSize: 64 * 1024,
  });
  parser.onValue = ({ value, key }) => {
    if (metadataOnly) result[key] = value;
    else result = value;
  };
  for await (const chunk of stream) {
    bytes += typeof chunk === 'string' ? Buffer.byteLength(chunk) : chunk.byteLength;
    if (bytes > maxBytes) throw new Error('JSON_STREAM_TOO_LARGE');
    parser.write(chunk);
  }
  if (!parser.isEnded) parser.end();
  if (result === undefined) throw new Error('EMPTY_JSON_STREAM');
  return result;
}

export const readSnapshot = (file, options) => readJSONStream(createReadStream(file), options);

export async function writeSnapshot(file, snapshot) {
  async function* chunks() {
    let bytes = 0;
    for (const part of snapshotParts(snapshot)) {
      bytes += Buffer.byteLength(part);
      if (bytes + 1 > MAX_SNAPSHOT_BYTES) throw new Error('SNAPSHOT_TOO_LARGE');
      yield part;
    }
    yield '\n';
  }
  await pipeline(chunks(), createWriteStream(file, { mode: 0o600 }));
}

export async function fileDigest(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
