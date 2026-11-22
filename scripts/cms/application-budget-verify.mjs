import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { normalizeFiles, functionFingerprint } from './application-budget-deploy.mjs';
import { verifyAutomationProxy } from './automation-probe.mjs';

// Read-only completion of the release already published on 2026-11-22.
// These values are pinned from its archived release report, not a new build.
const EXPECTED = {
  siteId: '5f0ec4e5-fe16-4ef3-8380-9b8aff26edbb',
  baselineId: '6af791098269e8f08591ce03',
  productionId: '6b02c2a45950df733ff5a331',
  baselineFileCount: 162496,
  fileCount: 162498,
  baselineManifestSha256: 'c943ab32fd33ba8111aaad9ab2b0cc5091dacd059a5d2259a0f93d001cc0ebaa',
  manifestSha256: 'd2ee9323e4fc62787d90c552b9547976f8bba419c8db1525820e97438823b7ee',
  baselinePageSha1: '99dd0f693754a0f3e6f376b4e788bd879e601017',
  configSha1: '8a065322f81e77394d1aa3038986f228bb848d55',
  files: {
    'demarrer/index.html': 'd285713d8660777ed3349c6509792071b6652972',
    '_astro/startproject.ddznxqwm.js': '16d4e29e1d58757b689c8f6c26863aed398bc22f',
    '_astro/application-budget.b685da3d09a7d2d9.css': 'f26609c8cf38f05fa3a74438b75004a63685751e',
  },
  functions: {
    automation: 'e47889d0b76941594d82612ce832ce07661f883f312ab5904b05c73b9a3332ec',
    'automation-clock': 'f58e4f3910d4870ffc2dfc8da2991b2c28d6c7a27bc13f545c8e5b9fe0899233',
    'retired-content': 'edf67bafaa6440fb10e7fe04f4a58139c7bfc893740f1aad672aad4b7d1e6c04',
  },
};
const ORIGIN = 'https://flex-web.fr';
const REPORT_PATH = '.cms/application-budget-verification-report.json';
const report = { status: 'checking', productionId: EXPECTED.productionId, baselineId: EXPECTED.baselineId, startedAt: new Date().toISOString(), readOnly: true };
const assert = (condition, code) => { if (!condition) throw new Error(code); };
const hash = (algorithm, value) => createHash(algorithm).update(value).digest('hex');
const manifestDigest = files => hash('sha256', JSON.stringify(Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b)))));

async function saveReport() {
  await fs.mkdir(path.dirname(REPORT_PATH), { recursive: true });
  await fs.writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
}

async function get(suffix) {
  assert(suffix.startsWith('/') && !suffix.startsWith('//'), 'INVALID_API_PATH');
  const response = await fetch(`https://api.netlify.com/api/v1${suffix}`, {
    method: 'GET', redirect: 'error', signal: AbortSignal.timeout(60000),
    headers: { authorization: `Bearer ${process.env.NETLIFY_AUTH_TOKEN}` },
  });
  assert(response.ok, `NETLIFY_READ_${response.status}`);
  assert(!/rel="next"/.test(response.headers.get('link') || ''), 'UNEXPECTED_API_PAGINATION');
  return response.json();
}

function requirePublished(site) {
  assert(site.id === EXPECTED.siteId && site.ssl_url === ORIGIN, 'UNEXPECTED_SITE');
  assert(site.published_deploy?.id === EXPECTED.productionId && site.published_deploy.state === 'ready', 'PUBLISHED_DEPLOY_CHANGED');
  // Netlify represents an unlocked freshly created deploy as either false or null.
  assert([false, null].includes(site.published_deploy.locked), 'PUBLISHED_DEPLOY_LOCKED');
}

function ruleCounts(deploy) {
  const titles = deploy.summary?.messages?.map(entry => entry.title) || [];
  return {
    redirects: Number(titles.find(title => /^\d+ redirect rules processed$/.test(title))?.match(/^\d+/)?.[0]),
    headers: Number(titles.find(title => /^\d+ header rules processed$/.test(title))?.match(/^\d+/)?.[0]),
  };
}

async function verifyLiveFile(name, expectedSha1) {
  const route = name === 'demarrer/index.html' ? '/demarrer/?service=application' : `/${name}`;
  const response = await fetch(new URL(route, ORIGIN), {
    method: 'GET', redirect: 'error', cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(30000),
  });
  assert(response.status === 200, `LIVE_FILE_STATUS:${name}`);
  const body = Buffer.from(await response.arrayBuffer());
  assert(hash('sha1', body) === expectedSha1, `LIVE_FILE_HASH_MISMATCH:${name}`);
  return { path: name, sha1: expectedSha1, bytes: body.length };
}

async function main() {
  assert(process.env.NETLIFY_AUTH_TOKEN, 'NETLIFY_AUTH_TOKEN_MISSING');
  const initialSite = await get(`/sites/${EXPECTED.siteId}`);
  requirePublished(initialSite);
  const [production, baseline, entries] = await Promise.all([
    get(`/deploys/${EXPECTED.productionId}`),
    get(`/deploys/${EXPECTED.baselineId}`),
    get(`/sites/${EXPECTED.siteId}/files`),
  ]);
  assert(production.id === EXPECTED.productionId && production.site_id === EXPECTED.siteId && production.state === 'ready' && production.published_at, 'PRODUCTION_NOT_READY');
  assert([false, null].includes(production.locked), 'PRODUCTION_DEPLOY_LOCKED');
  assert(baseline.id === EXPECTED.baselineId && baseline.site_id === EXPECTED.siteId && baseline.state === 'ready', 'BASELINE_DEPLOY_MISMATCH');
  const files = normalizeFiles(entries);
  assert(Object.keys(files).length === EXPECTED.fileCount, 'PUBLISHED_FILE_COUNT_MISMATCH');
  assert(manifestDigest(files) === EXPECTED.manifestSha256, 'PUBLISHED_MANIFEST_MISMATCH');
  assert(files['netlify.toml'] === EXPECTED.configSha1, 'PUBLISHED_CONFIG_CHANGED');
  for (const [name, sha1] of Object.entries(EXPECTED.files)) assert(files[name] === sha1, `PUBLISHED_FILE_HASH_MISMATCH:${name}`);
  const restoredBaseline = { ...files };
  const newFiles = Object.keys(EXPECTED.files).filter(name => name !== 'demarrer/index.html');
  for (const name of newFiles) delete restoredBaseline[name];
  restoredBaseline['demarrer/index.html'] = EXPECTED.baselinePageSha1;
  assert(Object.keys(restoredBaseline).length === EXPECTED.baselineFileCount && manifestDigest(restoredBaseline) === EXPECTED.baselineManifestSha256, 'UNRELATED_STATIC_FILE_CHANGED');
  assert(functionFingerprint(production, EXPECTED.functions) === functionFingerprint(baseline), 'PUBLISHED_FUNCTION_CONTRACT_CHANGED');
  const counts = ruleCounts(production), baselineCounts = ruleCounts(baseline);
  assert(counts.redirects === 445 && counts.headers === 4 && JSON.stringify(counts) === JSON.stringify(baselineCounts), 'PUBLISHED_ROUTING_RULES_CHANGED');
  const liveFiles = await Promise.all(Object.entries(EXPECTED.files).map(([name, sha1]) => verifyLiveFile(name, sha1)));
  const liveProxy = await verifyAutomationProxy(ORIGIN);
  const finalSite = await get(`/sites/${EXPECTED.siteId}`);
  requirePublished(finalSite);
  Object.assign(report, {
    status: 'verified', verifiedAt: new Date().toISOString(), publishedAt: production.published_at,
    url: `${ORIGIN}/demarrer/?service=application`, locked: finalSite.published_deploy.locked,
    fileCount: EXPECTED.fileCount, manifestSha256: EXPECTED.manifestSha256,
    reconstructedBaselineManifestSha256: EXPECTED.baselineManifestSha256,
    changedExistingFiles: ['demarrer/index.html'], newFiles,
    preservedConfigSha1: EXPECTED.configSha1, functionContractsPreserved: true,
    rebuiltFunctionDigests: EXPECTED.functions, routingRules: counts, liveFiles, liveProxy,
  });
  await saveReport();
  console.log(JSON.stringify({ verified: true, productionId: EXPECTED.productionId, url: report.url, changedExistingFiles: report.changedExistingFiles, report: REPORT_PATH }));
}

main().catch(async error => {
  report.status = 'failed';
  report.error = error.message;
  report.failedAt = new Date().toISOString();
  await saveReport();
  console.error(`Read-only publication verification failed: ${error.message}`);
  process.exitCode = 1;
});
