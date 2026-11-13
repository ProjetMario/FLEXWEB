import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { artifactManifest, PUBLIC_SITE_ID, requireRelease, getNetlifyProductionState, requireDeploymentPolicy } from './release-core.mjs';
import { requestNetlify } from './netlify-request.mjs';
import { uploadWithProductionLock } from './production-upload.mjs';
import { verifyAutomationProxy } from './automation-probe.mjs';
import { copyAssetClosure } from './form-hotfix.mjs';
import { pageFingerprint } from '../seo/indexnow-submit.mjs';

const exec = promisify(execFile);
export const TARGETS = ['journal/index.html', 'creation-site-internet/index.html'];
export const SITEMAP = 'sitemaps/principal-1.xml';
export const MARKER = '.well-known/flexweb-release.json';
const baselineId = '6af7884cf8420561604ee736';
const baselineCommit = '02875ccdbcc3e36e17bd731a2f6d8377a94e5600';
const baselineDigest = '8d758bd8d9365a7286a7e62766365bea6ded669ff4b8e9d85b7cfef42e97fb05';
const originalDigest = '1ef8d96d488c0307a4cc24b53b44f50fa0856d06da5161bf90bd47c3289f47b6';
const baselineOrigin = 'https://' + baselineId + '--flex-webb.netlify.app';
// Exactly the seven files in the verified publication receipt from run 43512626929.
const publishedPatch = [
  MARKER, 'demarrer/index.html', 'privacy/index.html',
  '_astro/ConversionEvents.astro_astro_type_script_index_0_lang.Cr74znjO.js',
  '_astro/QuoteCookieConsent.CWJpkovp.js', '_astro/StartProject.B7prEVrB.js',
  '_astro/analytics.CexFF_rL.js',
];
const root = process.cwd();
const directory = process.env.HOTFIX_BASELINE_DIR;
const reportPath = path.join(root, '.cms/seo-discovery-hotfix-report.json');
const manifestPath = path.join(root, '.cms/seo-discovery-baseline-manifest.json');
const api = (method, suffix) => requestNetlify(method, suffix, { token: process.env.NETLIFY_AUTH_TOKEN });
const htmlRoute = file => '/' + file.replace(/index\.html$/, '');

export function assertScopedManifest(before, after, closure) {
  const old = new Map(before.files.map(file => [file.path, file]));
  const current = new Map(after.files.map(file => [file.path, file]));
  requireRelease([...old.keys()].every(file => current.has(file)), 'PUBLISHED_FILE_REMOVED');
  const changed = after.files.filter(file => old.get(file.path)?.sha256 !== file.sha256);
  const direct = new Set([...TARGETS, SITEMAP, MARKER]);
  const allowed = new Set([...direct, ...closure.filter(file => file.startsWith('_astro/'))]);
  requireRelease(changed.every(file => allowed.has(file.path)), 'UNRELATED_FILE_CHANGED');
  requireRelease(changed.filter(file => old.has(file.path)).every(file => direct.has(file.path)), 'EXISTING_SHARED_ASSET_CHANGED');
  requireRelease(changed.length <= 30, 'PATCH_SCOPE_EXCEEDED');
  return changed;
}

export function assertSitemapScope(before, after) {
  const entries = xml => {
    const rows = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(match => {
      const loc = match[1].match(/<loc>([^<]+)<\/loc>/)?.[1];
      requireRelease(loc?.startsWith('https://flex-web.fr/'), 'INVALID_SITEMAP_URL');
      return [loc, match[1]];
    });
    const result = new Map(rows);
    requireRelease(result.size === rows.length, 'DUPLICATE_SITEMAP_URL');
    return result;
  };
  const old = entries(before), current = entries(after);
  requireRelease(old.size > 0 && old.size === current.size && [...old.keys()].every(url => current.has(url)), 'SITEMAP_URLS_CHANGED');
  const allowed = new Set(TARGETS.map(file => 'https://flex-web.fr' + htmlRoute(file)));
  requireRelease([...old].every(([url, xml]) => allowed.has(url) || current.get(url) === xml), 'UNRELATED_SITEMAP_ENTRY_CHANGED');
}

async function bytes(origin, file) {
  const response = await fetch(origin + '/' + file, { redirect: 'follow', signal: AbortSignal.timeout(30000) });
  requireRelease(response.status === 200, 'REMOTE_FILE_UNAVAILABLE');
  return Buffer.from(await response.arrayBuffer());
}
async function production() {
  const site = await api('GET', '/sites/' + PUBLIC_SITE_ID);
  const origin = site.published_deploy?.deploy_ssl_url;
  requireRelease(/^https:\/\/[a-z0-9-]+--flex-webb\.netlify\.app$/.test(origin), 'INVALID_PRODUCTION_ORIGIN');
  return getNetlifyProductionState(site, JSON.parse((await bytes(origin, MARKER)).toString('utf8')));
}
async function unchangedProduction() {
  const current = await production();
  requireRelease(current.id === baselineId && current.codeCommit === baselineCommit && current.ready, 'PRODUCTION_CHANGED');
  requireDeploymentPolicy(current);
  return current;
}
async function save(report) {
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
}
async function verify(origin, report, isProduction = false) {
  for (const file of [...TARGETS, SITEMAP, MARKER, ...report.assets]) {
    requireRelease((await bytes(origin, file)).equals(await readFile(path.join(directory, file))), 'PATCH_BYTES_MISMATCH');
  }
  for (const file of TARGETS) {
    const response = await fetch(origin + htmlRoute(file), { redirect: 'error', signal: AbortSignal.timeout(30000) });
    requireRelease(response.status === 200, 'PUBLIC_PAGE_UNAVAILABLE');
    if (isProduction) requireRelease(!/noindex/i.test(response.headers.get('x-robots-tag') || ''), 'PRODUCTION_NOINDEX');
    pageFingerprint(await response.text(), 'https://flex-web.fr' + htmlRoute(file));
  }
  for (const route of ['', 'pricing/', 'demarrer/', 'privacy/', 'contact/', 'en/', 'robots.txt', 'sitemap.xml', 'llms.txt', 'llms-full.txt']) {
    requireRelease((await bytes(origin, route)).equals(await bytes(baselineOrigin, route)), 'UNRELATED_ROUTE_CHANGED');
  }
  await verifyAutomationProxy(origin);
}
async function deploy(isProduction, codeCommit) {
  const args = ['--yes', 'netlify-cli@23.15.1', 'deploy', '--no-build', '--dir', directory, '--site', PUBLIC_SITE_ID, '--json', '--message', 'Scoped SEO discovery ' + codeCommit];
  if (isProduction) args.push('--prod');
  const running = exec('npx', args, { cwd: root, env: process.env, maxBuffer: 8 * 1024 * 1024, timeout: 10 * 60 * 1000 });
  running.child?.stdin?.end();
  const output = JSON.parse((await running).stdout.trim());
  requireRelease(/^[a-f0-9]{24}$/.test(output.deploy_id), 'DEPLOY_ID_MISSING');
  const record = await api('GET', '/deploys/' + output.deploy_id);
  requireRelease(record.site_id === PUBLIC_SITE_ID && record.state === 'ready', 'DEPLOY_NOT_READY');
  return { id: record.id, siteId: record.site_id, ready: true, url: record.deploy_ssl_url };
}
async function main() {
  requireRelease(directory && path.isAbsolute(directory), 'BASELINE_DIRECTORY_REQUIRED');
  const action = process.argv[2];
  if (action === 'baseline') {
    requireRelease((await artifactManifest(directory)).digest === originalDigest, 'ORIGINAL_BASELINE_MISMATCH');
    for (const file of publishedPatch) {
      await mkdir(path.dirname(path.join(directory, file)), { recursive: true });
      await writeFile(path.join(directory, file), await bytes(baselineOrigin, file));
    }
    const manifest = await artifactManifest(directory);
    requireRelease(manifest.digest === baselineDigest, 'PUBLISHED_BASELINE_MISMATCH');
    await unchangedProduction();
    await writeFile(manifestPath, JSON.stringify(manifest));
    await save({ status: 'baseline-verified', baselineDeployId: baselineId, baselineDigest, files: manifest.files.length });
    console.log(JSON.stringify({ baselineVerified: true, files: manifest.files.length, digest: manifest.digest }));
    return;
  }
  if (action === 'prepare') {
    const before = JSON.parse(await readFile(manifestPath, 'utf8'));
    requireRelease(before.digest === baselineDigest && (await artifactManifest(directory)).digest === baselineDigest, 'BASELINE_CHANGED');
    const candidate = path.join(root, 'dist');
    assertSitemapScope(await readFile(path.join(directory, SITEMAP), 'utf8'), await readFile(path.join(candidate, SITEMAP), 'utf8'));
    const closure = await copyAssetClosure(candidate, directory, [...TARGETS, SITEMAP]);
    const codeCommit = (await exec('git', ['rev-parse', 'HEAD'])).stdout.trim();
    const protectedChanges = (await exec('git', ['diff', '--name-only', baselineCommit, codeCommit, '--', 'netlify.toml', 'netlify/functions', 'package.json', 'package-lock.json', 'public/_headers', 'public/_redirects'])).stdout.trim();
    requireRelease(!protectedChanges, 'UNRELATED_DEPLOY_CONFIG_CHANGED');
    const previousMarker = JSON.parse(await readFile(path.join(directory, MARKER), 'utf8'));
    requireRelease(previousMarker.codeCommit === baselineCommit, 'BASELINE_MARKER_MISMATCH');
    const marker = { ...previousMarker, codeCommit, scopedPatch: { baseDeployId: baselineId, baseCodeCommit: baselineCommit, paths: TARGETS.map(htmlRoute), sitemap: '/' + SITEMAP } };
    await writeFile(path.join(directory, MARKER), JSON.stringify(marker) + '\n');
    const after = await artifactManifest(directory);
    const changed = assertScopedManifest(before, after, closure);
    const report = { status: 'prepared', codeCommit, baselineDeployId: baselineId, baselineDigest, artifactDigest: after.digest, marker, changed: changed.map(({ path, size, sha256 }) => ({ path, size, sha256 })), assets: closure.filter(file => file.startsWith('_astro/')), unchangedFiles: after.files.length - changed.length };
    await save(report);
    console.log(JSON.stringify(report));
    return;
  }
  requireRelease(action === 'publish', 'INVALID_ACTION');
  let report = JSON.parse(await readFile(reportPath, 'utf8'));
  requireRelease(report.status === 'prepared' && (await artifactManifest(directory)).digest === report.artifactDigest, 'ARTIFACT_CHANGED');
  requireRelease(process.env.GITHUB_REF_NAME === 'codex/seo-discovery-only-hotfix', 'UNEXPECTED_SOURCE_BRANCH');
  const source = (await exec('git', ['ls-remote', 'origin', 'refs/heads/codex/seo-discovery-only-hotfix'])).stdout.split(/\s+/)[0];
  requireRelease(source === report.codeCommit, 'SOURCE_ADVANCED');
  await unchangedProduction();
  const preview = await deploy(false, report.codeCommit);
  report = { ...report, status: 'preview', preview }; await save(report);
  await verify(preview.url, report);
  await unchangedProduction();
  requireRelease((await artifactManifest(directory)).digest === report.artifactDigest, 'ARTIFACT_CHANGED');
  const published = await uploadWithProductionLock({ expected: report.marker, expectedProductionId: baselineId, currentProduction: production,
    unlock: id => api('POST', '/deploys/' + id + '/unlock'), lock: id => api('POST', '/deploys/' + id + '/lock'), upload: () => deploy(true, report.codeCommit) });
  report = { ...report, status: 'published', published }; await save(report);
  await verify('https://flex-web.fr', report, true);
  const current = await production();
  requireRelease(current.id === published.id && current.locked, 'PRODUCTION_NOT_CONFIRMED_LOCKED');
  report = { ...report, status: 'verified', verifiedAt: new Date().toISOString() }; await save(report);
  // Only a verified production receipt may unlock the existing IndexNow notifier.
  await writeFile(path.join(root, '.cms/publication-report.json'), JSON.stringify({
    schemaVersion: 1, status: 'deployed', productionVerified: true, unchanged: false,
    ...report.marker, deployId: published.id, previousDeployId: baselineId, previousCodeCommit: baselineCommit,
  }, null, 2) + '\n');
  console.log(JSON.stringify({ status: report.status, deployId: published.id, changed: report.changed, unchangedFiles: report.unchangedFiles }));
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(async error => {
    const code = /^[A-Z0-9_]+$/.test(error.message) ? error.message : 'SCOPED_SEO_PUBLICATION_FAILED';
    const report = await readFile(reportPath, 'utf8').then(JSON.parse).catch(() => ({}));
    await save({ ...report, error: code });
    console.error(code); process.exitCode = 1;
  });
}
