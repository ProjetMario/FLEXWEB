import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { parse } from 'parse5';

// A one-page, forward-only release. The complete published file manifest is
// reused; neither the repository's other pages nor its functions are rebuilt.
// API contracts: https://open-api.netlify.com/#operation/createSiteDeploy
// Netlify CLI uploads its resolved redirects/headers as a netlify.toml file:
// https://github.com/netlify/cli/blob/main/src/utils/deploy/hash-config.ts
export const SITE_ID = '5f0ec4e5-fe16-4ef3-8380-9b8aff26edbb';
export const BASELINE_ID = '6af791098269e8f08591ce03';
export const RELEASE_BRANCH = 'codex/application-budget-live-20261122';
const PAGE = 'demarrer/index.html';
const LIVE_ORIGIN = 'https://flex-web.fr';
const BASELINE_ORIGIN = `https://${BASELINE_ID}--flex-webb.netlify.app`;
const REPORT = '.cms/application-budget-deploy-report.json';
const EXPECTED_FUNCTIONS = {
  'automation-clock': '447551103e0eeb9893bdf361cac40d58e4a8e738dcfe2a7bb8f79a663fb6c2ed',
  automation: '62d4a525642c0902ffb9ab5497ef323990c1168157b4d947cb500f78f184eec9',
  'retired-content': 'ae29644b7e24d22f86ca1c1d3597c02bdad45e507a0261f7548264221cd0a48e',
};
const report = { baselineId: BASELINE_ID, siteId: SITE_ID, codeCommit: process.env.GITHUB_SHA, startedAt: new Date().toISOString() };
const assert = (condition, code) => { if (!condition) throw new Error(code); };
const sha1 = value => createHash('sha1').update(value).digest('hex');
const sha256 = value => createHash('sha256').update(value).digest('hex');
const sorted = object => Object.fromEntries(Object.entries(object).sort(([a], [b]) => a.localeCompare(b)));
const manifestDigest = files => sha256(JSON.stringify(sorted(files)));

async function saveReport() {
  await fs.mkdir(path.dirname(REPORT), { recursive: true });
  await fs.writeFile(REPORT, `${JSON.stringify(report, null, 2)}\n`);
}

function relativePath(value) {
  assert(typeof value === 'string', 'INVALID_FILE_PATH');
  const clean = value.replace(/^\/+/, '');
  assert(clean && !/[\\?#\0]/.test(clean) && !clean.split('/').some(part => !part || part === '.' || part === '..'), 'INVALID_FILE_PATH');
  return clean;
}

export function normalizeFiles(entries) {
  assert(Array.isArray(entries) && entries.length > 100, 'INCOMPLETE_SITE_FILE_MANIFEST');
  const result = Object.create(null);
  for (const entry of entries) {
    const name = relativePath(entry.path).toLowerCase();
    assert(/^[a-f0-9]{40}$/.test(entry.sha) && !Object.hasOwn(result, name), 'INVALID_SITE_FILE_MANIFEST');
    result[name] = entry.sha;
  }
  for (const name of [PAGE, 'index.html', 'netlify.toml', 'robots.txt', 'sitemap.xml', 'espace-projet/index.html']) {
    assert(result[name], `BASELINE_FILE_MISSING:${name}`);
  }
  return result;
}

function nodes(root) {
  return [root, ...(root.childNodes || []).flatMap(nodes), ...(root.content ? nodes(root.content) : [])];
}

function startProjectIsland(html) {
  const islands = nodes(parse(html, { sourceCodeLocationInfo: true })).filter(node => node.tagName === 'astro-island' && node.attrs?.some(attr => attr.name === 'component-url' && /\/StartProject\.[^/]+\.js$/.test(attr.value)));
  assert(islands.length === 1 && islands[0].sourceCodeLocation?.endOffset, 'EXPECTED_ONE_START_PROJECT_ISLAND');
  const island = islands[0];
  return { start: island.sourceCodeLocation.startOffset, end: island.sourceCodeLocation.endOffset, source: html.slice(island.sourceCodeLocation.startOffset, island.sourceCodeLocation.endOffset) };
}

// Copy only the new form module's transitive imports. Existing content-addressed
// assets are never overwritten, even when a candidate build tries to reuse a name.
export async function prepareOverlay(baselineHtml, candidateDir, baselineFiles = {}) {
  const candidateHtml = await fs.readFile(path.join(candidateDir, PAGE), 'utf8');
  const before = startProjectIsland(baselineHtml);
  const after = startProjectIsland(candidateHtml);
  assert(before.source !== after.source, 'FORM_ISLAND_HAS_NOT_CHANGED');
  const blobs = new Map();
  const visited = new Set();
  const pending = [...after.source.matchAll(/["'](\/_astro\/[^"'<>\s]+)["']/g)].map(match => match[1].slice(1));
  assert(pending.some(name => /\/StartProject\.[^/]+\.js$/.test(name)), 'FORM_MODULE_MISSING');
  while (pending.length) {
    const name = relativePath(pending.pop());
    if (visited.has(name)) continue;
    visited.add(name);
    assert(name.startsWith('_astro/'), 'UNSCOPED_CANDIDATE_ASSET');
    const file = path.join(candidateDir, name);
    const stat = await fs.lstat(file);
    assert(stat.isFile() && !stat.isSymbolicLink(), 'INVALID_CANDIDATE_ASSET');
    const body = await fs.readFile(file);
    const digest = sha1(body);
    // Netlify's file inventory canonicalizes paths to lowercase; Astro keeps
    // mixed-case content hashes in its imports. Preserve local filenames for
    // reading, but use Netlify's canonical key for the deployment manifest.
    const deployName = name.toLowerCase();
    if (baselineFiles[deployName]) assert(baselineFiles[deployName] === digest, `SHARED_ASSET_CHANGED:${name}`);
    else {
      assert(!blobs.has(deployName) || sha1(blobs.get(deployName)) === digest, 'CANDIDATE_ASSET_CASE_COLLISION');
      blobs.set(deployName, body);
    }
    if (/\.(?:js|mjs|css)$/.test(name)) {
      const source = body.toString('utf8');
      const references = [
        ...[...source.matchAll(/["']((?:\.\.?\/|\/_astro\/)[^"'\s<>]+)["']/g)].map(match => match[1]),
        ...[...source.matchAll(/url\(\s*["']?((?:\.\.?\/|\/_astro\/)[^"')\s]+)["']?\s*\)/g)].map(match => match[1]),
      ];
      for (const reference of references) {
        const resolved = path.posix.normalize(reference.startsWith('/') ? reference.slice(1) : path.posix.join(path.posix.dirname(name), reference));
        if (resolved.startsWith('_astro/')) pending.push(resolved);
      }
    }
  }
  // Keep every original stylesheet and script tag. Only this page loads this
  // small, scoped stylesheet, so portal/marketing styles remain byte-identical.
  const stylesheet = await fs.readFile('src/styles/quote-form.css');
  assert(!/@import\b|url\s*\(/i.test(stylesheet.toString('utf8')), 'FORM_STYLESHEET_MUST_BE_SELF_CONTAINED');
  const cssName = `_astro/application-budget.${sha256(stylesheet).slice(0,16)}.css`;
  assert(!baselineFiles[cssName] || baselineFiles[cssName] === sha1(stylesheet), 'FORM_STYLESHEET_COLLISION');
  if (!baselineFiles[cssName]) blobs.set(cssName, stylesheet);
  const link = `<link rel="stylesheet" href="/${cssName}">`;
  let html = baselineHtml.slice(0, before.start) + after.source + baselineHtml.slice(before.end);
  assert(html.includes('</head>') && !html.includes('application-budget.'), 'INVALID_BASELINE_HTML');
  html = html.replace('</head>', `${link}</head>`);
  // This check proves that everything outside the form island and its style
  // link is the original deployed HTML, including consent and analytics tags.
  const changedIsland = startProjectIsland(html);
  const restored = (html.slice(0, changedIsland.start) + before.source + html.slice(changedIsland.end)).replace(link, '');
  assert(restored === baselineHtml, 'HTML_CHANGED_OUTSIDE_FORM');
  blobs.set(PAGE, Buffer.from(html));
  assert(blobs.size > 1 && blobs.size <= 40, 'UNEXPECTED_FORM_ASSET_COUNT');
  return { blobs, cssName, assetClosure: [...new Set([...visited].map(name => name.toLowerCase()))].sort() };
}

function routeConfig(route) {
  const result = {};
  for (const [source, target] of Object.entries({ p: 'pattern', l: 'literal', e: 'expression', m: 'methods', ps: 'prefer_static' })) {
    if (route[source] !== undefined && route[source] !== null) result[target] = route[source];
  }
  assert(result.pattern, 'FUNCTION_ROUTE_PATTERN_MISSING');
  return result;
}

export function functionPayload(deploy) {
  const functions = Object.create(null), functions_config = Object.create(null);
  assert(Array.isArray(deploy.available_functions) && deploy.available_functions.length === 3, 'UNEXPECTED_FUNCTION_INVENTORY');
  for (const fn of deploy.available_functions) {
    assert(EXPECTED_FUNCTIONS[fn.n] === fn.d, `UNEXPECTED_FUNCTION_DIGEST:${fn.n}`);
    assert(fn.r === 'nodejs22.x' && fn.im === 'stream', `UNEXPECTED_FUNCTION_RUNTIME:${fn.n}`);
    functions[fn.n] = fn.d;
    const config = { memory: fn.mo ?? fn.m, priority: fn.p };
    // Reuse the original configured AWS region, not the API's normalized
    // airport-code alias, to retain the function's exact deployment identity.
    const region = fn.rgo || fn.rg || deploy.functions_region_overrides?.find(entry => entry.name === fn.n)?.region;
    if (region) config.region = region;
    if (fn.ro) config.routes = fn.ro.map(routeConfig);
    for (const [source, target] of [['dn','display_name'],['g','generator'],['bd','build_data']]) {
      if (fn[source] !== null && fn[source] !== undefined) config[target] = fn[source];
    }
    functions_config[fn.n] = config;
  }
  assert(JSON.stringify(sorted(functions)) === JSON.stringify(sorted(EXPECTED_FUNCTIONS)), 'FUNCTION_INVENTORY_CHANGED');
  assert(JSON.stringify(deploy.function_schedules) === '[{"name":"automation-clock","cron":"*/10 * * * *"}]', 'FUNCTION_SCHEDULE_CHANGED');
  assert(!deploy.edge_functions_present && !deploy.server, 'UNEXPECTED_SERVER_OR_EDGE_FUNCTIONS');
  return { functions, functions_config, function_schedules: deploy.function_schedules };
}

export function functionFingerprint(deploy) {
  const payload = functionPayload(deploy);
  for (const config of Object.values(payload.functions_config)) {
    if (config.region === 'us-east-1') config.region = 'iad';
  }
  return JSON.stringify({ functions: sorted(payload.functions), functions_config: sorted(payload.functions_config), function_schedules: payload.function_schedules });
}

function ruleCounts(deploy) {
  const titles = deploy.summary?.messages?.map(message => message.title) || [];
  return {
    redirects: Number(titles.find(title => /^\d+ redirect rules processed$/.test(title))?.match(/^\d+/)?.[0]),
    headers: Number(titles.find(title => /^\d+ header rules processed$/.test(title))?.match(/^\d+/)?.[0]),
  };
}

async function api(method, suffix, body, binary = false) {
  assert(suffix.startsWith('/') && !suffix.startsWith('//'), 'INVALID_API_PATH');
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(`https://api.netlify.com/api/v1${suffix}`, {
      method, redirect: 'error', signal: AbortSignal.timeout(60000),
      headers: { authorization: `Bearer ${process.env.NETLIFY_AUTH_TOKEN}`, 'content-type': binary ? 'application/octet-stream' : 'application/json' },
      ...(body === undefined ? {} : { body: binary ? body : JSON.stringify(body) }),
    });
    if (method === 'GET' && response.status === 429 && attempt < 3) {
      const seconds = Number(response.headers.get('retry-after')) || 10;
      assert(seconds <= 60, 'NETLIFY_RETRY_DELAY_EXCEEDS_LIMIT');
      await response.body?.cancel();
      await delay(seconds * 1000);
      continue;
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`NETLIFY_${method}_${response.status}`);
    }
    assert(!/rel="next"/.test(response.headers.get('link') || ''), 'UNEXPECTED_API_PAGINATION');
    return response.status === 204 ? {} : await response.json();
  }
}

async function immutableBytes(origin, file) {
  assert(/^https:\/\/[a-f0-9]{24}--flex-webb\.netlify\.app$/.test(origin) || origin === LIVE_ORIGIN, 'INVALID_PUBLIC_ORIGIN');
  const route = file === 'index.html' ? '/' : file.endsWith('/index.html') ? `/${file.slice(0, -'index.html'.length)}` : `/${file}`;
  const url = new URL(route, origin);
  const response = await fetch(url, { redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(60000) });
  assert(response.ok, `PUBLIC_FILE_HTTP_${response.status}:${file}`);
  return Buffer.from(await response.arrayBuffer());
}

async function requireBaseline() {
  const site = await api('GET', `/sites/${SITE_ID}`);
  assert(site.id === SITE_ID && site.ssl_url === LIVE_ORIGIN, 'UNEXPECTED_TARGET_SITE');
  assert(site.published_deploy?.id === BASELINE_ID && site.published_deploy?.state === 'ready', 'PRODUCTION_BASELINE_CHANGED');
  assert(site.published_deploy.locked === false, 'PRODUCTION_DEPLOY_LOCKED');
  report.gitBuildsStopped = site.build_settings?.stop_builds === true;
  assert(site.prevent_non_git_prod_deploys !== true, 'MANUAL_PRODUCTION_DEPLOYS_FORBIDDEN');
  return site;
}

async function waitForDeploy(id, states) {
  assert(/^[a-f0-9]{24}$/.test(id), 'INVALID_NEW_DEPLOY_ID');
  const deadline = Date.now() + 10 * 60 * 1000;
  while (Date.now() < deadline) {
    const deploy = await api('GET', `/deploys/${id}`);
    assert(deploy.site_id === SITE_ID, 'DEPLOY_TARGET_MISMATCH');
    assert(typeof deploy.state === 'string', 'DEPLOY_STATE_MISSING');
    assert(!['error','pending_review','rejected'].includes(deploy.state), `DEPLOY_${deploy.state.toUpperCase()}:${id}`);
    if (states.includes(deploy.state)) return deploy;
    await delay(2000);
  }
  throw new Error(`DEPLOY_TIMEOUT:${id}`);
}

async function createSnapshot(files, functions, blobs, draft) {
  const deploy = await api('POST', `/sites/${SITE_ID}/deploys?title=${encodeURIComponent(`Budget application dès 1 990 € — page démarrer uniquement${draft ? ' — vérification' : ''}`)}`, {
    files, ...functions, draft, async: true, branch: 'main',
  });
  assert(/^[a-f0-9]{24}$/.test(deploy.id), 'NEW_DEPLOY_ID_MISSING');
  report[draft ? 'previewId' : 'productionId'] = deploy.id;
  await saveReport();
  const diff = await waitForDeploy(deploy.id, ['prepared','uploading','uploaded','ready']);
  assert(Array.isArray(diff.required), 'DEPLOY_FILE_DIFF_MISSING');
  assert(!diff.required_functions?.length && !diff.required_edge_functions?.length && !diff.required_server?.length, 'CACHED_FUNCTION_OR_SERVER_NOT_REUSABLE');
  const byDigest = new Map([...blobs].map(([name, buffer]) => [sha1(buffer), { name, buffer }]));
  for (const digest of diff.required) assert(byDigest.has(digest), `UNEXPECTED_UPLOAD_REQUIRED:${digest}`);
  for (const digest of new Set(diff.required)) {
    const { name, buffer } = byDigest.get(digest);
    const encoded = name.split('/').map(encodeURIComponent).join('/');
    await api('PUT', `/deploys/${deploy.id}/files/${encoded}?size=${buffer.length}`, buffer, true);
  }
  return waitForDeploy(deploy.id, ['ready']);
}

async function verifySnapshot(deploy, baseline, blobs, assetClosure, files) {
  assert(functionFingerprint(deploy) === functionFingerprint(baseline), 'DEPLOY_FUNCTION_CONTRACT_CHANGED');
  const expectedRules = ruleCounts(baseline), actualRules = ruleCounts(deploy);
  assert(expectedRules.redirects === 445 && expectedRules.headers === 4, 'UNEXPECTED_BASELINE_RULE_COUNTS');
  assert(JSON.stringify(actualRules) === JSON.stringify(expectedRules), 'DEPLOY_REDIRECT_OR_HEADER_COUNT_CHANGED');
  const origin = `https://${deploy.id}--flex-webb.netlify.app`;
  for (const [name, body] of blobs) assert(sha1(await immutableBytes(origin, name)) === sha1(body), `DEPLOY_FILE_MISMATCH:${name}`);
  for (const name of assetClosure) {
    if (!blobs.has(name)) assert(sha1(await immutableBytes(origin, name)) === files[name], `EXISTING_IMPORT_MISMATCH:${name}`);
  }
  for (const name of ['index.html','pricing/index.html','contact/index.html','espace-projet/index.html','robots.txt','sitemap.xml']) {
    assert(files[name], `UNCHANGED_CHECK_FILE_MISSING:${name}`);
    assert(sha1(await immutableBytes(origin, name)) === files[name], `UNRELATED_PAGE_CHANGED:${name}`);
  }
  return origin;
}

export async function main() {
  assert(process.env.GITHUB_REF_NAME === RELEASE_BRANCH, 'WRONG_RELEASE_BRANCH');
  assert(process.env.GITHUB_REPOSITORY === 'ProjetMario/FLEXWEB', 'WRONG_RELEASE_REPOSITORY');
  assert(process.env.NETLIFY_AUTH_TOKEN, 'NETLIFY_AUTH_TOKEN_MISSING');
  assert(process.env.NETLIFY_SITE_ID === SITE_ID, 'WRONG_NETLIFY_SITE_ID');
  await requireBaseline();
  const baseline = await api('GET', `/deploys/${BASELINE_ID}`);
  const functions = functionPayload(baseline);
  const baselineFiles = normalizeFiles(await api('GET', `/sites/${SITE_ID}/files`));
  await requireBaseline();
  const baselineBody = await immutableBytes(BASELINE_ORIGIN, PAGE);
  assert(sha1(baselineBody) === baselineFiles[PAGE], 'BASELINE_HTML_HASH_MISMATCH');
  const { blobs, cssName, assetClosure } = await prepareOverlay(baselineBody.toString('utf8'), path.resolve('dist'), baselineFiles);
  const files = { ...baselineFiles };
  for (const [name, body] of blobs) {
    assert(name === PAGE || !baselineFiles[name], 'EXISTING_FILE_OUTSIDE_FORM_CHANGED');
    files[name] = sha1(body);
  }
  const changed = Object.keys(baselineFiles).filter(name => baselineFiles[name] !== files[name]);
  assert(changed.length === 1 && changed[0] === PAGE, 'RELEASE_SCOPE_EXCEEDED');
  assert(files['netlify.toml'] === baselineFiles['netlify.toml'], 'DEPLOY_CONFIG_CHANGED');
  Object.assign(report, {
    baselineFileCount: Object.keys(baselineFiles).length, candidateFileCount: Object.keys(files).length,
    baselineManifestSha256: manifestDigest(baselineFiles), candidateManifestSha256: manifestDigest(files),
    changedExistingFiles: changed, newFiles: [...blobs.keys()].filter(name => name !== PAGE).sort(),
    stylesheet: cssName, preservedConfigSha1: files['netlify.toml'], preservedFunctions: functions.functions,
    changedFileHashes: Object.fromEntries([...blobs].map(([name, body]) => [name, sha1(body)])),
  });
  await saveReport();
  const preview = await createSnapshot(files, functions, blobs, true);
  report.previewUrl = await verifySnapshot(preview, baseline, blobs, assetClosure, files);
  await requireBaseline();
  const testEnv = { ...process.env, APPLICATION_BUDGET_ORIGIN: report.previewUrl };
  delete testEnv.NETLIFY_AUTH_TOKEN;
  execFileSync(process.execPath, ['--test','tests/application-budget.test.mjs'], { env: testEnv, stdio: 'inherit', timeout: 180000 });
  report.previewVerifiedAt = new Date().toISOString();
  await saveReport();
  await requireBaseline();
  // A new production deploy uses the exact verified snapshot. No restoration,
  // lock/unlock, site configuration change, or branch switch is performed.
  const production = await createSnapshot(files, functions, blobs, false);
  report.productionUrl = await verifySnapshot(production, baseline, blobs, assetClosure, files);
  const site = await api('GET', `/sites/${SITE_ID}`);
  assert(site.published_deploy?.id === production.id, 'NEW_PRODUCTION_NOT_PUBLISHED');
  assert(site.published_deploy.locked === false, 'LOCK_STATE_CHANGED');
  const publishedFiles = normalizeFiles(await api('GET', `/sites/${SITE_ID}/files`));
  assert(manifestDigest(publishedFiles) === manifestDigest(files), 'PUBLISHED_MANIFEST_MISMATCH');
  assert(sha1(await immutableBytes(LIVE_ORIGIN, PAGE)) === files[PAGE], 'CUSTOM_DOMAIN_PAGE_MISMATCH');
  report.publishedAt = new Date().toISOString();
  await saveReport();
  console.log(JSON.stringify({ published: true, url: `${LIVE_ORIGIN}/demarrer/?service=application`, deployId: production.id, changedExistingFiles: changed, report: REPORT }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(async error => {
    report.error = error.message;
    report.failedAt = new Date().toISOString();
    await saveReport();
    console.error(`Application budget release stopped: ${error.message}. See ${REPORT}.`);
    process.exitCode = 1;
  });
}
