import { createHash } from 'node:crypto';
import { readFile, writeFile, rename, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const PATCH_ID = 'emdash-1.0.1-media-usage-request-owned-lock-v1';
export const VERSION = '1.0.1';
export const ORIGINAL_SHA256 = 'e5861c77bbcb009856585ec3ad0fa31c6d47853d0ac23472c16f68d44c289058';
export const PATCHED_SHA256 = '5e2e36f850f229cc1666b262fa6a25e18c4b7c8de220618f8b34575c27656785';
export const REGISTRY_FILE = 'dist/registry-CzPJNu3H.mjs';
const PREFIX = '// Flex-Web local runtime patch: ' + PATCH_ID + '\n'
  + 'import { createRequestOwnedLock } from "../../../src/runtime/request-owned-lock.mjs";\n'
  + 'import { t as after } from "./after-PcEvMY_6.mjs";\n';
const OLD_LOCKS = `async function withContentUsageLock(collectionSlug, contentId, fn) {
	const locks = getContentUsageLocks();
	const lockKey = \`\${collectionSlug}\\0\${contentId}\`;
	const previous = locks.get(lockKey) ?? Promise.resolve();
	let releaseCurrent;
	const current = new Promise((resolve) => {
		releaseCurrent = resolve;
	});
	const next = previous.catch(() => {}).then(() => current);
	locks.set(lockKey, next);
	try {
		await previous.catch(() => {});
		return await fn();
	} finally {
		releaseCurrent();
		if (locks.get(lockKey) === next) locks.delete(lockKey);
	}
}
async function withContentUsageCollectionLock(collectionSlug, fn) {
	const locks = getContentUsageCollectionLocks();
	const previous = locks.get(collectionSlug) ?? Promise.resolve();
	let releaseCurrent;
	const current = new Promise((resolve) => {
		releaseCurrent = resolve;
	});
	const next = previous.catch(() => {}).then(() => current);
	locks.set(collectionSlug, next);
	try {
		await previous.catch(() => {});
		return await fn();
	} finally {
		releaseCurrent();
		if (locks.get(collectionSlug) === next) locks.delete(collectionSlug);
	}
}`;
const NEW_LOCKS = `async function withContentUsageLock(collectionSlug, contentId, fn) {
	return createRequestOwnedLock({ owners: getContentUsageLocks() })(
		collectionSlug + "\\0" + contentId, fn, { anchor: (promise) => after(() => promise) }
	);
}
async function withContentUsageCollectionLock(collectionSlug, fn) {
	return createRequestOwnedLock({ owners: getContentUsageCollectionLocks() })(
		collectionSlug, fn, { anchor: (promise) => after(() => promise) }
	);
}`;
const OLD_REFRESH = `async function refreshContentMediaUsageAfterWrite(db, collectionSlug, contentId) {
	const result = await refreshContentMediaUsage(db, collectionSlug, contentId);
	if (!result.success) console.error(\`[media-usage] Usage refresh for \${collectionSlug}/\${contentId} finished with \${result.errorCode}\`);
}`;
const NEW_REFRESH = `async function refreshContentMediaUsageAfterWrite(db, collectionSlug, contentId) {
	try {
		const result = await refreshContentMediaUsage(db, collectionSlug, contentId);
		if (!result.success) console.error(\`[media-usage] Usage refresh for \${collectionSlug}/\${contentId} finished with \${result.errorCode}\`);
	} catch (error) {
		if (error?.code === "MEDIA_USAGE_LOCK_WAIT_TIMEOUT") {
			await markContentMediaUsageCollectionStaleSafely(db, collectionSlug, "CONTENT_USAGE_REFRESH_ERROR");
		}
		throw error;
	}
}`;
const OLD_DELETE = `async function deleteContentMediaUsage(db, collectionSlug, contentId) {
\tvalidateIdentifier(collectionSlug, "collection slug");
\treturn withContentUsageCollectionLock(collectionSlug, () => withContentUsageLock(collectionSlug, contentId, () => deleteContentMediaUsageUnlocked(db, collectionSlug, contentId)));
}`;
const NEW_DELETE = `async function deleteContentMediaUsage(db, collectionSlug, contentId) {
\tvalidateIdentifier(collectionSlug, "collection slug");
\ttry {
\t\treturn await withContentUsageCollectionLock(collectionSlug, () => withContentUsageLock(collectionSlug, contentId, () => deleteContentMediaUsageUnlocked(db, collectionSlug, contentId)));
\t} catch (error) {
\t\tif (error?.code === "MEDIA_USAGE_LOCK_WAIT_TIMEOUT") {
\t\t\tawait markContentMediaUsageCollectionStaleSafely(db, collectionSlug, "CONTENT_USAGE_DELETE_ERROR");
\t\t}
\t\tthrow error;
\t}
}`;
const REPLACEMENTS = [
  [OLD_LOCKS, NEW_LOCKS],
  [OLD_REFRESH, NEW_REFRESH],
  [OLD_DELETE, NEW_DELETE],
  ['Symbol.for("emdash.mediaUsage.contentLocks")', 'Symbol.for("emdash.mediaUsage.contentLocks.requestOwned.v1")'],
  ['Symbol.for("emdash.mediaUsage.collectionLocks")', 'Symbol.for("emdash.mediaUsage.collectionLocks.requestOwned.v1")'],
  // The original source map no longer describes the patched dependency.
  ['//# sourceMappingURL=registry-CzPJNu3H.mjs.map', '// Original dependency source map omitted after local runtime patch.'],
];

export const sha256 = (source) => createHash('sha256').update(source).digest('hex');

function replaceOnce(source, from, to) {
  if (source.split(from).length !== 2) throw new Error('EMDASH_PATCH_CONTEXT_MISMATCH');
  return source.replace(from, to);
}

export function patchedSourceFromOriginal(source) {
  if (sha256(source) !== ORIGINAL_SHA256) throw new Error('EMDASH_PATCH_SOURCE_HASH_MISMATCH');
  let patched = source;
  for (const [from, to] of REPLACEMENTS) patched = replaceOnce(patched, from, to);
  return PREFIX + patched;
}

export function originalSourceFromPatched(source) {
  if (sha256(source) !== PATCHED_SHA256 || !source.startsWith(PREFIX)) throw new Error('EMDASH_PATCH_SOURCE_HASH_MISMATCH');
  let original = source.slice(PREFIX.length);
  for (const [from, to] of [...REPLACEMENTS].reverse()) original = replaceOnce(original, to, from);
  if (sha256(original) !== ORIGINAL_SHA256) throw new Error('EMDASH_PATCH_REVERSE_HASH_MISMATCH');
  return original;
}

export function patchRuntimeSource(source, version) {
  if (version !== VERSION) throw new Error('EMDASH_PATCH_VERSION_MISMATCH');
  if (sha256(source) === PATCHED_SHA256) return { source, applied: false };
  const patched = patchedSourceFromOriginal(source);
  if (sha256(patched) !== PATCHED_SHA256) throw new Error('EMDASH_PATCH_OUTPUT_HASH_MISMATCH');
  return { source: patched, applied: true };
}

export async function applyRuntimePatch(appRoot = fileURLToPath(new URL('../', import.meta.url))) {
  const packageRoot = path.join(appRoot, 'node_modules/emdash');
  const packageJson = JSON.parse(await readFile(path.join(packageRoot, 'package.json'), 'utf8'));
  const target = path.join(packageRoot, REGISTRY_FILE);
  const original = await readFile(target, 'utf8');
  const result = patchRuntimeSource(original, packageJson.version);
  // The relative import must point at the version-controlled app module.
  await stat(path.join(appRoot, 'src/runtime/request-owned-lock.mjs'));
  if (!result.applied) return { patch: PATCH_ID, applied: false, sha256: PATCHED_SHA256 };
  const mode = (await stat(target)).mode & 0o777;
  const temporary = target + '.flexweb-' + process.pid + '.tmp';
  try {
    await writeFile(temporary, result.source, { mode, flag: 'wx' });
    if (sha256(await readFile(target)) !== ORIGINAL_SHA256) throw new Error('EMDASH_PATCH_CONCURRENT_CHANGE');
    await rename(temporary, target);
  } finally {
    await unlink(temporary).catch((error) => { if (error.code !== 'ENOENT') throw error; });
  }
  return { patch: PATCH_ID, applied: true, sha256: PATCHED_SHA256 };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  console.log(JSON.stringify(await applyRuntimePatch()));
}
