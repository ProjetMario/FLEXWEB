import { execFile } from 'node:child_process';
import { readFile, mkdir, rename, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { parse } from 'parse5';

const exec = promisify(execFile);
export const ORIGIN = 'https://flex-web.fr';
export const DEFAULT_KEY = 'indexnow-flexweb-20261001';
export const MAX_URLS = 50;
const sha = value => createHash('sha256').update(value).digest('hex');
const commercial = ['creation-site-internet', 'creation-application-mobile', 'automatisation-ia'].flatMap(service => ['', '-savoie', '-haute-savoie'].map(region => `/${service}${region}/`));
const realizations = ['foot-nation', '2savoie-immo', 'serrurier73'].map(slug => `/realisations/${slug}/`);
const regionalApplications = commercial.filter(route => /^\/creation-application-mobile-(?:savoie|haute-savoie)\/$/.test(route));
const automationGuides = ['assistant-ia-interne-entreprise', 'connecter-demandes-crm', 'automatisation-ou-application-sur-mesure', 'taches-automatiser-pme'].map(slug => `/journal/${slug}/`);
const priorityRoutes = new Set(['/', '/about/', '/pricing/', '/journal/', '/realisations/', ...commercial, ...realizations]);
const dependencies = new Map([
  ['src/pages/[slug].astro', commercial],
  ['src/data/regional-application-briefs.ts', regionalApplications],
  ['src/components/marketing/ApplicationRegionalBrief.astro', regionalApplications],
  ['src/data/journalArticles.json', ['/journal/']],
  ['src/components/JournalListing.jsx', ['/journal/']],
  ['src/layout/AutomationGuideLayout.astro', automationGuides],
  ['src/components/automation/AutomationLanding.astro', commercial.filter(route => route.startsWith('/automatisation-'))],
  ['src/data/automationPages.ts', commercial.filter(route => route.startsWith('/automatisation-'))],
  ['src/pages/realisations/[slug].astro', realizations],
  ['src/data/realizations.ts', ['/realisations/', ...realizations]],
]);
const eligible = pathname => priorityRoutes.has(pathname) || /^\/journal\/[a-z0-9-]+\/$/.test(pathname);

export function normalizedURL(value) {
  if (typeof value !== 'string' || /[\s\\]/.test(value)) throw Error('INVALID_URL');
  const url = new URL(value, ORIGIN);
  if (url.origin !== ORIGIN || url.username || url.password || url.search || url.hash || !eligible(url.pathname)) throw Error('OUT_OF_SCOPE_URL');
  return url.href;
}

export function candidateURLs(files, cmsRoutes = [], explicit = []) {
  if (explicit.length) {
    const selected = [...new Set(explicit.map(normalizedURL))].sort();
    if (selected.length > MAX_URLS) throw Error('TOO_MANY_PRIORITY_URLS');
    return selected;
  }
  const routes = new Set();
  for (const file of files) {
    for (const route of dependencies.get(file) || []) routes.add(route);
    const match = file.match(/^src\/pages\/(.+)\.astro$/);
    if (match && !/[\[\]]/.test(match[1])) {
      const route = `/${match[1].replace(/(?:^|\/)index$/, '')}`.replace(/\/$/, '') + '/';
      if (eligible(route)) routes.add(route);
    }
  }
  for (const route of cmsRoutes) if (eligible(route)) routes.add(route);
  const urls = [...new Set([...routes].map(normalizedURL))].sort();
  if (urls.length > MAX_URLS) throw Error('TOO_MANY_PRIORITY_URLS');
  return urls;
}

const attrs = node => Object.fromEntries((node.attrs || []).map(attr => [attr.name, attr.value]));
const walk = (node, visit) => { visit(node); for (const child of node.childNodes || []) walk(child, visit); };
const text = node => ['script', 'style', 'noscript'].includes(node.tagName) ? '' : node.nodeName === '#text' ? node.value : (node.childNodes || []).map(text).join(' ');
const normalize = value => value.replace(/\s+/g, ' ').trim();
export function pageFingerprint(html, url, robots = '') {
  const document = parse(html);
  const canonicals = [], directives = [], schemas = [];
  let main, title = '', description = '';
  walk(document, node => {
    const attr = attrs(node);
    if (node.tagName === 'main') main ||= node;
    if (node.tagName === 'title') title = normalize(text(node));
    if (node.tagName === 'meta') {
      if (['robots', 'googlebot', 'bingbot'].includes((attr.name || '').toLowerCase())) directives.push(attr.content || '');
      if (attr.name === 'description') description = attr.content || '';
    }
    if (node.tagName === 'link' && (attr.rel || '').toLowerCase().split(/\s+/).includes('canonical')) canonicals.push(attr.href);
    if (node.tagName === 'script' && attr.type === 'application/ld+json') {
      const value = (node.childNodes || []).map(child => child.value || '').join('');
      try { schemas.push(JSON.parse(value)); } catch { throw Error('INVALID_STRUCTURED_DATA'); }
    }
  });
  if (/\b(?:noindex|none)\b/i.test([robots, ...directives].join(','))) throw Error('NOINDEX');
  if (canonicals.length !== 1 || new URL(canonicals[0], url).href !== url) throw Error('CANONICAL_MISMATCH');
  if (!main || !title || !normalize(text(main))) throw Error('MISSING_CONTENT');
  // CSS/JS filenames and navigation changes alone are not a material page update.
  const links = [], images = [];
  walk(main, node => {
    const a = attrs(node);
    if (node.tagName === 'a' && a.href) links.push([normalize(text(node)), a.href]);
    if (node.tagName === 'img') images.push({ src: a.src || '', srcset: a.srcset || '', alt: a.alt || '' });
    if (node.tagName === 'source' && node.parentNode?.tagName === 'picture') images.push({ srcset: a.srcset || '', media: a.media || '', type: a.type || '' });
  });
  return sha(JSON.stringify({ title, description, main: normalize(text(main)), links, images, schemas }));
}

async function jsonFile(filename, fallback) {
  try { return JSON.parse(await readFile(filename, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT' && fallback !== undefined) return fallback; throw error; }
}
async function writeJSON(filename, value) {
  await mkdir(path.dirname(filename), { recursive: true });
  await writeFile(`${filename}.tmp`, JSON.stringify(value, null, 2) + '\n');
  await rename(`${filename}.tmp`, filename);
}
const fetchOptions = () => ({ redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(20000) });
async function markerAt(fetchImpl) {
  const response = await fetchImpl(`${ORIGIN}/.well-known/flexweb-release.json`, fetchOptions());
  if (response.status !== 200) throw Error('PRODUCTION_MARKER_UNAVAILABLE');
  return response.json();
}
function sameMarker(marker, publication) {
  return ['codeCommit', 'snapshotId', 'snapshotSha256'].every(field => marker[field] && marker[field] === publication[field]);
}
async function pageAt(fetchImpl, fetchURL, logicalURL, { previous = false } = {}) {
  const response = await fetchImpl(fetchURL, fetchOptions());
  if (previous && [301, 302, 307, 308, 404, 410].includes(response.status)) return null;
  if (response.status !== 200) throw Error(`PAGE_HTTP_${response.status}`);
  if (!/^text\/html\b/i.test(response.headers.get('content-type') || '')) throw Error('NOT_HTML');
  try { return pageFingerprint(await response.text(), logicalURL, previous ? '' : response.headers.get('x-robots-tag') || ''); }
  catch (error) { if (previous && ['NOINDEX', 'CANONICAL_MISMATCH'].includes(error.message)) return null; throw error; }
}

export async function runIndexNow({ root = process.cwd(), env = process.env, fetchImpl = fetch, diff = async (before, after) => {
  const { stdout } = await exec('git', ['diff', '--name-only', `${before}..${after}`], { cwd: root, maxBuffer: 1024 * 1024 });
  return stdout.trim().split(/\r?\n/).filter(Boolean);
} } = {}) {
  const statePath = env.INDEXNOW_STATE_PATH || path.join(root, '.cms/indexnow-state.json');
  const reportPath = env.INDEXNOW_REPORT_PATH || path.join(root, '.cms/indexnow-report.json');
  const report = { schemaVersion: 2, generatedAt: new Date().toISOString(), status: 'skipped', note: "200 : notification reçue. 202 : notification reçue, validation de clé en attente. Aucun de ces états ne confirme l'indexation.", candidates: [], attempted: [], submitted: [], skipped: [], response: null, error: null };
  let state;
  try {
    const publication = await jsonFile(path.join(root, '.cms/publication-report.json'));
    report.deployId = publication.deployId || null;
    if (publication.status !== 'deployed' || publication.productionVerified !== true) throw Error('PRODUCTION_NOT_VERIFIED');
    if (publication.unchanged === true) {
      report.reason = 'UNCHANGED_PUBLICATION';
      return report;
    }
    if (!/^[a-f0-9]{40}$/.test(publication.codeCommit || '') || !/^[a-f0-9]{40}$/.test(publication.previousCodeCommit || '')) throw Error('MISSING_RELEASE_COMMITS');
    if (!/^[a-f0-9]{24}$/.test(publication.previousDeployId || '')) throw Error('MISSING_PREVIOUS_DEPLOY');
    if (!sameMarker(await markerAt(fetchImpl), publication)) throw Error('PRODUCTION_MARKER_MISMATCH');
    state = await jsonFile(statePath, { schemaVersion: 1, accepted: {}, uncertain: {} });
    if (state.schemaVersion !== 1 || !state.accepted || !state.uncertain) throw Error('INVALID_NOTIFICATION_STATE');
    const files = await diff(publication.previousCodeCommit, publication.codeCommit);
    const rendered = await jsonFile(path.join(root, '.cms/render-report.json'), { changedRoutes: [] });
    report.files = files;
    report.previousCodeCommit = publication.previousCodeCommit;
    report.codeCommit = publication.codeCommit;
    report.candidates = candidateURLs(files, rendered.changedRoutes || [], (env.INDEXNOW_URLS || '').split(',').map(value => value.trim()).filter(Boolean));
    const verified = [];
    for (const url of report.candidates) {
      try {
        const fingerprint = await pageAt(fetchImpl, url, url);
        if (state.accepted[url]?.fingerprint === fingerprint) { report.skipped.push({ url, reason: 'ALREADY_NOTIFIED' }); continue; }
        if (state.uncertain[url]?.fingerprint === fingerprint) { report.skipped.push({ url, reason: 'PREVIOUS_ATTEMPT_UNCERTAIN' }); continue; }
        const previousURL = `https://${publication.previousDeployId}--flex-webb.netlify.app${new URL(url).pathname}`;
        if (await pageAt(fetchImpl, previousURL, url, { previous: true }) === fingerprint) { report.skipped.push({ url, reason: 'CONTENT_UNCHANGED' }); continue; }
        verified.push({ url, fingerprint });
      } catch (error) { report.skipped.push({ url, reason: error.message?.match(/^[A-Z0-9_]+$/) ? error.message : 'PAGE_CHECK_FAILED' }); }
    }
    if (!verified.length) { report.reason = 'NO_CHANGED_VERIFIED_URLS'; return report; }
    const key = env.INDEXNOW_KEY || DEFAULT_KEY;
    if (!/^[a-zA-Z0-9-]{8,128}$/.test(key)) throw Error('INVALID_KEY');
    const keyLocation = `${ORIGIN}/${key}.txt`;
    const keyResponse = await fetchImpl(keyLocation, fetchOptions());
    if (keyResponse.status !== 200 || (await keyResponse.text()).trim() !== key) throw Error('KEY_NOT_VERIFIED');
    if (!sameMarker(await markerAt(fetchImpl), publication)) throw Error('PRODUCTION_CHANGED_DURING_CHECKS');
    report.attempted = verified.map(item => item.url);
    // Persist intent before the request. An interrupted/uncertain POST must not be replayed blindly.
    for (const item of verified) state.uncertain[item.url] = { fingerprint: item.fingerprint, deployId: publication.deployId, attemptedAt: report.generatedAt };
    await writeJSON(statePath, state);
    const response = await fetchImpl('https://api.indexnow.org/indexnow', {
      method: 'POST', redirect: 'error', headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host: 'flex-web.fr', key, keyLocation, urlList: report.attempted }), signal: AbortSignal.timeout(25000),
    });
    report.response = { status: response.status };
    if ([200, 202].includes(response.status)) {
      report.submitted = report.attempted;
      report.status = response.status === 200 ? 'received' : 'key_validation_pending';
      for (const item of verified) {
        state.accepted[item.url] = { fingerprint: item.fingerprint, deployId: publication.deployId, receivedAt: report.generatedAt, status: response.status };
        delete state.uncertain[item.url];
      }
    } else {
      report.status = 'rejected'; report.error = `INDEXNOW_HTTP_${response.status}`;
      // A known rejection is distinct from an ambiguous timeout.
      for (const item of verified) delete state.uncertain[item.url];
    }
    await writeJSON(statePath, state);
  } catch (error) {
    report.status = report.attempted.length ? 'uncertain' : 'blocked';
    report.error = error.message?.match(/^[A-Z0-9_]+$/) ? error.message : 'INDEXNOW_OPERATION_FAILED';
  } finally {
    await writeJSON(reportPath, report);
  }
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const report = await runIndexNow();
  console.log(JSON.stringify({ status: report.status, attempted: report.attempted.length, submitted: report.submitted.length, skipped: report.skipped.length, error: report.error }));
  if (['blocked', 'rejected', 'uncertain'].includes(report.status)) process.exitCode = 1;
}
