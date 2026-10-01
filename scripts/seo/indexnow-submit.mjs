import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import path from 'node:path';

const exec = promisify(execFile);
const root = process.cwd();
const host = 'flex-web.fr';
const baseUrl = `https://${host}`;
const key = process.env.INDEXNOW_KEY || 'indexnow-flexweb-20261001';
const keyLocation = `${baseUrl}/${key}.txt`;
const reportPath = process.env.INDEXNOW_REPORT_PATH || path.join(root, '.cms/indexnow-report.json');

const directRoutes = new Map([
  ['src/pages/creation-site-internet.astro', '/creation-site-internet/'],
  ['src/pages/creation-application-mobile.astro', '/creation-application-mobile/'],
  ['src/pages/automatisation-ia.astro', '/automatisation-ia/'],
  ['src/pages/automatisation-ia-savoie.astro', '/automatisation-ia-savoie/'],
  ['src/pages/automatisation-ia-haute-savoie.astro', '/automatisation-ia-haute-savoie/'],
  ['src/pages/journal/combien-coute-site-internet-savoie.astro', '/journal/combien-coute-site-internet-savoie/'],
  ['src/pages/journal/taches-automatiser-pme.astro', '/journal/taches-automatiser-pme/'],
  ['src/pages/journal/automatisation-ou-application-sur-mesure.astro', '/journal/automatisation-ou-application-sur-mesure/'],
  ['src/data/automationPages.ts', '/automatisation-ia/'],
  ['src/data/search-summary.ts', '/llms.txt'],
]);

const dataRoutes = new Map([
  ['src/data/automationPages.ts', ['/automatisation-ia/', '/automatisation-ia-savoie/', '/automatisation-ia-haute-savoie/']],
  ['src/data/realizations.ts', ['/realisations/foot-nation/', '/realisations/2savoie-immo/', '/realisations/serrurier73/']],
]);

function normalizeFile(file) {
  return file.trim().replace(/^\.\//, '');
}

async function changedFiles() {
  if (process.env.INDEXNOW_URLS) return [];
  const base = process.env.INDEXNOW_BASE_REF || 'HEAD^';
  try {
    const output = await exec('git', ['diff', '--name-only', `${base}..HEAD`], { cwd: root, maxBuffer: 1024 * 1024 });
    return output.stdout.split(/\r?\n/).map(normalizeFile).filter(Boolean);
  } catch {
    return [];
  }
}

function urlListFrom(files) {
  if (process.env.INDEXNOW_URLS) {
    return process.env.INDEXNOW_URLS.split(',').map(value => value.trim()).filter(Boolean).map(value => value.startsWith('http') ? value : `${baseUrl}${value.startsWith('/') ? value : `/${value}`}`);
  }
  const routes = new Set();
  for (const file of files) {
    if (directRoutes.has(file)) routes.add(directRoutes.get(file));
    if (dataRoutes.has(file)) for (const route of dataRoutes.get(file)) routes.add(route);
    if (file === 'src/pages/realisations/[slug].astro') for (const route of dataRoutes.get('src/data/realizations.ts')) routes.add(route);
  }
  return [...routes].map(route => `${baseUrl}${route}`);
}

async function verifyLive(urls) {
  const verified = [];
  const skipped = [];
  for (const url of urls) {
    try {
      const response = await fetch(url, { redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(20000) });
      const robots = response.headers.get('x-robots-tag') || '';
      if (response.status === 200 && !/noindex/i.test(robots)) verified.push(url);
      else skipped.push({ url, status: response.status, robots });
    } catch (error) {
      skipped.push({ url, error: error.name || 'FETCH_FAILED' });
    }
  }
  return { verified, skipped };
}

async function submit(urls) {
  if (urls.length === 0) return null;
  const response = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host, key, keyLocation, urlList: urls.slice(0, 10000) }),
    signal: AbortSignal.timeout(25000),
  });
  return { status: response.status, ok: response.ok, body: await response.text().catch(() => '') };
}

const files = await changedFiles();
const candidates = [...new Set(urlListFrom(files))];
const { verified, skipped } = await verifyLive(candidates);
let submission = null;
let error = null;
try {
  submission = await submit(verified);
} catch (cause) {
  error = cause.name || 'INDEXNOW_SUBMIT_FAILED';
}

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  note: "Une réponse reçue par IndexNow confirme la réception ou la validation de la clé, pas l'indexation.",
  files,
  candidates,
  submitted: verified,
  skipped,
  response: submission,
  error,
};
await mkdir(path.dirname(reportPath), { recursive: true });
await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ submitted: verified.length, skipped: skipped.length, status: submission?.status || null, error }));
