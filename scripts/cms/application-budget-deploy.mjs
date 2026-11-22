import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { parse } from 'parse5';
import { verifyAutomationProxy } from './automation-probe.mjs';

// A one-page, forward-only release. The complete published file manifest is
// reused. The three existing functions are repackaged from their verified,
// unchanged source files with a pinned toolchain and their original contract.
// API contracts: https://open-api.netlify.com/#operation/createSiteDeploy
// Netlify CLI uploads its resolved redirects/headers as a netlify.toml file:
// https://github.com/netlify/cli/blob/main/src/utils/deploy/hash-config.ts
export const SITE_ID = '5f0ec4e5-fe16-4ef3-8380-9b8aff26edbb';
export const BASELINE_ID = '6b0351ea3487f53fe092430a';
export const RELEASE_BRANCH = 'codex/application-budget-live-20261122';
const PAGE = 'demarrer/index.html';
const PREVIOUS_FORM_ID = '6b033560dd766682f3ea02a4';
const PREVIOUS_FORM_ORIGIN = `https://${PREVIOUS_FORM_ID}--flex-webb.netlify.app`;
const LIVE_ORIGIN = 'https://flex-web.fr';
const BASELINE_ORIGIN = `https://${BASELINE_ID}--flex-webb.netlify.app`;
const REPORT = '.cms/application-budget-deploy-report.json';
const EXPECTED_FUNCTIONS = {
  'automation-clock': 'de2ce9d47d9eca7800505e877d80745633feb798d29d02162f7809e4fab2b1fa',
  automation: '65977d91fcd9898f213b1d32b9b7cbbe1f055935ad3249ed45af960d62358c86',
};
const EXPECTED_FUNCTION_SOURCES = {
  'netlify/functions/automation-clock.ts': '4f7f639af5d13e16c17a61a261928c5524a5f0a3',
  'netlify/functions/automation.ts': '0bcdf362121f0ff4485a2ea8c30bfe85baf15898',
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
  const response = await fetch(`${PREVIOUS_FORM_ORIGIN}/demarrer/?service=application`, { redirect: 'error', signal: AbortSignal.timeout(30000) });
  assert(response.status === 200, 'OLDER_FORM_PAGE_NOT_AVAILABLE');
  const candidateHtml = await response.text();
  assert(candidateHtml.includes('Votre devis gratuit.') && !candidateHtml.includes('Votre projet, étape par étape'), 'UNEXPECTED_OLDER_FORM');
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
    const assetResponse = await fetch(`${PREVIOUS_FORM_ORIGIN}/${name}`, { redirect: 'error', signal: AbortSignal.timeout(30000) });
    assert(assetResponse.status === 200 && (assetResponse.headers.get('content-length') === null || Number(assetResponse.headers.get('content-length')) < 6000000), `OLDER_FORM_ASSET_INVALID:${name}`);
    const body = Buffer.from(await assetResponse.arrayBuffer());
    assert(body.length > 0 && body.length < 6000000, `OLDER_FORM_ASSET_SIZE:${name}`);
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
  const cssHref = candidateHtml.match(/<link\b[^>]*href="(\/_astro\/application-budget\.[A-Za-z0-9]+\.css)"/i)?.[1];
  assert(cssHref, 'OLDER_FORM_STYLESHEET_MISSING');
  const cssResponse = await fetch(`${PREVIOUS_FORM_ORIGIN}${cssHref}`, { redirect: 'error', signal: AbortSignal.timeout(30000) });
  assert(cssResponse.status === 200, 'OLDER_FORM_STYLESHEET_UNAVAILABLE');
  const stylesheet = Buffer.from(await cssResponse.arrayBuffer());
  assert(stylesheet.length > 0 && stylesheet.length < 1000000, 'OLDER_FORM_STYLESHEET_SIZE');
  assert(!/@import\b|url\s*\(/i.test(stylesheet.toString('utf8')), 'FORM_STYLESHEET_MUST_BE_SELF_CONTAINED');
  const cssName = cssHref.slice(1);
  assert(!baselineFiles[cssName] || baselineFiles[cssName] === sha1(stylesheet), 'FORM_STYLESHEET_COLLISION');
  if (!baselineFiles[cssName]) blobs.set(cssName, stylesheet);
  const link = `<link rel="stylesheet" href="/${cssName}">`;
  const existingStylesheets = nodes(parse(baselineHtml)).filter(node => node.tagName === 'link'
    && node.attrs?.some(attr => attr.name === 'href' && /^\/_astro\/application-budget\.[^/]+\.css$/.test(attr.value)));
  assert(existingStylesheets.length <= 1, 'DUPLICATE_FORM_STYLESHEET');
  assert(!existingStylesheets.length || existingStylesheets[0].attrs.some(attr => attr.name === 'href' && attr.value === `/${cssName}`), 'EXISTING_FORM_STYLESHEET_CHANGED');
  const addStylesheet = existingStylesheets.length === 0;
  let html = baselineHtml.slice(0, before.start) + after.source + baselineHtml.slice(before.end);
  assert(html.includes('</head>'), 'INVALID_BASELINE_HTML');
  if (addStylesheet) html = html.replace('</head>', `${link}</head>`);
  // This check proves that everything outside the form island and its style
  // link is the original deployed HTML, including consent and analytics tags.
  const changedIsland = startProjectIsland(html);
  const restoredIsland = html.slice(0, changedIsland.start) + before.source + html.slice(changedIsland.end);
  const restored = addStylesheet ? restoredIsland.replace(link, '') : restoredIsland;
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

export function functionPayload(deploy, expectedDigests = EXPECTED_FUNCTIONS) {
  const functions = Object.create(null), functions_config = Object.create(null);
  assert(Array.isArray(deploy.available_functions) && deploy.available_functions.length === 2, 'UNEXPECTED_FUNCTION_INVENTORY');
  for (const fn of deploy.available_functions) {
    assert(Object.hasOwn(EXPECTED_FUNCTIONS, fn.n) && expectedDigests[fn.n] === fn.d, `UNEXPECTED_FUNCTION_DIGEST:${fn.n}`);
    assert(fn.r === 'nodejs24.x' && fn.im === 'stream', `UNEXPECTED_FUNCTION_RUNTIME:${fn.n}`);
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
  assert(JSON.stringify(sorted(functions)) === JSON.stringify(sorted(expectedDigests)), 'FUNCTION_INVENTORY_CHANGED');
  assert(JSON.stringify(deploy.function_schedules) === '[{"name":"automation-clock","cron":"*/10 * * * *"}]', 'FUNCTION_SCHEDULE_CHANGED');
  assert(!deploy.edge_functions_present && !deploy.server, 'UNEXPECTED_SERVER_OR_EDGE_FUNCTIONS');
  return { functions, functions_config, function_schedules: deploy.function_schedules };
}

export function functionFingerprint(deploy, expectedDigests = EXPECTED_FUNCTIONS) {
  const payload = functionPayload(deploy, expectedDigests);
  for (const config of Object.values(payload.functions_config)) {
    if (config.region === 'us-east-1') config.region = 'iad';
  }
  return JSON.stringify({ names: Object.keys(payload.functions).sort(), functions_config: sorted(payload.functions_config), function_schedules: payload.function_schedules });
}

export async function loadRebuiltFunctions(baseline) {
  const manifest = JSON.parse(await fs.readFile('.cms/application-budget-functions.json', 'utf8'));
  assert(manifest.schemaVersion === 1, 'INVALID_FUNCTION_BUILD_MANIFEST');
  assert(manifest.packaging?.zisi === '14.3.1' && manifest.packaging?.bootstrap === '2.24.0', 'UNPINNED_FUNCTION_TOOLCHAIN');
  assert(JSON.stringify(sorted(manifest.sourceBlobHashes || {})) === JSON.stringify(sorted(EXPECTED_FUNCTION_SOURCES)), 'FUNCTION_SOURCE_MANIFEST_CHANGED');
  for (const [name, expected] of Object.entries(EXPECTED_FUNCTION_SOURCES)) {
    const source = await fs.readFile(name);
    const digest = sha1(Buffer.concat([Buffer.from(`blob ${source.length}\0`), source]));
    assert(digest === expected, `FUNCTION_SOURCE_CHANGED:${name}`);
  }
  const baselinePayload = functionPayload(baseline);
  assert(Array.isArray(manifest.functions) && manifest.functions.length === 2, 'INVALID_BUILT_FUNCTION_INVENTORY');
  const digests = Object.create(null), bundles = new Map();
  for (const fn of manifest.functions) {
    assert(Object.hasOwn(EXPECTED_FUNCTIONS, fn.name) && !bundles.has(fn.name), 'UNEXPECTED_BUILT_FUNCTION_NAME');
    assert(fn.runtime === 'nodejs24.x' && fn.invocationMode === 'stream', `BUILT_FUNCTION_RUNTIME_CHANGED:${fn.name}`);
    assert(fn.bootstrapVersion === '2.24.0' && fn.runtimeAPIVersion === 2 && fn.priority === 10, `BUILT_FUNCTION_PACKAGING_CHANGED:${fn.name}`);
    const expectedPaths = (baselinePayload.functions_config[fn.name].routes || []).map(route => route.pattern).sort();
    const builtPaths = (fn.routes || []).map(route => route.pattern).sort();
    assert(JSON.stringify(builtPaths) === JSON.stringify(expectedPaths), `BUILT_FUNCTION_ROUTES_CHANGED:${fn.name}`);
    const schedule = baselinePayload.function_schedules.find(entry => entry.name === fn.name)?.cron || null;
    assert((fn.schedule || null) === schedule, `BUILT_FUNCTION_SCHEDULE_CHANGED:${fn.name}`);
    assert(fn.path === `.cms/application-budget-functions/${fn.name}.zip` && /^[a-f0-9]{64}$/.test(fn.sha256), 'INVALID_FUNCTION_BUNDLE_PATH_OR_HASH');
    const stat = await fs.lstat(fn.path);
    assert(stat.isFile() && !stat.isSymbolicLink() && stat.size > 1000 && stat.size < 10 * 1024 * 1024, 'INVALID_FUNCTION_BUNDLE_FILE');
    const body = await fs.readFile(fn.path);
    assert(sha256(body) === fn.sha256, `FUNCTION_BUNDLE_HASH_MISMATCH:${fn.name}`);
    digests[fn.name] = fn.sha256;
    bundles.set(fn.name, { name: fn.name, digest: fn.sha256, body });
  }
  assert(JSON.stringify(Object.keys(digests).sort()) === JSON.stringify(Object.keys(EXPECTED_FUNCTIONS).sort()), 'BUILT_FUNCTION_INVENTORY_CHANGED');
  return {
    payload: { ...baselinePayload, functions: digests }, digests, bundles,
    evidence: {
      sourceBlobHashes: EXPECTED_FUNCTION_SOURCES, packaging: manifest.packaging,
      functions: [...bundles.values()].map(({ name, digest, body }) => ({ name, previousSha256: EXPECTED_FUNCTIONS[name], sha256: digest, size: body.length, runtime: 'nodejs24.x', invocationMode: 'stream' })),
    },
  };
}

function ruleCounts(deploy) {
  const titles = deploy.summary?.messages?.map(message => message.title) || [];
  return {
    redirects: Number(titles.find(title => /^\d+ redirect rules processed$/.test(title))?.match(/^\d+/)?.[0]),
    headers: Number(titles.find(title => /^\d+ header rules? processed$/.test(title))?.match(/^\d+/)?.[0]),
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
  assert([false, null].includes(site.published_deploy.locked), 'PRODUCTION_DEPLOY_LOCKED');
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

async function createSnapshot(files, rebuilt, blobs, draft) {
  const functions = rebuilt.payload;
  // Follow Netlify CLI's two-phase API flow: reserve a deploy, then submit the
  // immutable digest with the baseline's full function deployment contract.
  const deploy = await api('POST', `/sites/${SITE_ID}/deploys?title=${encodeURIComponent(`Formulaire application simplifié — page démarrer uniquement${draft ? ' — vérification' : ''}`)}`, {
    draft, branch: 'main',
  });
  assert(/^[a-f0-9]{24}$/.test(deploy.id), 'NEW_DEPLOY_ID_MISSING');
  report[draft ? 'previewId' : 'productionId'] = deploy.id;
  await saveReport();
  const initialized = await api('PUT', `/sites/${SITE_ID}/deploys/${deploy.id}`, {
    files, ...functions, draft, async: true, branch: 'main',
  });
  assert(initialized.id === deploy.id && initialized.site_id === SITE_ID, 'DEPLOY_UPDATE_TARGET_MISMATCH');
  const diff = await waitForDeploy(deploy.id, ['prepared','uploading','uploaded','ready']);
  assert(Array.isArray(diff.required), 'DEPLOY_FILE_DIFF_MISSING');
  assert(Array.isArray(diff.required_functions), 'DEPLOY_FUNCTION_DIFF_MISSING');
  report[draft ? 'previewRequiredFunctions' : 'productionRequiredFunctions'] = diff.required_functions;
  await saveReport();
  assert(!diff.required_edge_functions?.length && !diff.required_server?.length, 'UNEXPECTED_EDGE_OR_SERVER_UPLOAD');
  const functionsByDigest = new Map([...rebuilt.bundles.values()].map(bundle => [bundle.digest, bundle]));
  for (const digest of diff.required_functions) assert(functionsByDigest.has(digest), `UNEXPECTED_FUNCTION_UPLOAD_REQUIRED:${digest}`);
  const byDigest = new Map([...blobs].map(([name, buffer]) => [sha1(buffer), { name, buffer }]));
  for (const digest of diff.required) assert(byDigest.has(digest), `UNEXPECTED_UPLOAD_REQUIRED:${digest}`);
  const functionUploads = [];
  report[draft ? 'previewFunctionUploads' : 'productionFunctionUploads'] = functionUploads;
  for (const digest of new Set(diff.required_functions)) {
    const { name, body } = functionsByDigest.get(digest);
    assert(Object.hasOwn(EXPECTED_FUNCTIONS, name) && sha256(body) === digest, 'FUNCTION_UPLOAD_BYTES_CHANGED');
    const parameters = new URLSearchParams({ runtime: 'nodejs24.x', invocation_mode: 'stream', size: String(body.length) });
    await api('PUT', `/deploys/${deploy.id}/functions/${encodeURIComponent(name)}?${parameters}`, body, true);
    functionUploads.push({ name, sha256: digest, bytes: body.length });
    await saveReport();
  }
  for (const digest of new Set(diff.required)) {
    const { name, buffer } = byDigest.get(digest);
    const encoded = name.split('/').map(encodeURIComponent).join('/');
    await api('PUT', `/deploys/${deploy.id}/files/${encoded}?size=${buffer.length}`, buffer, true);
  }
  return waitForDeploy(deploy.id, ['ready']);
}

async function verifySnapshot(deploy, baseline, blobs, assetClosure, files, rebuilt) {
  assert(functionFingerprint(deploy, rebuilt.digests) === functionFingerprint(baseline), 'DEPLOY_FUNCTION_CONTRACT_CHANGED');
  const expectedRules = ruleCounts(baseline), actualRules = ruleCounts(deploy);
  assert(expectedRules.redirects === 444 && expectedRules.headers === 1, 'UNEXPECTED_BASELINE_RULE_COUNTS');
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

async function retiredResponse(origin) {
  const response = await fetch(`${origin}/journal/dyson-pencilvac`, {
    method: 'GET', redirect: 'error', credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(20000),
  });
  assert(response.status === 410, 'RETIRED_CONTENT_STATUS_CHANGED');
  const body = Buffer.from(await response.arrayBuffer());
  assert(body.length > 0 && body.length < 65536, 'RETIRED_CONTENT_BODY_INVALID');
  const headers = Object.fromEntries([
    'content-type', 'cache-control', 'netlify-cdn-cache-control', 'x-robots-tag',
    'x-content-type-options', 'x-frame-options', 'referrer-policy',
  ].map(name => [name, response.headers.get(name)?.replace(/\s*,\s*/g, ',').trim() || null]));
  assert(headers['content-type']?.startsWith('text/html') && headers['x-robots-tag']?.includes('noindex'), 'RETIRED_CONTENT_HEADERS_INVALID');
  return { status: response.status, bodySha256: sha256(body), headers };
}

export async function main() {
  assert(process.env.GITHUB_REF_NAME === RELEASE_BRANCH, 'WRONG_RELEASE_BRANCH');
  assert(process.env.GITHUB_REPOSITORY === 'ProjetMario/FLEXWEB', 'WRONG_RELEASE_REPOSITORY');
  assert(process.env.NETLIFY_AUTH_TOKEN, 'NETLIFY_AUTH_TOKEN_MISSING');
  assert(process.env.NETLIFY_SITE_ID === SITE_ID, 'WRONG_NETLIFY_SITE_ID');
  await requireBaseline();
  const baseline = await api('GET', `/deploys/${BASELINE_ID}`);
  const rebuilt = await loadRebuiltFunctions(baseline);
  report.rebuiltFunctions = rebuilt.evidence;
  // The latest CLI production deploy returns 405 on its immutable URL,
  // unlike the previous API deploy. Treat this read-only probe as baseline
  // evidence rather than changing or weakening its routing.
  const baselineResponse = await fetch(`${BASELINE_ORIGIN}/api/automation/intake`, {
    method: 'GET', redirect: 'error', signal: AbortSignal.timeout(20000),
  });
  const baselineResponseBody = await baselineResponse.json();
  assert(baselineResponse.status === 405 && baselineResponseBody.error === 'Méthode non acceptée.'
    && baselineResponse.headers.get('content-type')?.includes('application/json')
    && baselineResponse.headers.get('cache-control')?.includes('no-store'), 'BASELINE_PROXY_UNEXPECTED');
  report.baselineProxy = {status:405, method:'GET', error:baselineResponseBody.error};
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
    stylesheet: cssName, preservedConfigSha1: files['netlify.toml'], rebuiltFunctionDigests: rebuilt.digests,
    changedFileHashes: Object.fromEntries([...blobs].map(([name, body]) => [name, sha1(body)])),
  });
  await saveReport();
  const preview = await createSnapshot(files, rebuilt, blobs, true);
  report.previewUrl = await verifySnapshot(preview, baseline, blobs, assetClosure, files, rebuilt);
  report.previewProxy = await verifyAutomationProxy(report.previewUrl);
  await requireBaseline();
  const testEnv = { ...process.env, APPLICATION_BUDGET_ORIGIN: report.previewUrl };
  delete testEnv.NETLIFY_AUTH_TOKEN;
  execFileSync(process.execPath, ['--test','tests/application-budget.test.mjs'], { env: testEnv, stdio: 'inherit', timeout: 180000 });
  report.previewVerifiedAt = new Date().toISOString();
  await saveReport();
  await requireBaseline();
  // A new production deploy uses the exact verified snapshot. No restoration,
  // lock/unlock, site configuration change, or branch switch is performed.
  const production = await createSnapshot(files, rebuilt, blobs, false);
  report.productionUrl = await verifySnapshot(production, baseline, blobs, assetClosure, files, rebuilt);
  const site = await api('GET', `/sites/${SITE_ID}`);
  assert(site.published_deploy?.id === production.id, 'NEW_PRODUCTION_NOT_PUBLISHED');
  assert([false, null].includes(site.published_deploy.locked), 'LOCK_STATE_CHANGED');
  const publishedFiles = normalizeFiles(await api('GET', `/sites/${SITE_ID}/files`));
  assert(manifestDigest(publishedFiles) === manifestDigest(files), 'PUBLISHED_MANIFEST_MISMATCH');
  assert(sha1(await immutableBytes(LIVE_ORIGIN, PAGE)) === files[PAGE], 'CUSTOM_DOMAIN_PAGE_MISMATCH');
  report.liveProxy = await verifyAutomationProxy(LIVE_ORIGIN);
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
