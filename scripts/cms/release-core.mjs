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
    locked: deployed.locked === true,
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
 * Providers perform all external effects. Production uploads the same verified
 * artifact without rebuilding. No arbitrary provider error/body enters reports.
 */
export async function executeRelease({ snapshotPath, artifactDir, codeCommit, providers, statusPath, lockPath, now = () => new Date().toISOString() }) {
  const unlock = await acquireLock(lockPath);
  const result = { schemaVersion: 1, status: 'draft', startedAt: now(), codeCommit, siteId: PUBLIC_SITE_ID, events: [] };
  let snapshot, baseline, candidate, published, promoted = false;
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
    result.previousCodeCommit = baseline.codeCommit;
    result.previousSnapshotSha256 = baseline.snapshotSha256;
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
    try { published = await providers.publishProduction({ artifactDir, marker, manifest, preview: candidate, baseline }); }
    catch {
      // An upload timeout may hide a completed production deployment. Reconcile
      // its immutable marker; never retry an uncertain mutation blindly.
      let observed;
      try { observed = await providers.currentProduction(); } catch { throw new ReleaseError('PROMOTION_UNCERTAIN'); }
      requireRelease(observed.siteId === PUBLIC_SITE_ID && observed.id !== baseline.id && observed.ready
        && observed.codeCommit === marker.codeCommit && observed.snapshotSha256 === marker.snapshotSha256, 'PROMOTION_UNCONFIRMED');
      published = observed;
    }
    requireRelease(published?.siteId === PUBLIC_SITE_ID && published.id && published.id !== baseline.id && published.ready, 'INVALID_PRODUCTION_DEPLOYMENT');
    promoted = true;
    const confirmed = await providers.currentProduction();
    requireRelease(confirmed.siteId === PUBLIC_SITE_ID && confirmed.id === published.id, 'PROMOTION_NOT_CURRENT');
    if(baseline.locked)requireRelease(confirmed.locked===true,'PRODUCTION_LOCK_NOT_RESTORED');
    requireDeploymentPolicy(confirmed);
    await checkArtifact(manifest.digest);
    await providers.verifyProduction(published, marker);
    const verified = await providers.currentProduction();
    requireRelease(verified.siteId === PUBLIC_SITE_ID && verified.id === published.id && verified.ready, 'PRODUCTION_CHANGED');
    if(baseline.locked)requireRelease(verified.locked===true,'PRODUCTION_LOCK_NOT_RESTORED');
    await record('deployed', { deployId: published.id, publishedAt: now(), productionVerified: true });
    return result;
  } catch (error) {
    const code = error instanceof ReleaseError ? error.code : 'RELEASE_FAILED';
    // A failed live verification requires a forward fix. Never restore an old
    // deployment or overwrite a concurrently published version automatically.
    if (promoted && published) Object.assign(result, { deployId: published.id, forwardFixRequired: true });
    await record('blocked', { errorCode: code });
    return result;
  } finally { await unlock(); }
}
