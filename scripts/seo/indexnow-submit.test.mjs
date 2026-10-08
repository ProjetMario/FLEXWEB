import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runIndexNow, candidateURLs, normalizedURL, pageFingerprint, ORIGIN, DEFAULT_KEY } from './indexnow-submit.mjs';

const route = '/creation-site-internet/';
const url = ORIGIN + route;
const html = (content = 'Texte utile', canonical = url, extra = '') => `<html><head><title>Site internet</title><link rel="canonical" href="${canonical}">${extra}</head><body><main><h1>${content}</h1></main></body></html>`;
async function fixture(t, overrides = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'flexweb-indexnow-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, '.cms'));
  const publication = { status: 'deployed', productionVerified: true, previousDeployId: 'a'.repeat(24), deployId: 'b'.repeat(24), previousCodeCommit: 'c'.repeat(40), codeCommit: 'd'.repeat(40), snapshotId: 'snapshot', snapshotSha256: 'digest', ...overrides };
  const save = () => writeFile(path.join(root, '.cms/publication-report.json'), JSON.stringify(publication));
  await save();
  const requests = [], bodies = [], diffs = [];
  const options = { current: html('Nouveau contenu'), old: html(), status: 202, key: DEFAULT_KEY };
  const fetchImpl = async (input, init) => {
    requests.push({ input, init });
    if (input === 'https://api.indexnow.org/indexnow') {
      bodies.push(JSON.parse(init.body));
      if (options.fail) throw Error('TIMEOUT');
      return new Response(null, { status: options.status });
    }
    if (input.endsWith('/.well-known/flexweb-release.json')) return Response.json(options.marker || publication);
    if (input.endsWith(`/${DEFAULT_KEY}.txt`)) return new Response(options.key);
    if (input.startsWith('https://' + 'a'.repeat(24))) return new Response(options.old, { status: options.oldStatus || 200, headers: { 'content-type': 'text/html', 'x-robots-tag': 'noindex' } });
    assert.ok(input.startsWith(ORIGIN + '/'), 'only approved domain fetched');
    return new Response(options.current, { status: options.currentStatus || 200, headers: { 'content-type': 'text/html', ...(options.headers || {}) } });
  };
  const run = (env = {}) => runIndexNow({ root, env, fetchImpl, diff: async (before, after) => { diffs.push([before, after]); return ['src/pages/creation-site-internet.astro']; } });
  return { root, publication, save, options, requests, bodies, diffs, run };
}

test('routes are bounded, first party HTML only, and include shared regional source changes', () => {
  assert.throws(() => normalizedURL('https://evil.test/page/'), /OUT_OF_SCOPE/);
  assert.throws(() => normalizedURL('//evil.test/page/'), /OUT_OF_SCOPE/);
  assert.throws(() => normalizedURL('/creation-site-internet/?draft=1'), /OUT_OF_SCOPE/);
  assert.throws(() => normalizedURL('/llms.txt'), /OUT_OF_SCOPE/);
  assert.deepEqual(candidateURLs([], Array.from({ length: 20000 }, (_, i) => `/territoires/sites/ville-${i}/`)), []);
  assert.ok(candidateURLs(['src/pages/[slug].astro']).includes(ORIGIN + '/creation-site-internet-savoie/'));
  assert.deepEqual(candidateURLs(['src/pages/journal/assistant-ia-interne-entreprise.astro']), [ORIGIN + '/journal/assistant-ia-interne-entreprise/']);
  assert.throws(() => candidateURLs([], Array.from({ length: 51 }, (_, i) => `/journal/guide-${i}/`)), /TOO_MANY/);
  assert.deepEqual(candidateURLs([], Array.from({ length: 51 }, (_, i) => `/journal/guide-${i}/`), [route]), [url]);
});

test('shared regional brief and guide dependencies select their bounded page sets', () => {
  const regional = ['/creation-application-mobile-savoie/', '/creation-application-mobile-haute-savoie/'].map(route => ORIGIN + route).sort();
  for (const source of ['src/data/regional-application-briefs.ts', 'src/components/marketing/ApplicationRegionalBrief.astro']) assert.deepEqual(candidateURLs([source]), regional);
  for (const source of ['src/data/journalArticles.json', 'src/components/JournalListing.jsx']) assert.deepEqual(candidateURLs([source]), [ORIGIN + '/journal/']);
  const guides = ['assistant-ia-interne-entreprise', 'connecter-demandes-crm', 'automatisation-ou-application-sur-mesure', 'taches-automatiser-pme'].map(slug => `${ORIGIN}/journal/${slug}/`).sort();
  assert.deepEqual(candidateURLs(['src/layout/AutomationGuideLayout.astro']), guides);
  assert.deepEqual(candidateURLs(['src/data/business.ts']), []);
});

test('territorial publication only selects the explicitly reviewed dossier and hubs', () => {
  assert.deepEqual(candidateURLs(['src/components/seo/national/TerritorySearch.astro', 'src/lib/seo/territorial-editorial.mjs']),
    ['/territoires/', '/territoires/departements/38/', '/territoires/sites/montalieu-vercieu-38247/'].map(route => ORIGIN + route));
  assert.deepEqual(candidateURLs(['src/pages/territoires/[axe]/[slug].astro']), []);
  assert.throws(() => normalizedURL('/territoires/sites/autre-ville-99999/'), /OUT_OF_SCOPE/);
});

test('fingerprint rejects canonical and robots blockers, ignores irrelevant asset filenames', () => {
  assert.throws(() => pageFingerprint(html('', url, '<meta content="noindex,follow" name="robots">'), url), /NOINDEX/);
  assert.throws(() => pageFingerprint(html(), url, 'bingbot: noindex'), /NOINDEX/);
  assert.throws(() => pageFingerprint(html('Texte', ORIGIN + '/'), url), /CANONICAL/);
  assert.throws(() => pageFingerprint(html('Texte', url, `<link href="${url}" rel="canonical">`), url), /CANONICAL/);
  assert.equal(pageFingerprint(html('Texte', url, '<script src="hash1.js"></script>'), url), pageFingerprint(html('Texte', url, '<script src="hash2.js"></script>'), url));
});

test('changed screenshots, alternative text and responsive images affect the content fingerprint', () => {
  const imagePage = image => html().replace('</main>', image + '</main>');
  const original = pageFingerprint(imagePage('<img src="/screenshot-old.webp" alt="Accueil">'), url);
  assert.notEqual(original, pageFingerprint(imagePage('<img src="/screenshot-new.webp" alt="Accueil">'), url));
  assert.notEqual(original, pageFingerprint(imagePage('<img src="/screenshot-old.webp" alt="Formulaire de contact">'), url));
  assert.notEqual(original, pageFingerprint(imagePage('<img src="/screenshot-old.webp" srcset="/screenshot-large.webp 2x" alt="Accueil">'), url));
  assert.notEqual(pageFingerprint(imagePage('<picture><source srcset="/old.webp"><img src="/fallback.jpg" alt="Accueil"></picture>'), url), pageFingerprint(imagePage('<picture><source srcset="/new.webp"><img src="/fallback.jpg" alt="Accueil"></picture>'), url));
});

test('only verified production emits; unchanged scheduled publication makes no network request', async t => {
  const f = await fixture(t, { unchanged: true });
  assert.equal((await f.run()).reason, 'UNCHANGED_PUBLICATION');
  assert.equal(f.requests.length, 0);
  f.publication.unchanged = false; f.publication.status = 'blocked'; await f.save();
  assert.equal((await f.run()).error, 'PRODUCTION_NOT_VERIFIED');
  assert.equal(f.bodies.length, 0);
});

test('uses real previous production commit, validates key, records 202 as pending, deduplicates receipt', async t => {
  const f = await fixture(t);
  const report = await f.run();
  assert.deepEqual(f.diffs, [[f.publication.previousCodeCommit, f.publication.codeCommit]]);
  assert.equal(report.status, 'key_validation_pending');
  assert.deepEqual(report.submitted, [url]);
  assert.equal(f.bodies[0].host, 'flex-web.fr');
  assert.equal(f.bodies[0].keyLocation, ORIGIN + '/' + DEFAULT_KEY + '.txt');
  const again = await f.run();
  assert.equal(again.skipped[0].reason, 'ALREADY_NOTIFIED');
  assert.equal(f.bodies.length, 1);
});

test('HTTP rejection never appears submitted or accepted in ledger', async t => {
  const f = await fixture(t); f.options.status = 429;
  const result = await f.run();
  assert.equal(result.status, 'rejected');
  assert.deepEqual(result.attempted, [url]);
  assert.deepEqual(result.submitted, []);
  const state = JSON.parse(await readFile(path.join(f.root, '.cms/indexnow-state.json')));
  assert.deepEqual(state.accepted, {});
  assert.deepEqual(state.uncertain, {});
});

test('uncertain provider timeout persists intent and prevents a blind duplicate', async t => {
  const f = await fixture(t); f.options.fail = true;
  const result = await f.run();
  assert.equal(result.status, 'uncertain');
  assert.deepEqual(result.submitted, []);
  f.options.fail = false;
  assert.equal((await f.run()).skipped[0].reason, 'PREVIOUS_ATTEMPT_UNCERTAIN');
  assert.equal(f.bodies.length, 1);
});

test('no receipt cache is needed to skip identical content in previous immutable deploy', async t => {
  const f = await fixture(t); f.options.old = f.options.current;
  const report = await f.run();
  assert.equal(report.skipped[0].reason, 'CONTENT_UNCHANGED');
  assert.equal(f.bodies.length, 0);
});

test('a missing prior page is eligible; current redirect, noindex and invalid canonical are excluded', async t => {
  const f = await fixture(t); f.options.oldStatus = 404;
  assert.equal((await f.run()).submitted.length, 1);
  await rm(path.join(f.root, '.cms/indexnow-state.json'));
  f.options.headers = { 'x-robots-tag': 'noindex' };
  assert.equal((await f.run()).skipped[0].reason, 'NOINDEX');
  f.options.headers = {}; f.options.current = html('Nouveau', ORIGIN + '/');
  assert.equal((await f.run()).skipped[0].reason, 'CANONICAL_MISMATCH');
  f.options.currentStatus = 301;
  assert.equal((await f.run()).skipped[0].reason, 'PAGE_HTTP_301');
  assert.equal(f.bodies.length, 1);
});

test('bad key and production marker mismatch prevent submission', async t => {
  const f = await fixture(t); f.options.key = 'different-key';
  assert.equal((await f.run()).error, 'KEY_NOT_VERIFIED');
  f.options.marker = { ...f.publication, codeCommit: 'e'.repeat(40) };
  assert.equal((await f.run()).error, 'PRODUCTION_MARKER_MISMATCH');
  assert.equal(f.bodies.length, 0);
});

test('missing previous commit fails visibly instead of treating shallow diff as zero changes', async t => {
  const f = await fixture(t, { previousCodeCommit: undefined });
  assert.equal((await f.run()).error, 'MISSING_RELEASE_COMMITS');
  assert.equal(f.bodies.length, 0);
});
