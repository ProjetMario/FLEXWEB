#!/usr/bin/env node
/** Nova Habitat: atomic, non-destructive storefront update on the existing site.
 * Authentication uses the official SDK (OAuth ticket or an environment token).
 * Never reads CLI credential files; never stores credentials in this repository.
 */
import { NetlifyAPI } from '@netlify/api';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SITE_ID = '5215a04e-7872-45e3-b354-fc8f994d2219';
const SITE_NAME = 'nova-habitat-demo-flexweb';
const LIVE = `https://${SITE_NAME}.netlify.app`;
const FORM_NAME = 'nova-habitat-devis-v2';
const PATCH = ['index.html', 'nova-v2.css', 'nova-v2.js', 'nova-forms.html', 'merci-nova.html'];
const REQUIRED_FUNCTIONS = ['chat', 'crm', 'file', 'speech', 'transcribe', 'upload'];
const args = process.argv.slice(2);
const production = args.includes('--prod');
const ticketIndex = args.indexOf('--ticket');
const ticketId = ticketIndex >= 0 ? args[ticketIndex + 1] : null;
const hash = (b, algorithm = 'sha1') => createHash(algorithm).update(b).digest('hex');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const check = (condition, message) => { if (!condition) throw new Error(message); };
const compact = object => Object.fromEntries(Object.entries(object).filter(([, value]) => value !== null && value !== undefined));
const report = { site: LIVE, published: false, notificationDeliveryTested: false };

async function bytes(url, maxBytes = 12 * 1024 * 1024) {
  const response = await fetch(url, { signal: AbortSignal.timeout(40000), headers: { 'User-Agent': 'NovaHabitatDeployment/2.0' } });
  check(response.ok, `HTTP ${response.status}: ${new URL(url).pathname}`);
  check(Number(response.headers.get('content-length') || 0) <= maxBytes, 'Asset exceeds maximum size');
  const result = Buffer.from(await response.arrayBuffer());
  check(result.length <= maxBytes, 'Asset exceeds maximum size');
  return result;
}

function functionConfiguration(fn) {
  return compact({
    display_name: fn.dn, generator: fn.g, build_data: fn.bd,
    memory: fn.m, priority: fn.p, region: fn.rg,
    routes: (fn.ro || []).map(route => compact({
      pattern: route.p, literal: route.l, expression: route.e,
      methods: route.m, prefer_static: route.ps
    }))
  });
}

async function ready(api, id) {
  const deadline = Date.now() + 180000;
  while (Date.now() < deadline) {
    const deploy = await api.getDeploy({ deploy_id: id });
    if (deploy.state === 'ready') return deploy;
    check(!['error', 'rejected', 'canceled'].includes(deploy.state), `Deploy ${id} failed: ${deploy.state}`);
    await sleep(1800);
  }
  throw new Error(`Deployment ${id} did not become ready before the timeout; inspect it before trying again.`);
}

function checkFunctions(base, deploy) {
  const original = base.available_functions || [];
  const current = new Map((deploy.available_functions || []).map(fn => [fn.n, fn]));
  check(current.size === original.length, 'Function count changed; refusing publication');
  for (const fn of original) {
    const candidate = current.get(fn.n);
    check(candidate && candidate.d === fn.d, `Function not preserved: ${fn.n}`);
    check(candidate.r === fn.r, `Function runtime changed: ${fn.n}`);
    check(candidate.im === fn.im, `Invocation mode changed: ${fn.n}`);
    const routeKey = routes => JSON.stringify((routes || []).map(r => compact({ p: r.p, l: r.l, e: r.e, m: r.m, ps: r.ps })).sort((a, b) => String(a.p).localeCompare(String(b.p))));
    check(routeKey(candidate.ro) === routeKey(fn.ro), `Function routing changed: ${fn.n}`);
  }
}

function processedRules(deploy, kind) {
  const messages = deploy.summary?.messages || [];
  for (const message of messages) {
    const found = String(message.title || '').match(new RegExp(`(\\d+) ${kind} rules processed`));
    if (found) return Number(found[1]);
  }
  return null;
}

async function verify(api, base, candidate, publicUrl, patches, originalFiles, logoHash) {
  checkFunctions(base, candidate);
  for (const kind of ['redirect', 'header']) {
    const before = processedRules(base, kind);
    const after = processedRules(candidate, kind);
    if (before !== null) check(after === before, `${kind} rules changed (${before} -> ${after})`);
  }
  const home = (await bytes(`${publicUrl}/`)).toString('utf8');
  for (const marker of ['id="curage"', 'id="toiture"', 'id="jardins"', 'id="devis"', 'Chambéry', 'Aix-les-Bains', FORM_NAME]) {
    check(home.includes(marker), `Missing page content: ${marker}`);
  }
  check(home.includes('tel:+33784971152'), 'Direct call link missing');
  check((home.match(/pas une réalisation Nova Habitat/g) || []).length >= 3, 'AI illustration disclosures missing');
  check(!home.includes('data-preview="true"'), 'Preview-only form found on deployed page');
  const logo = await bytes(`${publicUrl}/logo-nova-habitat.jpg`);
  check(hash(logo, 'sha256') === logoHash, 'Logo bytes changed');
  for (const [path, content] of patches) {
    if (path.endsWith('.html')) continue;
    check(hash(await bytes(`${publicUrl}${path}`)) === hash(content), `Published asset differs: ${path}`);
  }
  for (const path of ['/admin/index.html', '/admin/app.js', '/admin/admin.css', '/nova-habitat.vcf', '/favicon.svg']) {
    const original = originalFiles.find(file => file.path === path);
    if (!original) continue;
    const requestPath = path === '/admin/index.html' ? '/admin/' : path;
    check(hash(await bytes(`${publicUrl}${requestPath}`)) === original.sha, `Protected resource changed: ${path}`);
  }
  const skeleton = (await bytes(`${publicUrl}/nova-forms.html`)).toString('utf8');
  check(skeleton.includes(FORM_NAME), 'Static form endpoint is not served');
  const thanks = (await bytes(`${publicUrl}/merci-nova`)).toString('utf8');
  check(thanks.includes('Merci pour'), 'Confirmation page is not served');
  const forms = await api.listSiteForms({ site_id: SITE_ID });
  const form = forms.find(item => item.name === FORM_NAME);
  check(Boolean(form), 'Netlify has not registered the quotation form');
  report.formId = form.id;
}

async function createAndUpload(api, manifest, patches, draft) {
  const deploy = await api.createSiteDeploy({
    site_id: SITE_ID,
    title: `Nova Habitat — refonte GitHub — ${draft ? 'validation' : 'publication'}`,
    body: { ...manifest, draft, async: false }
  });
  check(Boolean(deploy.id), 'Missing new deploy ID');
  console.log(JSON.stringify({ phase: draft ? 'preview-created' : 'production-created', deployId: deploy.id }));
  if (draft) report.previewId = deploy.id; else report.productionId = deploy.id;
  check(!(deploy.required_functions || []).length, 'Netlify requires a function bundle that is not locally available; nothing will be uploaded');
  check(!(deploy.required_edge_functions || []).length && !(deploy.required_server || []).length, 'Unexpected backend upload requested');
  const byHash = new Map([...patches].map(([path, content]) => [hash(content), { path, content }]));
  for (const sha of deploy.required || []) {
    const file = byHash.get(sha);
    check(Boolean(file), 'Netlify requires an original protected file; refusing incomplete deployment');
    await api.uploadDeployFile({ deploy_id: deploy.id, path: file.path.replace(/^\//, ''), size: file.content.length, body: file.content });
  }
  return ready(api, deploy.id);
}

async function main() {
  const assets = JSON.parse(await readFile(resolve(ROOT, 'assets.json'), 'utf8'));
  check(assets.site_id === SITE_ID, 'Unexpected target site in asset manifest');
  const patches = new Map();
  for (const name of PATCH) patches.set(`/${name}`, await readFile(resolve(ROOT, 'site', name)));
  for (const image of assets.images) {
    check(/^nova-assets\/[a-z-]+\.webp$/.test(image.file), 'Unexpected image destination');
    check(new URL(image.url).origin === 'https://v3b.fal.media', 'Unexpected original image host');
    let imageBytes;
    try { imageBytes = await bytes(image.url); }
    catch { imageBytes = await bytes(`${LIVE}/${image.file}`); }
    check(imageBytes.subarray(0, 4).toString() === 'RIFF' && imageBytes.subarray(8, 12).toString() === 'WEBP', 'Invalid WebP file');
    patches.set(`/${image.file}`, imageBytes);
  }
  const logo = await bytes(`${LIVE}/logo-nova-habitat.jpg`);
  check(hash(logo, 'sha256') === assets.logo_sha256, 'The original logo no longer matches the approved file');
  const api = new NetlifyAPI(process.env.NETLIFY_AUTH_TOKEN || undefined);
  if (!process.env.NETLIFY_AUTH_TOKEN) {
    check(ticketId && /^[a-zA-Z0-9-]+$/.test(ticketId), 'Authentication required: provide --ticket or NETLIFY_AUTH_TOKEN');
    const ticket = await api.showTicket({ ticketId });
    if (!ticket.authorized) {
      console.log(JSON.stringify({ published: false, status: 'authorization-pending', site: LIVE }));
      return;
    }
    // The SDK exchanges the approved OAuth ticket and holds the access token in memory.
    await api.getAccessToken({ id: ticketId }, { timeout: 30000, poll: 1000 });
  }
  const site = await api.getSite({ site_id: SITE_ID });
  check(site.id === SITE_ID && site.name === SITE_NAME, 'Authenticated project does not match Nova Habitat');
  check(!site.build_settings?.repo_url && !site.build_settings?.repo_path, 'A Git deployment is connected; integrate with it before using this manual publisher');
  const baseId = site.published_deploy?.id;
  check(Boolean(baseId), 'No existing published deploy found');
  const base = await api.getDeploy({ deploy_id: baseId });
  check(base.state === 'ready' && base.site_id === SITE_ID, 'Original deployment is not ready');
  check(!base.locked, 'The production deployment is locked; no change made');
  check(!base.edge_functions_present && !(base.required_server || []).length, 'Unrecognized backend configuration; no change made');
  const functions = base.available_functions || [];
  for (const name of REQUIRED_FUNCTIONS) check(functions.some(fn => fn.n === name && fn.d), `Missing original function: ${name}`);
  const originalFiles = await api.listSiteFiles({ site_id: SITE_ID });
  check(Array.isArray(originalFiles) && originalFiles.length > 0, 'Could not read original file manifest');
  for (const file of originalFiles) check(file.deploy_id === baseId, 'The site changed while its files were being read');
  for (const path of ['/logo-nova-habitat.jpg', '/netlify.toml', '/admin/index.html', '/admin/app.js']) {
    check(originalFiles.some(file => file.path === path), `Missing protected source: ${path}`);
  }
  const files = Object.fromEntries(originalFiles.map(file => [file.path, file.sha]));
  for (const [path, content] of patches) files[path] = hash(content);
  const manifest = {
    files,
    functions: Object.fromEntries(functions.map(fn => [fn.n, fn.d])),
    functions_config: Object.fromEntries(functions.map(fn => [fn.n, functionConfiguration(fn)])),
    function_schedules: base.function_schedules || []
  };
  report.baseId = baseId;
  report.preservedFunctions = functions.map(fn => fn.n);
  report.originalFileCount = originalFiles.length;
  report.newFileCount = Object.keys(files).length;
  report.logoSHA256 = assets.logo_sha256;
  const preview = await createAndUpload(api, manifest, patches, true);
  const previewUrl = `https://${preview.id}--${SITE_NAME}.netlify.app`;
  report.previewUrl = previewUrl;
  await verify(api, base, preview, previewUrl, patches, originalFiles, assets.logo_sha256);
  report.previewVerified = true;
  console.log(JSON.stringify({ phase: 'preview-verified', url: previewUrl, preservedFunctions: report.preservedFunctions }));
  if (production) {
    const fresh = await api.getSite({ site_id: SITE_ID });
    check(fresh.published_deploy?.id === baseId, 'Production changed during verification; refusing to overwrite another update');
    const published = await createAndUpload(api, manifest, patches, false);
    await verify(api, base, published, LIVE, patches, originalFiles, assets.logo_sha256);
    const current = await api.getSite({ site_id: SITE_ID });
    check(current.published_deploy?.id === published.id, 'The verified deployment is not the active production deployment');
    report.published = true;
    report.productionId = published.id;
  }
  // No automatic rollback. A failed draft never changes the published site.
  await mkdir(resolve(ROOT, '.work'), { recursive: true });
  await writeFile(resolve(ROOT, '.work/deploy-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch(async error => {
  report.error = String(error.message || 'Deployment failed');
  if (error.status) report.httpStatus = error.status;
  await mkdir(resolve(ROOT, '.work'), { recursive: true }).catch(() => {});
  await writeFile(resolve(ROOT, '.work/deploy-report.json'), JSON.stringify(report, null, 2)).catch(() => {});
  console.error(JSON.stringify(report, null, 2));
  process.exitCode = 1;
});
