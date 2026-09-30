import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, mkdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ORIGINAL_SHA256, PATCHED_SHA256, REGISTRY_FILE, VERSION, sha256, patchRuntimeSource, originalSourceFromPatched, applyRuntimePatch } from '../scripts/apply-emdash-lock-patch.mjs';

const installed = await readFile(new URL('../node_modules/emdash/' + REGISTRY_FILE, import.meta.url), 'utf8');
const original = sha256(installed) === ORIGINAL_SHA256 ? installed : originalSourceFromPatched(installed);

test('patch is version/hash pinned, reversible and idempotent; modified dependencies fail closed', () => {
  const result = patchRuntimeSource(original, VERSION);
  assert.equal(result.applied, true); assert.equal(sha256(result.source), PATCHED_SHA256);
  assert.equal(originalSourceFromPatched(result.source), original);
  assert.deepEqual(patchRuntimeSource(result.source, VERSION), { source: result.source, applied: false });
  assert.throws(() => patchRuntimeSource(original, '1.0.2'), /VERSION_MISMATCH/);
  assert.throws(() => patchRuntimeSource(original + '\n', VERSION), /HASH_MISMATCH/);
  assert.throws(() => patchRuntimeSource(result.source + '\n', VERSION), /HASH_MISMATCH/);
});

test('patch writes only the pinned registry atomically and leaves unknown bytes untouched', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'flexweb-runtime-patch-'));
  try {
    await mkdir(path.join(root, 'node_modules/emdash/dist'), { recursive: true });
    await mkdir(path.join(root, 'src/runtime'), { recursive: true });
    await writeFile(path.join(root, 'src/runtime/request-owned-lock.mjs'), 'export {};');
    await writeFile(path.join(root, 'node_modules/emdash/package.json'), JSON.stringify({ version: VERSION }));
    const file = path.join(root, 'node_modules/emdash', REGISTRY_FILE);
    await writeFile(file, original);
    assert.equal((await applyRuntimePatch(root)).applied, true);
    assert.equal((await applyRuntimePatch(root)).applied, false);
    const altered = (await readFile(file, 'utf8')) + '\n// unexpected change';
    await writeFile(file, altered);
    await assert.rejects(applyRuntimePatch(root), /HASH_MISMATCH/);
    assert.equal(await readFile(file, 'utf8'), altered);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('legacy media refresh marks stale only on lock timeout and preserves the original failure', async () => {
  const patched = patchRuntimeSource(original, VERSION).source;
  const start = patched.indexOf('async function refreshContentMediaUsageAfterWrite(');
  const end = patched.indexOf('\nasync function findNonTranslatableSiblingContentIds(', start);
  const body = patched.slice(start, end);
  const marks = []; let failure;
  const refresh = new Function('refreshContentMediaUsage', 'markContentMediaUsageCollectionStaleSafely', 'console', body + ';return refreshContentMediaUsageAfterWrite;')(
    async () => { if (failure) throw failure; return { success: true }; },
    async (...args) => { marks.push(args); return true; }, { error() {} },
  );
  const db = {};
  await refresh(db, 'pages', 'one'); assert.equal(marks.length, 0);
  failure = Object.assign(new Error('timeout'), { code: 'MEDIA_USAGE_LOCK_WAIT_TIMEOUT' });
  await assert.rejects(refresh(db, 'pages', 'one'), (error) => error === failure);
  assert.deepEqual(marks, [[db, 'pages', 'CONTENT_USAGE_REFRESH_ERROR']]);
  failure = new Error('unrelated');
  await assert.rejects(refresh(db, 'pages', 'one'), (error) => error === failure);
  assert.equal(marks.length, 1);
});

test('legacy media deletion marks stale on acquisition timeout without running the unlocked deletion', async () => {
  const patched = patchRuntimeSource(original, VERSION).source;
  const start = patched.indexOf('async function deleteContentMediaUsage(');
  const end = patched.indexOf('\nasync function deleteContentMediaUsageUnlocked(', start);
  const body = patched.slice(start, end);
  const marks = []; let failure; let deleted = 0;
  const remove = new Function('validateIdentifier', 'withContentUsageCollectionLock', 'withContentUsageLock', 'deleteContentMediaUsageUnlocked', 'markContentMediaUsageCollectionStaleSafely', body + ';return deleteContentMediaUsage;')(
    () => {}, async (_key, fn) => { if (failure) throw failure; return fn(); },
    async (_collection, _id, fn) => fn(), async () => { deleted++; return { success: true }; },
    async (...args) => { marks.push(args); return true; },
  );
  const db = {};
  await remove(db, 'pages', 'one'); assert.equal(deleted, 1); assert.equal(marks.length, 0);
  failure = Object.assign(new Error('timeout'), { code: 'MEDIA_USAGE_LOCK_WAIT_TIMEOUT' });
  await assert.rejects(remove(db, 'pages', 'one'), (error) => error === failure);
  assert.equal(deleted, 1); assert.deepEqual(marks, [[db, 'pages', 'CONTENT_USAGE_DELETE_ERROR']]);
  failure = new Error('unrelated');
  await assert.rejects(remove(db, 'pages', 'one'), (error) => error === failure);
  assert.equal(marks.length, 1); assert.equal(deleted, 1);
});
