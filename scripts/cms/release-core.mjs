import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, lstat, writeFile, open, unlink } from 'node:fs/promises';
import path from 'node:path';
import { readSnapshot, fileDigest } from './snapshot-io.mjs';

export const PUBLIC_SITE_ID = '5f0ec4e5-fe16-4ef3-8380-9b8aff26edbb';
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

export class ReleaseError extends Error {
  constructor(code) { super(code); this.name = 'ReleaseError'; this.code = code; }
}
export function requireRelease(condition, code) { if (!condition) throw new ReleaseError(code); }

/** Netlify's production policy lives on the site, not in build_settings. */
export function getNetlifyProductionState(site, marker = {}) {
  const deployed = site.published_deploy || {};
  return {
    siteId: site.id, id: deployed.id, ready: deployed.state === 'ready',
    gitBuildsStopped: site.build_settings?.stop_builds === true,
    // Require an explicit false; an omitted or invalid policy is not approval.
    nonGitProductionDeploysAllowed: site.prevent_non_git_prod_deploys === false,
    snapshotSha256: marker.snapshotSha256, codeCommit: marker.codeCommit,
  };
}

export function requireDeploymentPolicy(production) {
  requireRelease(production.gitBuildsStopped === true, 'GIT_AUTOPUBLISH_STILL_ENABLED');
  requireRelease(production.nonGitProductionDeploysAllowed === true, 'NON_GIT_PRODUCTION_DEPLOYS_FORBIDDEN');
}

/** Deterministic manifest, streamed one file at a time; symlinks cannot escape dist. */
export async function artifactManifest(root) {
  const files = [];
  async function walk(directory) {
    for (const name of (await readdir(directory)).sort()) {
      const absolute = path.join(directory, name);
      const stat = await lstat(absolute);
      requireRelease(!stat.isSymbolicLink(), 'ARTIFACT_SYMLINK');
      if (stat.isDirectory()) await walk(absolute);
      else if (stat.isFile()) files.push({ path: path.relative(root, absolute).split(path.sep).join('/'), sha256: sha256(await readFile(absolute)), size: stat.size });
      else throw new ReleaseError('ARTIFACT_FILE_TYPE');
    }
  }
  await walk(root);
  requireRelease(files.length > 0, 'EMPTY_ARTIFACT');
  return { files, digest: sha256(JSON.stringify(files)) };
}

/** Local defense; the GitHub concurrency group provides the cross-runner lock. */
export async function acquireLock(filename) {
  await mkdir(path.dirname(filename), { recursive: true });
  let handle;
  try { handle = await open(filename, 'wx', 0o600); }
  catch (error) { if (error.code === 'EEXIST') throw new ReleaseError('RELEASE_ALREADY_RUNNING'); throw error; }
  await handle.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
  return async () => { await handle.close(); await unlink(filename); };
}

/**
 * Providers perform all external effects. The exact draft deployment is promoted,
 * never rebuilt. No arbitrary provider error/body is copied into the status file.
 */
export async function executeRelease({ snapshotPath, artifactDir, codeCommit, providers, statusPath, lockPath, now = () => new Date().toISOString() }) {
  const unlock = await acquireLock(lockPath);
  const result = { schemaVersion: 1, status: 'draft', startedAt: now(), codeCommit, siteId: PUBLIC_SITE_ID, events: [] };
  let snapshot, baseline, candidate, promoted = false;
  async function record(status, detail = {}) {
    Object.assign(result, detail, { status, updatedAt: now() });
    result.events.push({ status, at: result.updatedAt });
    await mkdir(path.dirname(statusPath), { recursive: true });
    await writeFile(statusPath, JSON.stringify(result, null, 2) + '\n', { mode: 0o600 });
    // Status acknowledgement is mandatory before promotion, best effort after it.
    if (providers.report && snapshot) {
      try { await providers.report(snapshot, result); }
      catch { if (!promoted && !['blocked', 'deployed'].includes(status)) throw new ReleaseError('CMS_STATUS_UNAVAILABLE'); result.statusSyncPending = true; await writeFile(statusPath, JSON.stringify(result, null, 2) + '\n', { mode: 0o600 }); }
    }
  }
  async function checkSnapshot() { requireRelease(await fileDigest(snapshotPath) === result.snapshotSha256, 'SNAPSHOT_CHANGED'); }
  async function checkArtifact(digest) { requireRelease((await artifactManifest(artifactDir)).digest === digest, 'ARTIFACT_CHANGED'); }
  async function checkProductionUnchanged() {
    const current = await providers.currentProduction();
    requireRelease(current.siteId === PUBLIC_SITE_ID && current.id === baseline.id && current.ready, 'PRODUCTION_CHANGED');
    requireDeploymentPolicy(current);
    return current;
  }
  try {
    // Check the live policy before even exporting CMS content or reporting a lot.
    // Every invocation, including recovery of an unchanged lot, starts here.
    baseline = await providers.currentProduction();
    requireRelease(baseline.siteId === PUBLIC_SITE_ID && baseline.id && baseline.ready, 'WRONG_OR_UNREADY_PRODUCTION');
    requireDeploymentPolicy(baseline);
    result.previousDeployId = baseline.id;
    if (providers.pullSnapshot) await providers.pullSnapshot(snapshotPath);
    snapshot = await readSnapshot(snapshotPath, { metadataOnly: true });
    requireRelease(snapshot.schemaVersion === 1 && typeof snapshot.id === 'string' && /^[a-f0-9]{40}$/.test(codeCommit), 'INVALID_RELEASE_INPUT');
    requireRelease(snapshot.sourceCommit === codeCommit, 'SNAPSHOT_SOURCE_MISMATCH');
    result.snapshotId = snapshot.id; result.snapshotSha256 = await fileDigest(snapshotPath);
    const marker = { schemaVersion: 1, snapshotId: snapshot.id, snapshotSha256: result.snapshotSha256, codeCommit };
    await record('checking');
    await providers.validateSnapshot(snapshotPath);
    requireRelease(await providers.currentSourceCommit() === codeCommit, 'SOURCE_ADVANCED');
    if (baseline.snapshotSha256 === result.snapshotSha256 && baseline.codeCommit === codeCommit) {
      // A matching immutable deploy is insufficient to acknowledge the public
      // site after an interrupted status callback: verify its live marker too.
      await providers.verifyProduction({ siteId: baseline.siteId, id: baseline.id }, marker);
      await checkProductionUnchanged();
      await record('deployed', { deployId: baseline.id, unchanged: true, productionVerified: true });
      return result;
    }
    await providers.archiveSnapshot(snapshotPath, result.snapshotSha256);
    await providers.applySnapshot(snapshotPath);
    await checkSnapshot();
    await checkProductionUnchanged();
    await providers.buildAndTest();
    await checkSnapshot();
    await mkdir(path.join(artifactDir, '.well-known'), { recursive: true });
    await writeFile(path.join(artifactDir, '.well-known', 'flexweb-release.json'), JSON.stringify(marker) + '\n');
    const manifest = await artifactManifest(artifactDir);
    result.artifactSha256 = manifest.digest;
    await checkProductionUnchanged();
    candidate = await providers.createPreview({ artifactDir, marker, manifest });
    requireRelease(candidate.siteId === PUBLIC_SITE_ID && candidate.id && candidate.ready && candidate.draft === true, 'INVALID_PREVIEW_DEPLOYMENT');
    await record('checking', { previewDeployId: candidate.id, previewUrl: candidate.url });
    await providers.verifyPreview(candidate, marker);
    await checkSnapshot(); await checkArtifact(manifest.digest);
    await record('checking', { previewVerified: true });
    requireRelease(await providers.currentSourceCommit() === codeCommit, 'SOURCE_ADVANCED');
    await checkProductionUnchanged();
    try { await providers.promote(candidate.id); }
    catch {
      // A timeout can hide a successful promotion. Read state before deciding;
      // never blindly repeat a mutation that may already have completed.
      let observed;
      try { observed = await providers.currentProduction(); } catch { throw new ReleaseError('PROMOTION_UNCERTAIN'); }
      if (observed.id !== candidate.id) throw new ReleaseError('PROMOTION_UNCONFIRMED');
    }
    promoted = true;
    const confirmed = await providers.currentProduction();
    requireRelease(confirmed.siteId === PUBLIC_SITE_ID && confirmed.id === candidate.id, 'PROMOTION_NOT_CURRENT');
    await providers.verifyProduction(candidate, marker);
    await record('deployed', { deployId: candidate.id, publishedAt: now(), productionVerified: true });
    return result;
  } catch (error) {
    const code = error instanceof ReleaseError ? error.code : 'RELEASE_FAILED';
    if (promoted && candidate && baseline) {
      try {
        const current = await providers.currentProduction();
        if (current.id === candidate.id) {
          if (current.nonGitProductionDeploysAllowed !== true || current.gitBuildsStopped !== true) {
            result.rollback = 'skipped-deployment-policy';
          } else {
            await providers.promote(baseline.id);
            const restored = await providers.currentProduction();
            result.rollback = restored.id === baseline.id ? 'confirmed' : 'uncertain';
            result.restoredDeployId = restored.id === baseline.id ? baseline.id : undefined;
          }
        } else result.rollback = 'skipped-production-changed';
      } catch { result.rollback = 'uncertain'; }
    }
    await record('blocked', { errorCode: code });
    return result;
  } finally { await unlock(); }
}
