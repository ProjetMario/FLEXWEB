import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile, mkdir, readdir, copyFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { acquireLock, executeRelease, getNetlifyProductionState, PUBLIC_SITE_ID, requireRelease, ReleaseError } from './release-core.mjs';
import { fileDigest } from './snapshot-io.mjs';

const exec = promisify(execFile);
const root = process.cwd();
const env = process.env;
const reportPath = path.join(root, '.cms/publication-report.json');
const snapshotPath = path.join(root, '.cms/release-snapshot.json');
const node = process.execPath;

async function command(file, args, extraEnv = {}) {
  try { return (await exec(file, args, { cwd: root, env: { ...env, ...extraEnv }, maxBuffer: 16 * 1024 * 1024 })).stdout.trim(); }
  catch { throw new ReleaseError(`COMMAND_FAILED_${path.basename(file).replace(/[^a-z0-9]/gi, '_').toUpperCase()}`); }
}
async function netlify(method, suffix) {
  const response = await fetch(`https://api.netlify.com/api/v1${suffix}`, { method, headers: { authorization: `Bearer ${env.NETLIFY_AUTH_TOKEN}`, 'content-type': 'application/json' }, signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new ReleaseError(`NETLIFY_HTTP_${response.status}`);
  return response.status === 204 ? {} : response.json();
}
async function markerAt(origin) {
  const response = await fetch(`${origin}/.well-known/flexweb-release.json`, { redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(20000) });
  if (response.status === 404) return {};
  requireRelease(response.ok, 'RELEASE_MARKER_UNAVAILABLE');
  try { return await response.json(); } catch { throw new ReleaseError('INVALID_RELEASE_MARKER'); }
}
async function currentProduction() {
  const site = await netlify('GET', `/sites/${PUBLIC_SITE_ID}`);
  const deployed = site.published_deploy || {};
  let marker = {};
  const origin = deployed.deploy_ssl_url || deployed.deploy_url;
  if (origin) {
    requireRelease(/^https:\/\/[a-z0-9-]+--flex-webb\.netlify\.app$/.test(origin), 'UNEXPECTED_DEPLOY_ORIGIN');
    marker = await markerAt(origin);
  }
  return getNetlifyProductionState(site, marker);
}
async function verifyRemote(candidate, expected, production = false) {
  const origin = production ? 'https://flex-web.fr' : candidate.url;
  const marker = await markerAt(origin);
  for (const key of ['snapshotId', 'snapshotSha256', 'codeCommit']) requireRelease(marker[key] === expected[key], 'REMOTE_SNAPSHOT_MISMATCH');
  for (const route of ['/', '/pricing/', '/demarrer/', '/territoires/', '/sitemap.xml']) {
    const response = await fetch(`${origin}${route}`, { redirect: 'error', signal: AbortSignal.timeout(20000) });
    requireRelease(response.status === 200, 'REMOTE_PAGE_UNAVAILABLE');
    if (production) requireRelease(!/noindex/i.test(response.headers.get('x-robots-tag') || ''), 'PRODUCTION_NOINDEX');
  }
}
async function localTests() {
  const server = spawn('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', '4321'], { cwd: root, env, stdio: 'ignore' });
  let spawnError;
  server.once('error', error => { spawnError = error; });
  try {
    let ready = false;
    for (let attempt = 0; attempt < 40; attempt++) {
      if (spawnError || server.exitCode !== null) throw new ReleaseError('LOCAL_PREVIEW_FAILED');
      try { const response = await fetch('http://127.0.0.1:4321', { signal: AbortSignal.timeout(1000) }); ready = response.ok; } catch {}
      if (ready) break;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    requireRelease(ready, 'LOCAL_PREVIEW_TIMEOUT');
    // The SEO suite includes Playwright pages: it must run while this preview
    // is listening, before the finally block tears the server down.
    const seoTests = (await readdir(path.join(root, 'tests/seo'))).filter(file => /\.test\.(mjs|ts)$/.test(file)).map(file => `tests/seo/${file}`);
    await command(node, ['--import', 'tsx', '--test', ...seoTests]);
    await command(node, ['--test', 'tests/quote-flow.test.mjs'], { FLEXWEB_TEST_URL: 'http://127.0.0.1:4321' });
    await command(node, ['scripts/cms/release-smoke.mjs', 'http://127.0.0.1:4321']);
  } finally { server.kill('SIGTERM'); }
}

await mkdir(path.dirname(reportPath), { recursive: true });
if (env.ENABLE_EMDASH_PUBLICATION !== 'true') {
  await writeFile(reportPath, JSON.stringify({ schemaVersion: 1, status: 'draft', automaticPublicationEnabled: false, reason: 'ACTIVATION_REQUIRED' }, null, 2) + '\n');
  console.log('Publication EmDash inactive. Aucun déploiement effectué.');
} else {
  let unlockRun;
  try {
    // Include pull and status files in the lock, not just compilation/promotion.
    unlockRun = await acquireLock(path.join(root, '.cms/publication-run.lock'));
    requireRelease(Boolean(env.NETLIFY_AUTH_TOKEN && env.EMDASH_URL && env.EMDASH_READ_TOKEN && env.EMDASH_WRITE_TOKEN), 'MISSING_SERVER_SECRETS');
    const codeCommit = await command('git', ['rev-parse', 'HEAD']);
    env.CMS_SOURCE_COMMIT = codeCommit;
    env.CMS_PUBLICATION_REPORT_PATH = reportPath;
    const providers = {
      // executeRelease checks the Netlify policy before this authenticated export.
      pullSnapshot: output => command(node, ['scripts/cms/snapshot.mjs', 'pull', '--mode', 'published', '--output', output]),
      validateSnapshot: input => command(node, ['scripts/cms/snapshot.mjs', 'validate', '--input', input]),
      applySnapshot: input => command(node, ['scripts/cms/snapshot.mjs', 'apply', '--input', input]),
      currentProduction,
      currentSourceCommit: async () => (await command('git', ['ls-remote', '--exit-code', 'origin', 'refs/heads/main'])).split(/\s+/)[0],
      archiveSnapshot: async (source, digest) => {
        const archiveDir = path.join(root, '.cms/releases'); await mkdir(archiveDir, { recursive: true });
        const filename = path.join(archiveDir, `${digest}.json`);
        try { await copyFile(source, filename, constants.COPYFILE_EXCL); }
        catch (error) { if (error.code !== 'EEXIST') throw new ReleaseError('ARCHIVE_WRITE_FAILED'); }
        requireRelease(await fileDigest(filename) === digest, 'ARCHIVE_MISMATCH');
      },
      buildAndTest: async () => {
        env.CMS_SNAPSHOT_PATH = path.join(root, '.cms/snapshot.json');
        env.CONTEXT = 'production';
        await command('npm', ['run', 'build']);
        await command(node, ['scripts/check-seo.mjs']);
        await command(node, ['scripts/seo/quality.mjs', '--enforce-release']);
        await command(node, ['scripts/seo/audit-territorial-publication.mjs']);
        await localTests();
      },
      createPreview: async ({ artifactDir, marker }) => {
        // --no-build prevents a second build. No --prod until preview is verified.
        const raw = await command('npx', ['--yes', 'netlify-cli@23.15.1', 'deploy', '--no-build', '--dir', artifactDir, '--site', PUBLIC_SITE_ID, '--json', '--message', `EmDash ${marker.snapshotSha256.slice(0, 16)} ${codeCommit}`]);
        const output = JSON.parse(raw);
        requireRelease(typeof output.deploy_id === 'string', 'MISSING_PREVIEW_ID');
        const deploy = await netlify('GET', `/deploys/${encodeURIComponent(output.deploy_id)}`);
        const url = deploy.deploy_ssl_url || output.deploy_url;
        requireRelease(/^https:\/\/[a-z0-9-]+--flex-webb\.netlify\.app$/.test(url), 'UNEXPECTED_PREVIEW_ORIGIN');
        const current = await currentProduction();
        return { siteId: deploy.site_id, id: deploy.id, url, ready: deploy.state === 'ready', draft: current.id !== deploy.id };
      },
      verifyPreview: async (candidate, marker) => {
        await verifyRemote(candidate, marker);
        await command(node, ['scripts/check-seo-live.mjs', candidate.url]);
        await command(node, ['scripts/cms/release-smoke.mjs', candidate.url]);
      },
      promote: deployId => netlify('POST', `/sites/${PUBLIC_SITE_ID}/deploys/${encodeURIComponent(deployId)}/restore`),
      verifyProduction: (candidate, marker) => verifyRemote(candidate, marker, true),
      report: (_snapshot, state) => command(node, ['scripts/cms/snapshot.mjs', 'report', '--input', snapshotPath, '--status', state.status, ...(state.deployId ? ['--deploy-id', state.deployId] : [])]),
    };
    const result = await executeRelease({ snapshotPath, artifactDir: path.join(root, 'dist'), codeCommit, providers, statusPath: reportPath, lockPath: path.join(root, '.cms/release.lock') });
    console.log(JSON.stringify({ status: result.status, deployId: result.deployId || null, errorCode: result.errorCode || null, unchanged: result.unchanged === true, rollback: result.rollback || null }));
    if (result.status !== 'deployed') process.exitCode = 1;
  } catch (error) {
    const errorCode = error instanceof ReleaseError ? error.code : 'RELEASE_INITIALIZATION_FAILED';
    if (errorCode !== 'RELEASE_ALREADY_RUNNING') await writeFile(reportPath, JSON.stringify({ schemaVersion: 1, status: 'blocked', errorCode }, null, 2) + '\n');
    console.error(`Publication bloquée : ${errorCode}`); process.exitCode = 1;
  } finally { if (unlockRun) await unlockRun(); }
}
